package api

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// spaHandler serves the compiled first-party interface and its history fallback.
//
// API and compatibility-RPC paths are deliberately excluded from the fallback so a
// misspelled machine endpoint can never receive an HTML success response.
type spaHandler struct {
	directory string
	files     http.Handler
}

// writeUnknownRoute answers API and RPC paths that matched no route, whether or not
// the web interface is built, so they never fall through to the app shell.
func writeUnknownRoute(responseWriter http.ResponseWriter, request *http.Request) bool {
	if !strings.HasPrefix(request.URL.Path, "/api/") &&
		!strings.HasPrefix(request.URL.Path, "/transmission/") {
		return false
	}

	writeError(responseWriter, http.StatusNotFound, "not_found", "No route matches this request.")

	return true
}

// newWebHandler validates the compiled asset directory when one is configured.
//
// An empty directory is accepted by unit tests and initialization-only processes; the
// resulting handler reports that the interface is unavailable instead of serving a
// placeholder that could be mistaken for the finished application.
func newWebHandler(directory string) (http.Handler, error) {
	if directory == "" {
		return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
			if writeUnknownRoute(responseWriter, request) {
				return
			}

			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"interface_unavailable",
				"The web interface is unavailable in this build.",
			)
		}), nil
	}

	indexPath := filepath.Join(directory, "index.html")
	indexInformation, err := os.Stat(indexPath)
	if err != nil {
		return nil, errors.New("compiled web interface index is unavailable")
	}
	if indexInformation.IsDir() {
		return nil, errors.New("compiled web interface index is not a file")
	}

	return &spaHandler{
		directory: directory,
		files:     http.FileServer(http.Dir(directory)),
	}, nil
}

// ServeHTTP returns a requested static asset or the application shell.
func (handler *spaHandler) ServeHTTP(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if writeUnknownRoute(responseWriter, request) {
		return
	}

	requestedPath := strings.TrimPrefix(request.URL.Path, "/")
	if requestedPath != "" {
		assetPath := filepath.Join(handler.directory, filepath.FromSlash(requestedPath))
		assetInformation, err := os.Stat(assetPath)
		if err == nil && !assetInformation.IsDir() {
			handler.files.ServeHTTP(responseWriter, request)

			return
		}
		if err != nil && !errors.Is(err, fs.ErrNotExist) {
			writeError(
				responseWriter,
				http.StatusInternalServerError,
				"interface_unavailable",
				"The web interface could not be read.",
			)

			return
		}
	}

	indexRequest := request.Clone(request.Context())
	indexRequest.URL.Path = "/"
	handler.files.ServeHTTP(responseWriter, indexRequest)
}

// handleWeb delegates browser navigation to the compiled application handler.
func (server *Server) handleWeb(responseWriter http.ResponseWriter, request *http.Request) {
	server.webHandler.ServeHTTP(responseWriter, request)
}
