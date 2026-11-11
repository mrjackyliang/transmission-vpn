package api

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"golang.org/x/sys/unix"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

const (
	// contentDownloadLifetime is how long a prepared download of finished files stays
	// open, so a long download can resume after its connection drops.
	contentDownloadLifetime = 24 * time.Hour

	// maximumContentDownloads caps how many prepared downloads are kept. The oldest one
	// makes room for a new one.
	maximumContentDownloads = 64

	// contentDownloadPath is where a prepared download is fetched from.
	contentDownloadPath = "/api/v1/torrents/contents/"

	// contentArchiveExtensionBytes is the longest file extension kept apart when a
	// file name is shortened or numbered.
	contentArchiveExtensionBytes = 16
)

var (
	// errContentPathOutside reports a file path outside the data folder.
	errContentPathOutside = errors.New("the file isn't inside the data folder")

	// errContentNotRegular reports a path that isn't a regular file.
	errContentNotRegular = errors.New("the path isn't a regular file")
)

// contentDownloadFile is one finished file a prepared download sends.
//
// Since: 2.2.0
type contentDownloadFile struct {
	path        string
	archiveName string
	size        int64
	modified    time.Time
}

// contentDownload is a prepared download of finished torrents' files, kept for the
// browser session that asked for it.
//
// Since: 2.2.0
type contentDownload struct {
	sessionID string
	fileName  string
	single    bool
	files     []contentDownloadFile
	size      int64
	createdAt time.Time
	expiresAt time.Time
}

// finishedTorrent is one selected torrent whose files can be downloaded.
//
// Since: 2.2.0
type finishedTorrent struct {
	name  string
	files []contentDownloadFile
}

// handlePrepareTorrentContents gets the finished files of the selected torrents ready
// and answers with the link that downloads them.
//
// One torrent with one finished file downloads as that file, and anything more as one
// zip. A torrent that hasn't finished, or whose files can't be read, is left out and
// counted, so the console can say why.
//
// Since: 2.2.0
func (server *Server) handlePrepareTorrentContents(
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

	result := server.mergedTorrents(
		request.Context(),
		[]string{"downloadDir", "files", "hashString", "id", "leftUntilDone", "metadataPercentComplete", "name"},
		hashes,
	)
	torrentsByHash := make(map[string]map[string]any, len(result.Torrents))
	for _, torrent := range result.Torrents {
		if hash, _ := torrent["hashString"].(string); hash != "" {
			torrentsByHash[strings.ToLower(hash)] = torrent
		}
	}

	finished := make([]finishedTorrent, 0, len(hashes))
	unfinished := 0
	unavailable := 0
	for _, hash := range hashes {
		torrent, found := torrentsByHash[hash]
		if !found {
			unavailable++

			continue
		}
		files, done, filesError := server.finishedTorrentFiles(torrent)
		switch {
		case !done:
			unfinished++
		case filesError != nil:
			if !expectedContentError(filesError) {
				server.logInternalError("read finished torrent files", filesError)
			}
			unavailable++
		default:
			name, _ := torrent["name"].(string)
			finished = append(finished, finishedTorrent{name: name, files: files})
		}
	}

	if len(finished) == 0 {
		switch {
		case !result.Complete && len(torrentsByHash) < len(hashes):
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"transmission_unavailable",
				"Transmission is unavailable for one or more VPN connections. Try again.",
			)
		case len(torrentsByHash) == 0:
			writeError(responseWriter, http.StatusNotFound, "torrent_not_found", "One or more torrents were not found.")
		case unavailable == 0:
			writeError(
				responseWriter,
				http.StatusConflict,
				"torrent_contents_unfinished",
				"These torrents haven't finished downloading yet.",
			)
		default:
			writeError(
				responseWriter,
				http.StatusConflict,
				"torrent_contents_unavailable",
				"The downloaded files couldn't be read. They may have been moved or deleted.",
			)
		}

		return
	}

	now := server.backupClock()
	download := contentDownload{
		sessionID: principalFromContext(request.Context()).Identifier,
		createdAt: now,
		expiresAt: now.Add(contentDownloadLifetime),
	}
	switch {
	case len(hashes) == 1 && len(finished[0].files) == 1:
		file := finished[0].files[0]
		download.single = true
		download.fileName = contentFileName(path.Base(file.path))
		download.files = []contentDownloadFile{file}
		download.size = file.size
	case len(hashes) == 1:
		download.fileName = downloadFileName(finished[0].name, "download", ".zip")
		download.files = contentArchiveFiles(finished)
		download.size = storedZipSize(server.contentZipEntries(download.files))
	default:
		download.fileName = "transmission-vpn-downloads-" + now.UTC().Format("2006-01-02") + ".zip"
		download.files = contentArchiveFiles(finished)
		download.size = storedZipSize(server.contentZipEntries(download.files))
	}

	token, err := server.saveContentDownload(download)
	if err != nil {
		server.logInternalError("prepare download of finished files", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(responseWriter, http.StatusCreated, map[string]any{
		"path":        contentDownloadPath + token,
		"fileName":    download.fileName,
		"size":        download.size,
		"unfinished":  unfinished,
		"unavailable": unavailable,
	})
}

// handleDownloadTorrentContents sends a prepared download of finished files.
//
// One file is sent with byte ranges, so the browser can resume it. A zip is written
// while it's sent, with its length worked out ahead so the browser shows the progress.
// Every file is checked first, so a file that moved or changed stops the download
// before anything is sent.
//
// Since: 2.2.0
func (server *Server) handleDownloadTorrentContents(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	download, found := server.findContentDownload(
		request.PathValue("download"),
		principalFromContext(request.Context()).Identifier,
	)
	if !found {
		writeError(
			responseWriter,
			http.StatusNotFound,
			"download_expired",
			"This download has expired. Start it again from the torrent's menu.",
		)

		return
	}

	for _, file := range download.files {
		handle, information, err := server.openDataFile(file.path)
		if err == nil {
			_ = handle.Close()
		}
		if err != nil || information.Size() != file.size {
			if err != nil && !expectedContentError(err) {
				server.logInternalError("check finished file before download", err)
			}
			writeError(
				responseWriter,
				http.StatusConflict,
				"download_changed",
				"The downloaded files were moved, changed, or removed. Start the download again.",
			)

			return
		}
	}

	headers := responseWriter.Header()
	headers.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
		"filename": download.fileName,
	}))

	if download.single {
		handle, information, err := server.openDataFile(download.files[0].path)
		if err != nil {
			writeError(
				responseWriter,
				http.StatusConflict,
				"download_changed",
				"The downloaded files were moved, changed, or removed. Start the download again.",
			)

			return
		}
		defer handle.Close()
		headers.Set("Content-Type", "application/octet-stream")
		http.ServeContent(responseWriter, request, "", information.ModTime(), handle)

		return
	}

	headers.Set("Content-Type", "application/zip")
	headers.Set("Content-Length", strconv.FormatInt(download.size, 10))
	responseWriter.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	if err := writeStoredZip(responseWriter, server.contentZipEntries(download.files)); err != nil {
		// The length was already sent, so stopping early shows the browser a failed download.
		if request.Context().Err() != nil {
			server.logger.Debug("download of finished files stopped", "error", err)
		} else {
			server.logInternalError("send finished files", err)
		}
	}
}

// finishedTorrentFiles lists a finished torrent's files and checks each one on disk.
//
// done is false while the torrent still has bytes to download or nothing finished to
// send. Files the torrent skips aren't complete, so they're left out.
func (server *Server) finishedTorrentFiles(torrent map[string]any) ([]contentDownloadFile, bool, error) {
	metadataComplete, _ := numericValue(torrent["metadataPercentComplete"])
	leftUntilDone, leftKnown := numericValue(torrent["leftUntilDone"])
	if metadataComplete < 1 || !leftKnown || leftUntilDone != 0 {
		return nil, false, nil
	}

	downloadDirectory, _ := torrent["downloadDir"].(string)
	torrentFiles, _ := torrent["files"].([]any)
	files := make([]contentDownloadFile, 0, len(torrentFiles))
	for _, torrentFile := range torrentFiles {
		fields, _ := torrentFile.(map[string]any)
		name, _ := fields["name"].(string)
		length, lengthKnown := numericValue(fields["length"])
		completed, completedKnown := numericValue(fields["bytesCompleted"])
		if !lengthKnown || !completedKnown || completed != length {
			continue
		}
		if !validTorrentFilePath(name) {
			return nil, true, fmt.Errorf("Transmission reported a file name that can't be used: %q", name)
		}

		filePath := path.Join(downloadDirectory, name)
		handle, information, err := server.openDataFile(filePath)
		if err != nil {
			return nil, true, err
		}
		_ = handle.Close()
		if information.Size() != int64(length) {
			return nil, true, fmt.Errorf("%s is %d bytes on disk, not %d", filePath, information.Size(), int64(length))
		}
		files = append(files, contentDownloadFile{
			path:        filePath,
			archiveName: name,
			size:        information.Size(),
			modified:    information.ModTime(),
		})
	}
	if len(files) == 0 {
		return nil, false, nil
	}

	return files, true, nil
}

// openDataFile opens a finished file inside the data folder for reading.
//
// Each folder on the way is opened from the one before it without following symbolic
// links, the way the folder browser refuses them, so a link can't lead anywhere else.
// Anything but a regular file is refused.
//
// Since: 2.2.0
func (server *Server) openDataFile(filePath string) (*os.File, os.FileInfo, error) {
	root := server.dataRootPath
	if filePath != path.Clean(filePath) || !strings.HasPrefix(filePath, root+"/") {
		return nil, nil, errContentPathOutside
	}
	components := strings.Split(strings.TrimPrefix(filePath, root+"/"), "/")

	directory, err := unix.Open(root, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, nil, &os.PathError{Op: "open", Path: root, Err: err}
	}
	for _, component := range components[:len(components)-1] {
		next, openError := unix.Openat(
			directory,
			component,
			unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
			0,
		)
		_ = unix.Close(directory)
		if openError != nil {
			return nil, nil, &os.PathError{Op: "open", Path: filePath, Err: openError}
		}
		directory = next
	}

	// Opening without blocking keeps a named pipe from stalling the request.
	descriptor, err := unix.Openat(
		directory,
		components[len(components)-1],
		unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC,
		0,
	)
	_ = unix.Close(directory)
	if err != nil {
		return nil, nil, &os.PathError{Op: "open", Path: filePath, Err: err}
	}
	var status unix.Stat_t
	if err := unix.Fstat(descriptor, &status); err != nil || status.Mode&unix.S_IFMT != unix.S_IFREG {
		_ = unix.Close(descriptor)

		return nil, nil, errContentNotRegular
	}
	if err := unix.SetNonblock(descriptor, false); err != nil {
		_ = unix.Close(descriptor)

		return nil, nil, &os.PathError{Op: "open", Path: filePath, Err: err}
	}

	handle := os.NewFile(uintptr(descriptor), filePath)
	information, err := handle.Stat()
	if err != nil {
		_ = handle.Close()

		return nil, nil, err
	}

	return handle, information, nil
}

// saveContentDownload keeps a prepared download and returns the token in its link.
//
// Only the token's digest is kept. Expired downloads are dropped first, and the oldest
// one goes when the limit is reached.
func (server *Server) saveContentDownload(download contentDownload) (string, error) {
	token, digest, err := security.NewOpaqueToken("tvdl_", 32)
	if err != nil {
		return "", fmt.Errorf("generate download link: %w", err)
	}
	key := base64.RawURLEncoding.EncodeToString(digest)
	now := server.backupClock()

	server.contentDownloadMutex.Lock()
	defer server.contentDownloadMutex.Unlock()

	oldestKey := ""
	for existingKey, existing := range server.contentDownloads {
		if !now.Before(existing.expiresAt) {
			delete(server.contentDownloads, existingKey)

			continue
		}
		if oldestKey == "" || existing.createdAt.Before(server.contentDownloads[oldestKey].createdAt) {
			oldestKey = existingKey
		}
	}
	if len(server.contentDownloads) >= maximumContentDownloads && oldestKey != "" {
		delete(server.contentDownloads, oldestKey)
	}
	server.contentDownloads[key] = download

	return token, nil
}

// findContentDownload finds a prepared download for the session that asked for it.
//
// Another session, an unknown token, and an expired download all read as not found.
func (server *Server) findContentDownload(token string, sessionID string) (contentDownload, bool) {
	if token == "" || len(token) > 256 {
		return contentDownload{}, false
	}
	key := base64.RawURLEncoding.EncodeToString(security.Digest(token))

	server.contentDownloadMutex.Lock()
	defer server.contentDownloadMutex.Unlock()

	download, found := server.contentDownloads[key]
	if !found || download.sessionID != sessionID {
		return contentDownload{}, false
	}
	if !server.backupClock().Before(download.expiresAt) {
		delete(server.contentDownloads, key)

		return contentDownload{}, false
	}

	return download, true
}

// contentZipEntries turns the files into zip entries that open each file only when the
// zip reaches it.
func (server *Server) contentZipEntries(files []contentDownloadFile) []storedZipEntry {
	entries := make([]storedZipEntry, 0, len(files))
	for _, file := range files {
		entries = append(entries, storedZipEntry{
			name:     file.archiveName,
			size:     file.size,
			modified: file.modified,
			open: func() (io.ReadCloser, error) {
				handle, _, err := server.openDataFile(file.path)
				if err != nil {
					return nil, err
				}

				return handle, nil
			},
		})
	}

	return entries
}

// contentArchiveFiles names each finished file inside the zip.
//
// Each torrent keeps its folder or file name at the top, with " (2)" and so on added
// when two torrents share one, and every name is made safe to unpack on macOS,
// Windows, and Linux.
func contentArchiveFiles(torrents []finishedTorrent) []contentDownloadFile {
	usedTops := map[string]struct{}{}
	usedPaths := map[string]struct{}{}
	files := make([]contentDownloadFile, 0)
	for _, torrent := range torrents {
		renamedTops := map[string]string{}
		for _, file := range torrent.files {
			components := strings.Split(file.archiveName, "/")
			for index, component := range components {
				components[index] = contentArchiveComponent(component)
			}
			renamedTop, seen := renamedTops[components[0]]
			if !seen {
				renamedTop = uniqueContentName(components[0], len(components) == 1, usedTops)
				renamedTops[components[0]] = renamedTop
			}
			components[0] = renamedTop

			// Cleaning can make two names in one torrent match, so the later one is numbered.
			last := len(components) - 1
			base := components[last]
			archiveName := strings.Join(components, "/")
			for number := 2; contentNameTaken(usedPaths, archiveName); number++ {
				components[last] = numberedContentName(base, true, number)
				archiveName = strings.Join(components, "/")
			}
			usedPaths[strings.ToLower(archiveName)] = struct{}{}

			file.archiveName = archiveName
			files = append(files, file)
		}
	}

	return files
}

// contentArchiveComponent makes one folder or file name safe to unpack anywhere.
//
// Characters Windows forbids become underscores, control characters are dropped, and
// trailing dots and spaces, which Windows can't keep, are removed.
func contentArchiveComponent(name string) string {
	cleaned := strings.TrimRight(downloadSafeCharacters(name), " .")
	if cleaned == "" {
		return "_"
	}

	return cleaned
}

// contentFileName is the name a single downloaded file saves as, keeping its extension
// when a long name is shortened.
func contentFileName(name string) string {
	extension := path.Ext(name)
	if len(extension) > contentArchiveExtensionBytes || extension == name {
		extension = ""
	}

	return downloadFileName(strings.TrimSuffix(name, extension), "download", downloadSafeCharacters(extension))
}

// uniqueContentName adds " (2)", " (3)", and so on to a name already used at the top of
// the zip. A file's number goes before its extension. Names compare without case.
func uniqueContentName(name string, isFile bool, used map[string]struct{}) string {
	candidate := name
	for number := 2; ; number++ {
		key := strings.ToLower(candidate)
		if _, taken := used[key]; !taken {
			used[key] = struct{}{}

			return candidate
		}
		candidate = numberedContentName(name, isFile, number)
	}
}

// contentNameTaken reports whether a name is already in the zip, ignoring case.
func contentNameTaken(used map[string]struct{}, name string) bool {
	_, taken := used[strings.ToLower(name)]

	return taken
}

// numberedContentName is a name with " (number)" added, before the extension of a file.
func numberedContentName(name string, isFile bool, number int) string {
	extension := ""
	if isFile {
		extension = path.Ext(name)
		if len(extension) > contentArchiveExtensionBytes || extension == name {
			extension = ""
		}
	}

	return fmt.Sprintf("%s (%d)%s", strings.TrimSuffix(name, extension), number, extension)
}

// validTorrentFilePath accepts a relative path made of plain folder and file names.
func validTorrentFilePath(name string) bool {
	if name == "" || !utf8.ValidString(name) || strings.ContainsRune(name, 0) || strings.HasPrefix(name, "/") {
		return false
	}
	for _, component := range strings.Split(name, "/") {
		if component == "" || component == "." || component == ".." {
			return false
		}
	}

	return true
}

// expectedContentError reports a missing file, a symbolic link, or something that isn't
// a regular file. These mean the data moved, so they aren't logged as faults.
func expectedContentError(err error) bool {
	return errors.Is(err, os.ErrNotExist) ||
		errors.Is(err, errContentNotRegular) ||
		errors.Is(err, errContentPathOutside) ||
		errors.Is(err, syscall.ELOOP) ||
		errors.Is(err, syscall.ENOTDIR)
}
