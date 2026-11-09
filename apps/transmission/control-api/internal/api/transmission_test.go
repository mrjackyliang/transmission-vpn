package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// TestTransmissionAPIAdapter verifies authenticated reads, mutations, and live settings.
func TestTransmissionAPIAdapter(testingObject *testing.T) {
	var mutex sync.Mutex
	methods := []string{}
	testDaemon := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		if request.Header.Get("X-Transmission-Session-Id") != "api-test" {
			responseWriter.Header().Set("X-Transmission-Session-Id", "api-test")
			responseWriter.WriteHeader(http.StatusConflict)

			return
		}

		var input struct {
			Method string `json:"method"`
		}
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			testingObject.Errorf("decode mock RPC request: %v", err)
			responseWriter.WriteHeader(http.StatusBadRequest)

			return
		}
		mutex.Lock()
		methods = append(methods, input.Method)
		mutex.Unlock()

		arguments := map[string]any{}
		if input.Method == "torrent-get" {
			arguments["torrents"] = []map[string]any{{
				"id":   7,
				"name": "Protected download",
			}}
		}

		writeJSON(responseWriter, http.StatusOK, map[string]any{
			"arguments": arguments,
			"result":    "success",
		})
	}))
	defer testDaemon.Close()

	client, err := transmissionrpc.NewClient(
		testDaemon.URL+"/transmission/rpc",
		time.Second,
	)
	if err != nil {
		testingObject.Fatalf("create Transmission client: %v", err)
	}

	ctx := context.Background()
	temporaryDirectory := testingObject.TempDir()
	runtimeDirectory := filepath.Join(temporaryDirectory, "runtime")
	prepareRuntimeMarkers(testingObject, runtimeDirectory)
	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	const claimCode = "ABCDE-23456-FGHIJ"
	if err := store.ReplaceSetupClaim(
		ctx,
		security.Digest(claimCode),
		time.Now().Add(time.Hour),
	); err != nil {
		testingObject.Fatalf("store claim: %v", err)
	}
	passwordHash, err := security.HashPassword("a secure local password")
	if err != nil {
		testingObject.Fatalf("hash password: %v", err)
	}
	administrator, err := store.ClaimInstallation(
		ctx,
		security.Digest(claimCode),
		"administrator",
		passwordHash,
	)
	if err != nil {
		testingObject.Fatalf("claim installation: %v", err)
	}

	const sessionToken = "test-session-token"
	const csrfToken = "test-csrf-token"
	if err := store.CreateSession(
		ctx,
		"test-session",
		administrator.ID,
		security.Digest(sessionToken),
		security.Digest(csrfToken),
		time.Now().Add(time.Hour),
	); err != nil {
		testingObject.Fatalf("create session: %v", err)
	}

	server, err := NewServer(Config{
		Store:            store,
		Registry:         settings.NewRegistry(),
		InstallationKey:  make([]byte, 32),
		Transmission:     client,
		RuntimeDirectory: runtimeDirectory,
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Version:          "test",
	})
	if err != nil {
		testingObject.Fatalf("create API server: %v", err)
	}

	cookies := []*http.Cookie{
		{Name: "tvpn_session", Value: sessionToken},
		{Name: "tvpn_csrf", Value: csrfToken},
	}
	listResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		cookies,
		"",
	)
	if listResponse.Code != http.StatusOK ||
		!strings.Contains(listResponse.Body.String(), "Protected download") {
		testingObject.Fatalf(
			"list torrents status %d: %s",
			listResponse.Code,
			listResponse.Body.String(),
		)
	}

	actionResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/actions",
		`{"action":"start","ids":[7]}`,
		cookies,
		csrfToken,
	)
	if actionResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"torrent action status %d: %s",
			actionResponse.Code,
			actionResponse.Body.String(),
		)
	}

	reannounceResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/actions",
		`{"action":"reannounce","ids":[7]}`,
		cookies,
		csrfToken,
	)
	if reannounceResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"torrent reannounce status %d: %s",
			reannounceResponse.Code,
			reannounceResponse.Body.String(),
		)
	}

	updateResponse := performRequest(
		testingObject,
		server,
		http.MethodPatch,
		"/api/v1/torrents",
		`{"changes":{"filesWanted":[0],"labels":["test"],"peerLimit":80},"ids":[7]}`,
		cookies,
		csrfToken,
	)
	if updateResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"torrent update status %d: %s",
			updateResponse.Code,
			updateResponse.Body.String(),
		)
	}

	locationResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/location",
		`{"ids":[7],"location":"/data/downloads/organized","move":true}`,
		cookies,
		csrfToken,
	)
	if locationResponse.Code != http.StatusMethodNotAllowed {
		testingObject.Fatalf(
			"removed torrent location route status %d: %s",
			locationResponse.Code,
			locationResponse.Body.String(),
		)
	}

	renameResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/rename",
		`{"id":7,"name":"Renamed download","path":"Protected download"}`,
		cookies,
		csrfToken,
	)
	if renameResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"torrent rename status %d: %s",
			renameResponse.Code,
			renameResponse.Body.String(),
		)
	}

	settingsResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.downloadQueueSize":7}}`,
		cookies,
		csrfToken,
	)
	if settingsResponse.Code != http.StatusOK ||
		!strings.Contains(settingsResponse.Body.String(), `"status":"applied"`) {
		testingObject.Fatalf(
			"live settings status %d: %s",
			settingsResponse.Code,
			settingsResponse.Body.String(),
		)
	}

	restartResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/transmission/restart",
		`{"confirm":true}`,
		cookies,
		csrfToken,
	)
	if restartResponse.Code != http.StatusAccepted {
		testingObject.Fatalf(
			"Transmission restart status %d: %s",
			restartResponse.Code,
			restartResponse.Body.String(),
		)
	}

	mutex.Lock()
	defer mutex.Unlock()
	wantMethods := []string{
		"torrent-get",
		"torrent-start",
		"torrent-reannounce",
		"torrent-set",
		"torrent-rename-path",
		"session-set",
		"session-set",
		"session-close",
	}
	if len(methods) != len(wantMethods) {
		testingObject.Fatalf("RPC methods = %v, want %v", methods, wantMethods)
	}
	for index, method := range wantMethods {
		if methods[index] != method {
			testingObject.Fatalf("RPC methods = %v, want %v", methods, wantMethods)
		}
	}
}

// TestAddTorrentRequiresVPNConnection distinguishes first-run setup from a daemon outage.
func TestAddTorrentRequiresVPNConnection(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	expectError(
		t,
		performRequest(
			t,
			server,
			http.MethodPost,
			"/api/v1/torrents",
			`{"filename":"magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`,
			cookies,
			csrfToken,
		),
		http.StatusServiceUnavailable,
		"vpn_connection_required",
		"Add a VPN connection before adding torrents.",
	)
}

// TestTorrentMutationValidationRejectsUnknownProperties keeps RPC genericity private.
func TestTorrentMutationValidationRejectsUnknownProperties(testingObject *testing.T) {
	_, _, err := validateTorrentChange("script", json.RawMessage(`"/tmp/run"`))
	if err == nil || !strings.Contains(err.Error(), "unsupported") {
		testingObject.Fatalf("error = %v, want unsupported property", err)
	}
}
