package api

import (
	"archive/zip"
	"bytes"
	"io"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

const (
	thirdTestHash  = "3333333333333333333333333333333333333333"
	fourthTestHash = "4444444444444444444444444444444444444444"
)

// preparedTorrentContents is the answer to a prepared download of finished files.
type preparedTorrentContents struct {
	Path        string `json:"path"`
	FileName    string `json:"fileName"`
	Size        int64  `json:"size"`
	Unfinished  int    `json:"unfinished"`
	Unavailable int    `json:"unavailable"`
}

// transmissionTorrentGetAnswer answers torrent-get the way Transmission does: only the
// torrents asked for, each with only the fields asked for.
func transmissionTorrentGetAnswer(call recordedTransmissionCall, torrents []map[string]any) any {
	fields := map[string]struct{}{}
	requestedFields, _ := call.Arguments["fields"].([]any)
	for _, field := range requestedFields {
		if name, valid := field.(string); valid {
			fields[name] = struct{}{}
		}
	}
	requestedIDs, idsGiven := call.Arguments["ids"].([]any)

	answer := []map[string]any{}
	for _, torrent := range torrents {
		if idsGiven && !slices.ContainsFunc(requestedIDs, func(identifier any) bool {
			hash, _ := torrent["hashString"].(string)
			if text, isText := identifier.(string); isText {
				return strings.EqualFold(text, hash)
			}
			number, _ := identifier.(float64)

			return number == float64(torrent["id"].(int))
		}) {
			continue
		}
		trimmed := map[string]any{}
		for field, value := range torrent {
			if _, wanted := fields[field]; wanted {
				trimmed[field] = value
			}
		}
		answer = append(answer, trimmed)
	}

	return map[string]any{"torrents": answer}
}

// newTorrentContentsFixture lists a finished movie, a finished season with a skipped
// sample, a torrent still downloading, and a finished torrent whose file is a link.
func newTorrentContentsFixture(testingObject *testing.T) (multiTransmissionFixture, string) {
	testingObject.Helper()

	root := testingObject.TempDir()
	write := func(name string, content string) {
		testingObject.Helper()

		filePath := filepath.Join(root, name)
		if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
			testingObject.Fatalf("make folder for %s: %v", name, err)
		}
		if err := os.WriteFile(filePath, []byte(content), 0o644); err != nil {
			testingObject.Fatalf("write %s: %v", name, err)
		}
	}
	write("downloads/Movie.mkv", "movie bytes")
	write("downloads/Show.S01/E01.mkv", "episode one")
	write("downloads/Show.S01/E02.mkv", "episode two!")
	write("downloads/Show.S01/Sample.mkv", "sam")
	if err := os.Symlink("Movie.mkv", filepath.Join(root, "downloads", "Linked.mkv")); err != nil {
		testingObject.Fatalf("link a file: %v", err)
	}

	downloads := root + "/downloads"
	torrents := []map[string]any{
		{
			"hashString":              firstTestHash,
			"id":                      1,
			"name":                    "Movie.mkv",
			"downloadDir":             downloads,
			"leftUntilDone":           0,
			"metadataPercentComplete": 1,
			"files": []map[string]any{
				{"name": "Movie.mkv", "length": 11, "bytesCompleted": 11},
			},
		},
		{
			"hashString":              secondTestHash,
			"id":                      2,
			"name":                    "Show.S01",
			"downloadDir":             downloads,
			"leftUntilDone":           0,
			"metadataPercentComplete": 1,
			"files": []map[string]any{
				{"name": "Show.S01/E01.mkv", "length": 11, "bytesCompleted": 11},
				{"name": "Show.S01/E02.mkv", "length": 12, "bytesCompleted": 12},
				{"name": "Show.S01/Sample.mkv", "length": 900, "bytesCompleted": 3},
			},
		},
		{
			"hashString":              thirdTestHash,
			"id":                      3,
			"name":                    "Still downloading",
			"downloadDir":             downloads,
			"leftUntilDone":           500,
			"metadataPercentComplete": 1,
			"files": []map[string]any{
				{"name": "Still downloading.mkv", "length": 1000, "bytesCompleted": 500},
			},
		},
		{
			"hashString":              fourthTestHash,
			"id":                      4,
			"name":                    "Linked.mkv",
			"downloadDir":             downloads,
			"leftUntilDone":           0,
			"metadataPercentComplete": 1,
			"files": []map[string]any{
				{"name": "Linked.mkv", "length": 11, "bytesCompleted": 11},
			},
		},
	}

	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return transmissionTorrentGetAnswer(call, torrents)
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	fixture.server.dataRootPath = root

	return fixture, root
}

// prepareTorrentContents asks for a download of the torrents' finished files.
func prepareTorrentContents(
	testingObject *testing.T,
	fixture multiTransmissionFixture,
	hashes ...string,
) (preparedTorrentContents, *httptest.ResponseRecorder) {
	testingObject.Helper()

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/contents",
		`{"hashes":["`+strings.Join(hashes, `","`)+`"]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	prepared := preparedTorrentContents{}
	if response.Code == http.StatusCreated {
		decodeBody(testingObject, response, &prepared)
	}

	return prepared, response
}

// readTorrentContentsZip lists a downloaded zip's entries and their contents.
func readTorrentContentsZip(testingObject *testing.T, body []byte) map[string]string {
	testingObject.Helper()

	archive, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		testingObject.Fatalf("read zip: %v", err)
	}
	contents := map[string]string{}
	for _, file := range archive.File {
		entry, err := file.Open()
		if err != nil {
			testingObject.Fatalf("open %s: %v", file.Name, err)
		}
		content, err := io.ReadAll(entry)
		_ = entry.Close()
		if err != nil {
			testingObject.Fatalf("read %s: %v", file.Name, err)
		}
		contents[file.Name] = string(content)
	}

	return contents
}

// TestTorrentContentsSendOneFileAsItIs downloads a one-file torrent as that file.
//
// The file keeps its name, and a byte range lets the browser resume it.
func TestTorrentContentsSendOneFileAsItIs(testingObject *testing.T) {
	fixture, _ := newTorrentContentsFixture(testingObject)

	prepared, response := prepareTorrentContents(testingObject, fixture, firstTestHash)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("prepare status %d: %s", response.Code, response.Body.String())
	}
	if prepared.FileName != "Movie.mkv" || prepared.Size != 11 || prepared.Unfinished != 0 || prepared.Unavailable != 0 ||
		!strings.HasPrefix(prepared.Path, "/api/v1/torrents/contents/tvdl_") {
		testingObject.Fatalf("prepared = %+v", prepared)
	}

	download := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", fixture.cookies, "")
	if download.Code != http.StatusOK || download.Body.String() != "movie bytes" {
		testingObject.Fatalf("download status %d: %q", download.Code, download.Body.String())
	}
	if contentType := download.Header().Get("Content-Type"); contentType != "application/octet-stream" {
		testingObject.Fatalf("content type = %q", contentType)
	}
	_, parameters, err := mime.ParseMediaType(download.Header().Get("Content-Disposition"))
	if err != nil || parameters["filename"] != "Movie.mkv" {
		testingObject.Fatalf("disposition = %q, %v", download.Header().Get("Content-Disposition"), err)
	}

	request := httptest.NewRequest(http.MethodGet, prepared.Path, nil)
	for _, cookie := range fixture.cookies {
		request.AddCookie(cookie)
	}
	request.Header.Set("Range", "bytes=6-10")
	resumed := httptest.NewRecorder()
	fixture.server.ServeHTTP(resumed, request)
	if resumed.Code != http.StatusPartialContent || resumed.Body.String() != "bytes" {
		testingObject.Fatalf("range status %d: %q", resumed.Code, resumed.Body.String())
	}
}

// TestTorrentContentsZipATorrentsFolder downloads a season as one zip of its folder.
//
// The zip's length is known before it's sent, and a file the torrent skips is left out.
func TestTorrentContentsZipATorrentsFolder(testingObject *testing.T) {
	fixture, _ := newTorrentContentsFixture(testingObject)

	prepared, response := prepareTorrentContents(testingObject, fixture, secondTestHash)
	if response.Code != http.StatusCreated || prepared.FileName != "Show.S01.zip" {
		testingObject.Fatalf("prepare status %d: %s", response.Code, response.Body.String())
	}

	download := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", fixture.cookies, "")
	if download.Code != http.StatusOK || download.Header().Get("Content-Type") != "application/zip" {
		testingObject.Fatalf("download status %d: %s", download.Code, download.Body.String())
	}
	if length := download.Header().Get("Content-Length"); length != strconv.FormatInt(prepared.Size, 10) ||
		int64(download.Body.Len()) != prepared.Size {
		testingObject.Fatalf("length header %q, prepared %d, body %d", length, prepared.Size, download.Body.Len())
	}
	contents := readTorrentContentsZip(testingObject, download.Body.Bytes())
	want := map[string]string{
		"Show.S01/E01.mkv": "episode one",
		"Show.S01/E02.mkv": "episode two!",
	}
	if len(contents) != len(want) || contents["Show.S01/E01.mkv"] != want["Show.S01/E01.mkv"] ||
		contents["Show.S01/E02.mkv"] != want["Show.S01/E02.mkv"] {
		testingObject.Fatalf("zip contents = %v, want %v", contents, want)
	}
}

// TestTorrentContentsLeaveOutUnfinishedAndLinkedTorrents zips what has finished.
//
// A torrent still downloading and one whose file is a symbolic link are counted apart,
// so the console can say why each was left out.
func TestTorrentContentsLeaveOutUnfinishedAndLinkedTorrents(testingObject *testing.T) {
	fixture, _ := newTorrentContentsFixture(testingObject)

	prepared, response := prepareTorrentContents(
		testingObject,
		fixture,
		firstTestHash,
		secondTestHash,
		thirdTestHash,
		fourthTestHash,
	)
	if response.Code != http.StatusCreated || prepared.Unfinished != 1 || prepared.Unavailable != 1 ||
		!strings.HasPrefix(prepared.FileName, "transmission-vpn-downloads-") {
		testingObject.Fatalf("prepare status %d: %s", response.Code, response.Body.String())
	}

	download := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", fixture.cookies, "")
	contents := readTorrentContentsZip(testingObject, download.Body.Bytes())
	names := []string{}
	for name := range contents {
		names = append(names, name)
	}
	slices.Sort(names)
	if !slices.Equal(names, []string{"Movie.mkv", "Show.S01/E01.mkv", "Show.S01/E02.mkv"}) {
		testingObject.Fatalf("zip names = %v", names)
	}

	if _, unfinished := prepareTorrentContents(testingObject, fixture, thirdTestHash); unfinished.Code != http.StatusConflict ||
		!strings.Contains(unfinished.Body.String(), "torrent_contents_unfinished") {
		testingObject.Fatalf("unfinished status %d: %s", unfinished.Code, unfinished.Body.String())
	}
	if _, linked := prepareTorrentContents(testingObject, fixture, fourthTestHash); linked.Code != http.StatusConflict ||
		!strings.Contains(linked.Body.String(), "torrent_contents_unavailable") {
		testingObject.Fatalf("linked status %d: %s", linked.Code, linked.Body.String())
	}
}

// TestTorrentContentsDownloadsStayWithTheirSession keeps a download link to the
// session that made it, for a day, and to files that haven't changed.
func TestTorrentContentsDownloadsStayWithTheirSession(testingObject *testing.T) {
	fixture, root := newTorrentContentsFixture(testingObject)

	prepared, _ := prepareTorrentContents(testingObject, fixture, secondTestHash)
	if signedOut := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", nil, ""); signedOut.Code != http.StatusUnauthorized {
		testingObject.Fatalf("signed-out status %d", signedOut.Code)
	}

	_, plaintext := createTestToken(
		testingObject,
		fixture.server,
		fixture.cookies,
		fixture.csrfToken,
		`{"name":"Reader","scopes":["torrents:read"]}`,
	)
	if tokenDownload := bearerRequest(fixture.server, http.MethodGet, prepared.Path, plaintext); tokenDownload.Code != http.StatusForbidden {
		testingObject.Fatalf("token download status %d", tokenDownload.Code)
	}

	if err := os.WriteFile(filepath.Join(root, "downloads", "Show.S01", "E02.mkv"), []byte("replaced"), 0o644); err != nil {
		testingObject.Fatalf("change a file: %v", err)
	}
	if changed := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", fixture.cookies, ""); changed.Code != http.StatusConflict ||
		!strings.Contains(changed.Body.String(), "download_changed") {
		testingObject.Fatalf("changed status %d: %s", changed.Code, changed.Body.String())
	}

	fixture.server.contentDownloadMutex.Lock()
	for key, download := range fixture.server.contentDownloads {
		download.sessionID = "another-session"
		fixture.server.contentDownloads[key] = download
	}
	fixture.server.contentDownloadMutex.Unlock()
	if otherSession := performRequest(testingObject, fixture.server, http.MethodGet, prepared.Path, "", fixture.cookies, ""); otherSession.Code != http.StatusNotFound {
		testingObject.Fatalf("other session status %d", otherSession.Code)
	}

	fresh, _ := prepareTorrentContents(testingObject, fixture, firstTestHash)
	fixture.server.backupClock = func() time.Time { return time.Now().Add(contentDownloadLifetime + time.Minute) }
	if expired := performRequest(testingObject, fixture.server, http.MethodGet, fresh.Path, "", fixture.cookies, ""); expired.Code != http.StatusNotFound ||
		!strings.Contains(expired.Body.String(), "download_expired") {
		testingObject.Fatalf("expired status %d: %s", expired.Code, expired.Body.String())
	}
}

// TestTorrentContentsNeedABrowserSession keeps API tokens from preparing downloads.
func TestTorrentContentsNeedABrowserSession(testingObject *testing.T) {
	fixture, _ := newTorrentContentsFixture(testingObject)

	_, plaintext := createTestToken(
		testingObject,
		fixture.server,
		fixture.cookies,
		fixture.csrfToken,
		`{"name":"Writer","scopes":["torrents:write"]}`,
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/contents",
		strings.NewReader(`{"hashes":["`+firstTestHash+`"]}`),
	)
	request.Header.Set("Authorization", "Bearer "+plaintext)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	fixture.server.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || !strings.Contains(response.Body.String(), "session_required") {
		testingObject.Fatalf("token prepare status %d: %s", response.Code, response.Body.String())
	}
}

// TestContentArchiveNames keeps every name in a zip separate and safe to unpack.
//
// Torrents that share a top folder or file name are numbered, characters Windows
// forbids become underscores, and names that clean up the same are numbered too.
func TestContentArchiveNames(testingObject *testing.T) {
	torrent := func(names ...string) finishedTorrent {
		files := []contentDownloadFile{}
		for _, name := range names {
			files = append(files, contentDownloadFile{archiveName: name})
		}

		return finishedTorrent{files: files}
	}
	files := contentArchiveFiles([]finishedTorrent{
		torrent("Show/E01.mkv", "Show/E02.mkv"),
		torrent("show/E01.mkv"),
		torrent("Movie.mkv"),
		torrent("movie.mkv"),
		torrent("What?/Part: 1.mkv", "What?/Part* 1.mkv", "What?/Trailing. "),
	})
	names := []string{}
	for _, file := range files {
		names = append(names, file.archiveName)
	}
	want := []string{
		"Show/E01.mkv",
		"Show/E02.mkv",
		"show (2)/E01.mkv",
		"Movie.mkv",
		"movie (2).mkv",
		"What_/Part_ 1.mkv",
		"What_/Part_ 1 (2).mkv",
		"What_/Trailing",
	}
	if !slices.Equal(names, want) {
		testingObject.Fatalf("archive names = %q, want %q", names, want)
	}

	for name, saved := range map[string]string{
		"Movie: The Return.mkv":           "Movie_ The Return.mkv",
		strings.Repeat("a", 300) + ".mkv": strings.Repeat("a", maximumTorrentFileNameBytes) + ".mkv",
		".hidden":                         "hidden",
		"???":                             "___",
	} {
		if got := contentFileName(name); got != saved {
			testingObject.Fatalf("contentFileName(%q) = %q, want %q", name, got, saved)
		}
	}
}
