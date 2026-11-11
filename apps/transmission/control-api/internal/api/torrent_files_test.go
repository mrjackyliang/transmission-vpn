package api

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
)

// torrentFileTestBrowser serves metainfo by path and reports any other path as missing,
// the way the directory controller answers for a magnet still fetching metadata.
type torrentFileTestBrowser struct {
	testDirectoryBrowser
	files map[string][]byte
}

func (browser torrentFileTestBrowser) ReadTorrent(_ context.Context, path string) ([]byte, error) {
	content, found := browser.files[path]
	if !found {
		return nil, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "That folder no longer exists.",
		}
	}

	return bytes.Clone(content), nil
}

var torrentFileTestMetainfo = []byte("d4:infod6:lengthi1e4:name4:testee")

// newTorrentFileFixture lists one torrent with a file and one magnet without one.
func newTorrentFileFixture(testingObject *testing.T) multiTransmissionFixture {
	testingObject.Helper()

	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return transmissionTorrentGetAnswer(call, []map[string]any{
					{"hashString": firstTestHash, "id": 1, "name": "Big Buck Bunny: 1080p"},
					{"hashString": secondTestHash, "id": 2, "name": "Magnet still fetching"},
				})
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	fixture.server.directoryBrowser = torrentFileTestBrowser{files: map[string][]byte{
		filepath.Join("/config/transmission", fixture.first.ID, "torrents", firstTestHash+".torrent"): torrentFileTestMetainfo,
	}}

	return fixture
}

// TestDownloadTorrentFileSendsOneTorrent answers one torrent with its .torrent file.
func TestDownloadTorrentFileSendsOneTorrent(testingObject *testing.T) {
	fixture := newTorrentFileFixture(testingObject)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/torrent-files",
		`{"hashes":["`+firstTestHash+`"]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("download status %d: %s", response.Code, response.Body.String())
	}
	if contentType := response.Header().Get("Content-Type"); contentType != "application/x-bittorrent" {
		testingObject.Fatalf("content type = %q", contentType)
	}
	_, parameters, err := mime.ParseMediaType(response.Header().Get("Content-Disposition"))
	if err != nil || parameters["filename"] != "Big Buck Bunny_ 1080p.torrent" {
		testingObject.Fatalf("disposition = %q, %v", response.Header().Get("Content-Disposition"), err)
	}
	if !bytes.Equal(response.Body.Bytes(), torrentFileTestMetainfo) {
		testingObject.Fatalf("body = %q", response.Body.Bytes())
	}
	if skipped := response.Header().Get("X-Torrent-Files-Skipped"); skipped != "0" {
		testingObject.Fatalf("skipped = %q, want 0", skipped)
	}
}

// TestDownloadTorrentFilesZipsSeveralAndSkipsMissing zips the files that exist.
func TestDownloadTorrentFilesZipsSeveralAndSkipsMissing(testingObject *testing.T) {
	fixture := newTorrentFileFixture(testingObject)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/torrent-files",
		`{"hashes":["`+firstTestHash+`","`+secondTestHash+`"]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("download status %d: %s", response.Code, response.Body.String())
	}
	if contentType := response.Header().Get("Content-Type"); contentType != "application/zip" {
		testingObject.Fatalf("content type = %q", contentType)
	}
	if skipped := response.Header().Get("X-Torrent-Files-Skipped"); skipped != "1" {
		testingObject.Fatalf("skipped = %q, want 1", skipped)
	}

	archive, err := zip.NewReader(bytes.NewReader(response.Body.Bytes()), int64(response.Body.Len()))
	if err != nil {
		testingObject.Fatalf("open zip: %v", err)
	}
	if len(archive.File) != 1 || archive.File[0].Name != "Big Buck Bunny_ 1080p.torrent" {
		testingObject.Fatalf("zip entries = %+v", archive.File)
	}
	entry, err := archive.File[0].Open()
	if err != nil {
		testingObject.Fatalf("open zip entry: %v", err)
	}
	defer entry.Close()
	content, err := io.ReadAll(entry)
	if err != nil || !bytes.Equal(content, torrentFileTestMetainfo) {
		testingObject.Fatalf("zip entry = %q, %v", content, err)
	}
}

// TestDownloadTorrentFileExplainsMissingMetadata answers a magnet with no file yet.
func TestDownloadTorrentFileExplainsMissingMetadata(testingObject *testing.T) {
	fixture := newTorrentFileFixture(testingObject)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/torrent-files",
		`{"hashes":["`+secondTestHash+`"]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	expectError(
		testingObject,
		response,
		http.StatusConflict,
		"torrent_file_unavailable",
		"There's no .torrent file yet. Transmission saves one once a torrent has its metadata.",
	)
}

// TestTorrentDownloadNames keeps file names safe and unique inside one zip.
func TestTorrentDownloadNames(testingObject *testing.T) {
	testCases := []struct {
		name string
		want string
	}{
		{name: "Big Buck Bunny: 1080p", want: "Big Buck Bunny_ 1080p.torrent"},
		{name: "a/b\\c*d?e\"f<g>h|i", want: "a_b_c_d_e_f_g_h_i.torrent"},
		{name: "  .hidden.  ", want: "hidden.torrent"},
		{name: "line\nbreak", want: "linebreak.torrent"},
		{name: "", want: firstTestHash + ".torrent"},
	}
	for _, testCase := range testCases {
		if got := torrentDownloadName(testCase.name, firstTestHash); got != testCase.want {
			testingObject.Fatalf("torrentDownloadName(%q) = %q, want %q", testCase.name, got, testCase.want)
		}
	}

	used := map[string]struct{}{}
	for index, want := range []string{"Same.torrent", "same (2).torrent", "Same (3).torrent"} {
		name := []string{"Same.torrent", "same.torrent", "Same.torrent"}[index]
		if got := uniqueTorrentDownloadName(name, used); got != want {
			testingObject.Fatalf("unique name %d = %q, want %q", index, got, want)
		}
	}
}
