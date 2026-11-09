package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// trackingDirectoryBrowser records controller-backed folder creation for API tests.
type trackingDirectoryBrowser struct {
	directories map[string]struct{}
	created     []string
	failures    map[string]error
}

// newTrackingDirectoryBrowser starts with only the mounted /data root.
func newTrackingDirectoryBrowser() *trackingDirectoryBrowser {
	return &trackingDirectoryBrowser{
		directories: map[string]struct{}{`/data`: {}},
		created:     []string{},
		failures:    map[string]error{},
	}
}

// List reports whether one simulated directory exists.
func (browser *trackingDirectoryBrowser) List(
	_ context.Context,
	path string,
) (directorybrowser.Directory, error) {
	if _, found := browser.directories[path]; !found {
		return directorybrowser.Directory{}, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "folder not found",
		}
	}

	return directorybrowser.Directory{
		Path:        path,
		Directories: []directorybrowser.DirectoryEntry{},
	}, nil
}

// Create records one direct-child creation or returns its configured failure.
func (browser *trackingDirectoryBrowser) Create(
	_ context.Context,
	parentPath string,
	name string,
) (directorybrowser.Directory, error) {
	path := filepath.Join(parentPath, name)
	if err, found := browser.failures[path]; found {
		return directorybrowser.Directory{}, err
	}
	if _, found := browser.directories[parentPath]; !found {
		return directorybrowser.Directory{}, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "parent folder not found",
		}
	}
	if _, found := browser.directories[path]; found {
		return directorybrowser.Directory{}, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeAlreadyExists,
			Message: "folder already exists",
		}
	}

	browser.directories[path] = struct{}{}
	browser.created = append(browser.created, path)

	return directorybrowser.Directory{
		Path:        path,
		ParentPath:  parentPath,
		Directories: []directorybrowser.DirectoryEntry{},
	}, nil
}

// Inspect reports one simulated directory without enumerating its siblings.
//
// Required-directory tests do not delete through HTTP, but the fake retains the
// complete controller capability used by any Server that receives it.
//
// Since: UNRELEASED
func (browser *trackingDirectoryBrowser) Inspect(
	_ context.Context,
	path string,
) (directorybrowser.DirectoryEntry, error) {
	if _, found := browser.directories[path]; !found {
		return directorybrowser.DirectoryEntry{}, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "folder not found",
		}
	}

	return directorybrowser.DirectoryEntry{
		Name:     filepath.Base(path),
		Path:     path,
		Empty:    true,
		Readable: true,
		Checked:  true,
	}, nil
}

// Delete removes one simulated directory.
func (browser *trackingDirectoryBrowser) Delete(
	_ context.Context,
	path string,
) error {
	if _, found := browser.directories[path]; !found {
		return &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "folder not found",
		}
	}
	delete(browser.directories, path)

	return nil
}

// ReadTorrent is unused by folder creation tests.
func (browser *trackingDirectoryBrowser) ReadTorrent(
	_ context.Context,
	_ string,
) ([]byte, error) {
	return nil, errors.New("torrent reading is not configured")
}

// TestStartupCreatesRequiredStorageDirectories covers startup after storage migrations.
func TestStartupCreatesRequiredStorageDirectories(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	changes := storage.SettingChanges{
		"transmission.downloadDirectory":   json.RawMessage(`"/data/library/downloads"`),
		"transmission.incompleteDirectory": json.RawMessage(`"/data/work/incomplete"`),
	}
	server := newRequiredDirectoryTestServer(testingObject, browser, changes, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()

	want := []string{
		"/data/library",
		"/data/library/downloads",
		"/data/work",
		"/data/work/incomplete",
	}
	if !reflect.DeepEqual(browser.created, want) {
		testingObject.Fatalf("created directories = %v, want %v", browser.created, want)
	}
}

// TestStartupSkipsDisabledIncompleteDirectory leaves its configured path untouched.
func TestStartupSkipsDisabledIncompleteDirectory(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	changes := storage.SettingChanges{
		"transmission.incompleteDirectoryEnabled": json.RawMessage(`false`),
	}
	server := newRequiredDirectoryTestServer(testingObject, browser, changes, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()

	want := []string{"/data/downloads"}
	if !reflect.DeepEqual(browser.created, want) {
		testingObject.Fatalf("created directories = %v, want %v", browser.created, want)
	}
}

// TestSettingsSaveCreatesRequiredStorageDirectory covers post-commit settings writes.
func TestSettingsSaveCreatesRequiredStorageDirectory(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	server := newRequiredDirectoryTestServer(testingObject, browser, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()
	browser.created = []string{}

	request := httptest.NewRequest(
		http.MethodPut,
		"/api/v1/settings",
		strings.NewReader(`{"expectedRevision":0,"changes":{"transmission.downloadDirectory":"/data/new/default"}}`),
	)
	response := httptest.NewRecorder()
	server.handleUpdateSettings(response, request)

	if response.Code != http.StatusOK {
		testingObject.Fatalf("settings status = %d: %s", response.Code, response.Body.String())
	}
	want := []string{"/data/new", "/data/new/default"}
	if !reflect.DeepEqual(browser.created, want) {
		testingObject.Fatalf("created directories = %v, want %v", browser.created, want)
	}
}

// TestRPCSessionSetCreatesRequiredStorageDirectory covers compatible RPC writes.
func TestRPCSessionSetCreatesRequiredStorageDirectory(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	server := newRequiredDirectoryTestServer(testingObject, browser, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()
	browser.created = []string{}

	_, result := server.callRPCFacade(context.Background(), "session-set", map[string]any{
		"download-dir": "/data/rpc/downloads",
	})
	if result != "success" {
		testingObject.Fatalf("session-set result = %q, want success", result)
	}
	want := []string{"/data/rpc", "/data/rpc/downloads"}
	if !reflect.DeepEqual(browser.created, want) {
		testingObject.Fatalf("created directories = %v, want %v", browser.created, want)
	}
}

// TestTorrentProfileSaveCreatesDownloadDirectory covers profile create persistence.
func TestTorrentProfileSaveCreatesDownloadDirectory(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	server := newRequiredDirectoryTestServer(testingObject, browser, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()
	browser.created = []string{}

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrent-profiles",
		strings.NewReader(testTorrentProfileRequest("Movies", "/data/library/movies", "normal")),
	)
	response := httptest.NewRecorder()
	server.handleCreateTorrentProfile(response, request)

	if response.Code != http.StatusCreated {
		testingObject.Fatalf("profile status = %d: %s", response.Code, response.Body.String())
	}
	want := []string{"/data/library", "/data/library/movies"}
	if !reflect.DeepEqual(browser.created, want) {
		testingObject.Fatalf("created directories = %v, want %v", browser.created, want)
	}
}

// TestExistingRequiredStorageDirectoriesAreLeftAlone avoids chmod or recreation.
func TestExistingRequiredStorageDirectoriesAreLeftAlone(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	browser.directories["/data/downloads"] = struct{}{}
	browser.directories["/data/incomplete"] = struct{}{}
	server := newRequiredDirectoryTestServer(testingObject, browser, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.Close()

	if len(browser.created) != 0 {
		testingObject.Fatalf("existing directories were recreated: %v", browser.created)
	}
}

// TestDirectoryCreationFailureWarnsWithoutFailingProfileSave is intentionally nonfatal.
func TestDirectoryCreationFailureWarnsWithoutFailingProfileSave(testingObject *testing.T) {
	browser := newTrackingDirectoryBrowser()
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	server := newRequiredDirectoryTestServer(testingObject, browser, nil, logger)
	defer server.Close()
	browser.created = []string{}
	browser.failures["/data/read-only"] = &directorybrowser.OperationError{
		Code:    directorybrowser.ErrorCodePermissionDenied,
		Message: "read-only mount",
	}

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrent-profiles",
		strings.NewReader(testTorrentProfileRequest("Read only", "/data/read-only", "normal")),
	)
	response := httptest.NewRecorder()
	server.handleCreateTorrentProfile(response, request)

	if response.Code != http.StatusCreated {
		testingObject.Fatalf("profile status = %d: %s", response.Code, response.Body.String())
	}
	logOutput := logs.String()
	if strings.Count(logOutput, "required storage directory could not be created") != 1 ||
		!strings.Contains(logOutput, "path=/data/read-only") ||
		!strings.Contains(logOutput, "read-only mount") {
		testingObject.Fatalf("warning did not name the path and reason: %s", logOutput)
	}
}

// newRequiredDirectoryTestServer builds one server with optional pre-start settings.
func newRequiredDirectoryTestServer(
	testingObject *testing.T,
	browser DirectoryBrowser,
	changes storage.SettingChanges,
	logger *slog.Logger,
) *Server {
	testingObject.Helper()

	ctx := context.Background()
	temporaryDirectory := testingObject.TempDir()
	runtimeDirectory := filepath.Join(temporaryDirectory, "runtime")
	prepareRuntimeMarkers(testingObject, runtimeDirectory)
	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	testingObject.Cleanup(func() { _ = store.Close() })
	registry := settings.NewRegistry()
	if len(changes) > 0 {
		if _, err := store.UpdateSettings(ctx, registry, 0, changes, "test:startup"); err != nil {
			testingObject.Fatalf("seed settings: %v", err)
		}
	}

	server, err := NewServer(Config{
		Store:            store,
		Registry:         registry,
		InstallationKey:  make([]byte, 32),
		DirectoryBrowser: browser,
		RuntimeDirectory: runtimeDirectory,
		Logger:           logger,
		Version:          "test",
	})
	if err != nil {
		testingObject.Fatalf("create API server: %v", err)
	}

	return server
}
