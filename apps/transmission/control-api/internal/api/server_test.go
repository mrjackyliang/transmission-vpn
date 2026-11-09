package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestSetupAuthenticationAndSettingsFlow exercises the complete phase-two API boundary.
//
// The flow proves one-time claiming, session CSRF enforcement, atomic settings, and
// scoped bearer access through the same handler used in the container.
func TestSetupAuthenticationAndSettingsFlow(testingObject *testing.T) {
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
		testingObject.Fatalf("store setup claim: %v", err)
	}

	server, err := NewServer(Config{
		Store:            store,
		Registry:         settings.NewRegistry(),
		InstallationKey:  make([]byte, 32),
		DirectoryBrowser: testDirectoryBrowser{},
		RuntimeDirectory: runtimeDirectory,
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Version:          "test",
	})
	if err != nil {
		testingObject.Fatalf("create API server: %v", err)
	}

	setupStatus := performRequest(testingObject, server, http.MethodGet, "/api/v1/setup/status", "", nil, "")
	if setupStatus.Code != http.StatusOK || !strings.Contains(setupStatus.Body.String(), `"claimRequired":true`) {
		testingObject.Fatalf("unexpected setup status %d: %s", setupStatus.Code, setupStatus.Body.String())
	}

	invalidClaimResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/setup/claim",
		`{"claimCode":"short","username":"administrator","password":"a secure local password"}`,
		nil,
		"",
	)
	if invalidClaimResponse.Code != http.StatusUnauthorized ||
		!strings.Contains(invalidClaimResponse.Body.String(), `"code":"claim_invalid"`) ||
		!strings.Contains(invalidClaimResponse.Body.String(), `"field":"claimCode"`) {
		testingObject.Fatalf(
			"wrong claim code status = %d, want 401 claim_invalid: %s",
			invalidClaimResponse.Code,
			invalidClaimResponse.Body.String(),
		)
	}

	claimResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/setup/claim",
		`{"claimCode":"ABCDE-23456-FGHIJ","username":"administrator","password":"a secure local password"}`,
		nil,
		"",
	)
	if claimResponse.Code != http.StatusCreated {
		testingObject.Fatalf("claim status %d: %s", claimResponse.Code, claimResponse.Body.String())
	}

	cookies := claimResponse.Result().Cookies()
	csrfToken := cookieValue(testingObject, cookies, "tvpn_csrf")
	if cookieValue(testingObject, cookies, "tvpn_session") == "" || csrfToken == "" {
		testingObject.Fatal("claim did not issue authentication cookies")
	}

	secondClaim := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/setup/claim",
		`{"claimCode":"ABCDE-23456-FGHIJ","username":"second-user","password":"another secure password"}`,
		nil,
		"",
	)
	if secondClaim.Code != http.StatusConflict ||
		!strings.Contains(secondClaim.Body.String(), `"code":"claim_unavailable"`) {
		testingObject.Fatalf("claim after setup status = %d, want 409 claim_unavailable: %s", secondClaim.Code, secondClaim.Body.String())
	}

	settingsResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/settings",
		"",
		cookies,
		"",
	)
	if settingsResponse.Code != http.StatusOK || !strings.Contains(settingsResponse.Body.String(), `"revision":0`) {
		testingObject.Fatalf("settings status %d: %s", settingsResponse.Code, settingsResponse.Body.String())
	}

	missingCSRF := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.downloadQueueSize":7}}`,
		cookies,
		"",
	)
	if missingCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("settings update without CSRF = %d, want 403", missingCSRF.Code)
	}

	updateResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.downloadQueueSize":7}}`,
		cookies,
		csrfToken,
	)
	if updateResponse.Code != http.StatusOK || !strings.Contains(updateResponse.Body.String(), `"revision":1`) {
		testingObject.Fatalf("settings update status %d: %s", updateResponse.Code, updateResponse.Body.String())
	}

	emptySettingsResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":1,"changes":{}}`,
		cookies,
		csrfToken,
	)
	if emptySettingsResponse.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf(
			"empty settings changes status = %d, want 422",
			emptySettingsResponse.Code,
		)
	}

	negativeRevisionResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":-1,"changes":{"transmission.downloadQueueSize":8}}`,
		cookies,
		csrfToken,
	)
	if negativeRevisionResponse.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf(
			"negative settings revision status = %d, want 422",
			negativeRevisionResponse.Code,
		)
	}

	organizationResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/torrent-organization",
		"",
		cookies,
		"",
	)
	if organizationResponse.Code != http.StatusOK ||
		!strings.Contains(organizationResponse.Body.String(), `"revision":0`) ||
		!strings.Contains(organizationResponse.Body.String(), `"labels":[]`) ||
		strings.Contains(organizationResponse.Body.String(), "downloadLocations") {
		testingObject.Fatalf(
			"torrent organization status %d: %s",
			organizationResponse.Code,
			organizationResponse.Body.String(),
		)
	}

	updateOrganizationResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrent-organization",
		`{"expectedRevision":0,"labels":["Weekly","Archive"],"removedLabels":[],"renamedLabels":[]}`,
		cookies,
		csrfToken,
	)
	if updateOrganizationResponse.Code != http.StatusOK ||
		!strings.Contains(updateOrganizationResponse.Body.String(), `"revision":1`) ||
		!strings.Contains(updateOrganizationResponse.Body.String(), `"labels":["Archive","Weekly"]`) ||
		!strings.Contains(updateOrganizationResponse.Body.String(), `"changedTorrents":0`) {
		testingObject.Fatalf(
			"torrent organization update status %d: %s",
			updateOrganizationResponse.Code,
			updateOrganizationResponse.Body.String(),
		)
	}

	invalidOrganizationResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrent-organization",
		`{"expectedRevision":1,"labels":[],"removedLabels":["bad,label"],"renamedLabels":[]}`,
		cookies,
		csrfToken,
	)
	if invalidOrganizationResponse.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf(
			"invalid torrent organization status = %d, want 422",
			invalidOrganizationResponse.Code,
		)
	}

	staleOrganizationResponse := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrent-organization",
		`{"expectedRevision":0,"labels":[],"removedLabels":[],"renamedLabels":[]}`,
		cookies,
		csrfToken,
	)
	// The console refreshes and merges only on this shared code, so it must not drift.
	if staleOrganizationResponse.Code != http.StatusConflict ||
		!strings.Contains(staleOrganizationResponse.Body.String(), `"code":"revision_conflict"`) {
		testingObject.Fatalf(
			"stale torrent organization = %d %s, want 409 revision_conflict",
			staleOrganizationResponse.Code,
			staleOrganizationResponse.Body.String(),
		)
	}

	directoryResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/storage/directories?path=/data",
		"",
		cookies,
		"",
	)
	if directoryResponse.Code != http.StatusOK ||
		!strings.Contains(directoryResponse.Body.String(), `"path":"/data/downloads"`) {
		testingObject.Fatalf(
			"directory browser status %d: %s",
			directoryResponse.Code,
			directoryResponse.Body.String(),
		)
	}

	missingDirectoryCSRF := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/storage/directories",
		`{"parentPath":"/data","name":"Movies"}`,
		cookies,
		"",
	)
	if missingDirectoryCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf(
			"directory creation without CSRF = %d, want 403",
			missingDirectoryCSRF.Code,
		)
	}

	createDirectoryResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/storage/directories",
		`{"parentPath":"/data","name":"Movies"}`,
		cookies,
		csrfToken,
	)
	if createDirectoryResponse.Code != http.StatusCreated ||
		!strings.Contains(createDirectoryResponse.Body.String(), `"path":"/data/Movies"`) {
		testingObject.Fatalf(
			"directory creation status %d: %s",
			createDirectoryResponse.Code,
			createDirectoryResponse.Body.String(),
		)
	}

	invalidDirectoryResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/storage/directories",
		`{"parentPath":"/config","name":"Movies"}`,
		cookies,
		csrfToken,
	)
	if invalidDirectoryResponse.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf(
			"invalid directory parent status = %d, want 422",
			invalidDirectoryResponse.Code,
		)
	}

	customProfileBody, err := json.Marshal(map[string]string{
		"profileName": "private-provider.ovpn",
		"profile": `client
proto udp
remote vpn.example.test 1194
dev tun
<ca>
certificate
</ca>
`,
	})
	if err != nil {
		testingObject.Fatalf("encode custom profile request: %v", err)
	}
	customProfileResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/vpn/profiles/custom",
		string(customProfileBody),
		cookies,
		csrfToken,
	)
	if customProfileResponse.Code != http.StatusCreated {
		testingObject.Fatalf(
			"custom profile status %d: %s",
			customProfileResponse.Code,
			customProfileResponse.Body.String(),
		)
	}

	profiles, err := store.ListVPNProfiles(ctx, "custom", "")
	if err != nil {
		testingObject.Fatalf("list custom profiles: %v", err)
	}
	if len(profiles) != 1 {
		testingObject.Fatalf("custom profile count = %d, want 1", len(profiles))
	}
	storedProfile, err := store.FindVPNProfile(ctx, profiles[0].ID)
	if err != nil {
		testingObject.Fatalf("read encrypted custom profile: %v", err)
	}
	if strings.Contains(string(storedProfile.Ciphertext), "vpn.example.test") {
		testingObject.Fatal("custom profile was persisted as plaintext")
	}

	tokenResponse := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/auth/tokens",
		`{"name":"automation","scopes":["settings:write"],"expiresAt":"`+
			time.Now().Add(30*24*time.Hour).UTC().Format(time.RFC3339)+`"}`,
		cookies,
		csrfToken,
	)
	if tokenResponse.Code != http.StatusCreated {
		testingObject.Fatalf("token creation status %d: %s", tokenResponse.Code, tokenResponse.Body.String())
	}

	var tokenPayload struct {
		Plaintext string `json:"plaintext"`
	}
	if err := json.Unmarshal(tokenResponse.Body.Bytes(), &tokenPayload); err != nil {
		testingObject.Fatalf("decode token response: %v", err)
	}
	if !strings.HasPrefix(tokenPayload.Plaintext, "tvpn_") {
		testingObject.Fatalf("unexpected plaintext token: %q", tokenPayload.Plaintext)
	}

	bearerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil)
	bearerRequest.Header.Set("Authorization", "Bearer "+tokenPayload.Plaintext)
	bearerResponse := httptest.NewRecorder()
	server.ServeHTTP(bearerResponse, bearerRequest)
	if bearerResponse.Code != http.StatusOK {
		testingObject.Fatalf("bearer settings status %d: %s", bearerResponse.Code, bearerResponse.Body.String())
	}

	tokenAdministrationRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/tokens", nil)
	tokenAdministrationRequest.Header.Set("Authorization", "Bearer "+tokenPayload.Plaintext)
	tokenAdministrationResponse := httptest.NewRecorder()
	server.ServeHTTP(tokenAdministrationResponse, tokenAdministrationRequest)
	if tokenAdministrationResponse.Code != http.StatusForbidden {
		testingObject.Fatalf(
			"bearer token administration status %d, want 403",
			tokenAdministrationResponse.Code,
		)
	}
}

// TestAttemptLimiterBoundsAndExpiresClients keeps shared sign-in state finite.
//
// Both administrator and compatible-RPC authentication use this limiter, so expired
// windows disappear and a flood of distinct addresses cannot grow its map forever.
func TestAttemptLimiterBoundsAndExpiresClients(testingObject *testing.T) {
	limiter := newAttemptLimiter(3, time.Minute)
	limiter.Failed("expired")
	limiter.mutex.Lock()
	limiter.attemptsBy["expired"] = attemptWindow{
		Failures:  1,
		StartedAt: time.Now().Add(-2 * time.Minute),
	}
	limiter.mutex.Unlock()

	if !limiter.Allowed("current") {
		testingObject.Fatal("a new client was unexpectedly limited")
	}
	if _, found := limiter.attemptsBy["expired"]; found {
		testingObject.Fatal("the expired limiter entry was retained")
	}

	for index := 0; index <= maximumTrackedAttemptClients; index++ {
		limiter.Failed(strconv.Itoa(index))
	}
	if len(limiter.attemptsBy) != maximumTrackedAttemptClients {
		testingObject.Fatalf(
			"tracked limiter clients = %d, want %d",
			len(limiter.attemptsBy),
			maximumTrackedAttemptClients,
		)
	}
	if _, found := limiter.attemptsBy["0"]; found {
		testingObject.Fatal("the oldest limiter client was not evicted")
	}
}

// TestRecoverPanicsRepanicsWithAbortHandler preserves net/http disconnect handling.
//
// ReverseProxy uses this sentinel after a downstream disconnect, and net/http must
// receive it unchanged instead of an attempted second response.
func TestRecoverPanicsRepanicsWithAbortHandler(testingObject *testing.T) {
	server := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	handler := server.recoverPanics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if recoveredValue := recover(); recoveredValue != http.ErrAbortHandler {
			testingObject.Fatalf("recovered panic = %v, want http.ErrAbortHandler", recoveredValue)
		}
	}()

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}

// testDirectoryBrowser supplies deterministic storage snapshots to HTTP tests.
//
// The real implementation is covered by its Unix-socket tests, while this fake keeps
// authentication and response mapping tests independent from host storage.
type testDirectoryBrowser struct{}

// List returns one deterministic child beneath the requested path.
//
// The response proves the authenticated API forwards the typed directory contract.
func (testDirectoryBrowser) List(
	_ context.Context,
	path string,
) (directorybrowser.Directory, error) {
	return directorybrowser.Directory{
		Path: path,
		Directories: []directorybrowser.DirectoryEntry{
			{
				Name: "downloads",
				Path: "/data/downloads",
			},
		},
	}, nil
}

// Create returns the requested direct child as a new current directory.
//
// Controller-specific path and name enforcement remains in the dedicated package test.
func (testDirectoryBrowser) Create(
	_ context.Context,
	parentPath string,
	name string,
) (directorybrowser.Directory, error) {
	return directorybrowser.Directory{
		Path:        filepath.Join(parentPath, name),
		ParentPath:  parentPath,
		Directories: []directorybrowser.DirectoryEntry{},
	}, nil
}

// Delete accepts one deterministic empty-folder removal.
//
// Folder-picker tests replace this shared fake when they need to inspect deletion
// calls or mutate a simulated parent listing.
func (testDirectoryBrowser) Delete(_ context.Context, _ string) error {
	return nil
}

// ReadTorrent returns deterministic metainfo to move tests that use the shared fake.
//
// Dedicated directory-controller tests enforce the path and filesystem boundary.
func (testDirectoryBrowser) ReadTorrent(_ context.Context, _ string) ([]byte, error) {
	return []byte("test torrent metainfo"), nil
}

// prepareRuntimeMarkers creates the minimum safe foundation observed by liveness.
//
// Tests write the same small JSON contracts as the s6 initialization scripts without
// requiring network capabilities or a Docker daemon.
func prepareRuntimeMarkers(testingObject *testing.T, runtimeDirectory string) {
	testingObject.Helper()

	runtimeDirectories := []string{
		filepath.Join(runtimeDirectory, "services"),
		filepath.Join(runtimeDirectory, "transmission-config"),
		filepath.Join(runtimeDirectory, "transmission-state"),
		filepath.Join(runtimeDirectory, "web-proxy"),
		filepath.Join(runtimeDirectory, "web-proxy-state"),
	}
	for _, runtimePath := range runtimeDirectories {
		if err := os.MkdirAll(runtimePath, 0o755); err != nil {
			testingObject.Fatalf("create runtime directory: %v", err)
		}
	}

	markers := map[string]string{
		filepath.Join(runtimeDirectory, "config.ready"):   `{}`,
		filepath.Join(runtimeDirectory, "firewall.ready"): `{"state":"blocked","backend":"legacy","uid":1000}`,
	}
	for path, content := range markers {
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			testingObject.Fatalf("write runtime marker %s: %v", path, err)
		}
	}
}

// performRequest executes one request with optional cookies and CSRF header.
//
// Keeping the complete HTTP path in tests verifies middleware behavior instead of
// calling handlers directly and bypassing authentication boundaries.
func performRequest(
	testingObject *testing.T,
	handler http.Handler,
	method string,
	path string,
	body string,
	cookies []*http.Cookie,
	csrfToken string,
) *httptest.ResponseRecorder {
	testingObject.Helper()

	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	if csrfToken != "" {
		request.Header.Set("X-CSRF-Token", csrfToken)
	}

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	return response
}

// cookieValue returns one response cookie value or fails the current test.
//
// Cookie names are part of the browser authentication contract, so absence should
// produce a direct and readable failure.
func cookieValue(
	testingObject *testing.T,
	cookies []*http.Cookie,
	name string,
) string {
	testingObject.Helper()

	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie.Value
		}
	}

	testingObject.Fatalf("cookie %s was not found", name)

	return ""
}
