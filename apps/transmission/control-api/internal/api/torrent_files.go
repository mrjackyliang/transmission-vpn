package api

import (
	"archive/zip"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
)

const (
	// maximumTorrentFileDownloadBytes caps the metainfo one download gathers in memory,
	// so a large selection can't use up a small NAS's memory.
	maximumTorrentFileDownloadBytes = 128 << 20

	// maximumTorrentFileNameBytes keeps a downloaded file's name inside common limits.
	maximumTorrentFileNameBytes = 180
)

// torrentFileDownload is one torrent's metainfo and the name it downloads as.
type torrentFileDownload struct {
	name     string
	metainfo []byte
}

// handleDownloadTorrentFiles sends the .torrent files of the selected torrents.
//
// One torrent downloads as its .torrent file and several as one zip. A torrent still
// fetching its metadata has no file yet, so it is left out and counted in the
// X-Torrent-Files-Skipped header.
//
// Since: 2.2.0
func (server *Server) handleDownloadTorrentFiles(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Hashes []string `json:"hashes"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	hashes, err := normalizeTorrentHashes(input.Hashes)
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "torrent_selection_invalid", "hashes", err.Error())

		return
	}
	if server.directoryBrowser == nil {
		writeDirectoryBrowserUnavailable(responseWriter)

		return
	}

	ctx := request.Context()
	// mergedTorrents needs each torrent's id, and Transmission sends only the fields asked for.
	result := server.mergedTorrents(ctx, []string{"hashString", "id", "name"}, hashes)
	locations := make(map[string]torrentLocation, len(result.Torrents))
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		connectionID, _ := torrent["connectionId"].(string)
		name, _ := torrent["name"].(string)
		if hash != "" && connectionID != "" {
			locations[strings.ToLower(hash)] = torrentLocation{ConnectionID: connectionID, Name: name}
		}
	}

	files := make([]torrentFileDownload, 0, len(hashes))
	skipped := 0
	totalBytes := 0
	for _, hash := range hashes {
		location, found := locations[hash]
		if !found {
			skipped++

			continue
		}
		metainfo, readError := server.directoryBrowser.ReadTorrent(
			ctx,
			filepath.Join("/config/transmission", location.ConnectionID, "torrents", hash+".torrent"),
		)
		if readError != nil {
			// A torrent still fetching its metadata has no file yet; anything else is logged.
			if directorybrowser.CodeOf(readError) != directorybrowser.ErrorCodeNotFound {
				server.logInternalError("read torrent file for download", readError)
			}
			skipped++

			continue
		}
		totalBytes += len(metainfo)
		if totalBytes > maximumTorrentFileDownloadBytes {
			writeError(
				responseWriter,
				http.StatusRequestEntityTooLarge,
				"torrent_files_too_large",
				"These torrent files add up to more than 128 MiB. Download fewer at once.",
			)

			return
		}
		files = append(files, torrentFileDownload{
			name:     torrentDownloadName(location.Name, hash),
			metainfo: metainfo,
		})
	}

	if len(files) == 0 {
		switch {
		case !result.Complete:
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"transmission_unavailable",
				"Transmission is unavailable for one or more VPN connections. Try again.",
			)
		case len(locations) == 0:
			writeError(responseWriter, http.StatusNotFound, "torrent_not_found", "One or more torrents were not found.")
		default:
			writeError(
				responseWriter,
				http.StatusConflict,
				"torrent_file_unavailable",
				"There's no .torrent file yet. Transmission saves one once a torrent has its metadata.",
			)
		}

		return
	}

	headers := responseWriter.Header()
	headers.Set("Cache-Control", "no-store")
	headers.Set("X-Torrent-Files-Skipped", strconv.Itoa(skipped))
	if len(hashes) == 1 {
		headers.Set("Content-Type", "application/x-bittorrent")
		headers.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
			"filename": files[0].name,
		}))
		responseWriter.WriteHeader(http.StatusOK)
		_, _ = responseWriter.Write(files[0].metainfo)

		return
	}

	now := server.backupClock().UTC()
	headers.Set("Content-Type", "application/zip")
	headers.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
		"filename": "transmission-vpn-torrents-" + now.Format("2006-01-02") + ".zip",
	}))
	responseWriter.WriteHeader(http.StatusOK)
	if err := writeTorrentFileArchive(responseWriter, files, now); err != nil {
		server.logInternalError("write torrent file archive", err)
	}
}

// writeTorrentFileArchive writes the files as one zip, renaming repeated names.
//
// Metainfo is mostly piece hashes that don't compress, so entries are stored as is.
func writeTorrentFileArchive(writer io.Writer, files []torrentFileDownload, modified time.Time) error {
	archive := zip.NewWriter(writer)
	used := make(map[string]struct{}, len(files))
	for _, file := range files {
		header := &zip.FileHeader{
			Name:     uniqueTorrentDownloadName(file.name, used),
			Method:   zip.Store,
			Modified: modified,
		}
		entry, err := archive.CreateHeader(header)
		if err != nil {
			return fmt.Errorf("add %s to the archive: %w", header.Name, err)
		}
		if _, err := entry.Write(file.metainfo); err != nil {
			return fmt.Errorf("write %s to the archive: %w", header.Name, err)
		}
	}

	return archive.Close()
}

// uniqueTorrentDownloadName adds " (2)", " (3)", and so on to a name already taken.
//
// Names compare without case, since macOS and Windows treat them that way.
func uniqueTorrentDownloadName(name string, used map[string]struct{}) string {
	base := strings.TrimSuffix(name, ".torrent")
	candidate := name
	for number := 2; ; number++ {
		key := strings.ToLower(candidate)
		if _, taken := used[key]; !taken {
			used[key] = struct{}{}

			return candidate
		}
		candidate = fmt.Sprintf("%s (%d).torrent", base, number)
	}
}

// torrentDownloadName turns a torrent's name into a safe .torrent file name, using the
// info hash when nothing of the name is left.
func torrentDownloadName(name string, hash string) string {
	return downloadFileName(name, hash, ".torrent")
}

// downloadFileName turns a name into a safe file name that ends in suffix.
//
// Path separators and characters Windows forbids become underscores, control
// characters are dropped, long names are shortened, and a name that ends up empty
// uses the fallback.
//
// Since: 2.2.0
func downloadFileName(name string, fallback string, suffix string) string {
	cleaned := strings.Trim(downloadSafeCharacters(name), " .")
	if len(cleaned) > maximumTorrentFileNameBytes {
		cleaned = cleaned[:maximumTorrentFileNameBytes]
		for !utf8.ValidString(cleaned) {
			cleaned = cleaned[:len(cleaned)-1]
		}
		cleaned = strings.TrimRight(cleaned, " .")
	}
	if cleaned == "" {
		cleaned = fallback
	}

	return cleaned + suffix
}

// downloadSafeCharacters drops control characters and turns path separators and the
// characters Windows forbids into underscores.
//
// Since: 2.2.0
func downloadSafeCharacters(name string) string {
	return strings.Map(func(character rune) rune {
		switch {
		case character < 0x20 || character == 0x7f:
			return -1
		case strings.ContainsRune(`/\:*?"<>|`, character):
			return '_'
		default:
			return character
		}
	}, name)
}
