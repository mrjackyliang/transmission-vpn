package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestWebProxyRoutes covers session authorization, validation, CRUD, and config hand-off.
//
// The responses must never expose password hashes, while the mode-0640 runtime file
// must contain the verifier needed by the separate proxy process after every change.
func TestWebProxyRoutes(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	defaultConnection, secondConnection := createWebProxyVPNConnectionsForTest(
		testingObject,
		server,
		cookies,
		csrfToken,
	)

	unauthenticated := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		nil,
		"",
	)
	if unauthenticated.Code != http.StatusUnauthorized {
		testingObject.Fatalf("unauthenticated web proxy status = %d", unauthenticated.Code)
	}

	const tokenValue = "tvpn_web_proxy_test_token"
	if _, err := server.store.CreateAPIToken(
		context.Background(),
		"web-proxy-token",
		1,
		"Proxy test",
		security.Digest(tokenValue),
		[]string{"settings:write"},
		nil,
	); err != nil {
		testingObject.Fatalf("create web proxy API token: %v", err)
	}
	tokenOnly := bearerRequest(server, http.MethodGet, "/api/v1/web-proxy", tokenValue)
	if tokenOnly.Code != http.StatusForbidden ||
		!strings.Contains(tokenOnly.Body.String(), `"code":"session_required"`) {
		testingObject.Fatalf("API token web proxy status = %d %s", tokenOnly.Code, tokenOnly.Body.String())
	}

	initial := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		cookies,
		"",
	)
	if initial.Code != http.StatusOK ||
		!strings.Contains(initial.Body.String(), `"enabled":false`) ||
		!strings.Contains(initial.Body.String(), `"port":22605`) ||
		!strings.Contains(initial.Body.String(), `"state":"off"`) ||
		strings.Contains(initial.Body.String(), "passwordHash") {
		testingObject.Fatalf("initial web proxy response = %d %s", initial.Code, initial.Body.String())
	}

	configurationBefore, modeBefore := readWebProxyTestConfig(testingObject, server)
	if configurationBefore.Enabled || len(configurationBefore.Logins) != 0 || modeBefore != 0o640 {
		testingObject.Fatalf("initial runtime config = %+v mode %o", configurationBefore, modeBefore)
	}

	invalidSwitch := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy",
		`{"enabled":"yes"}`,
		cookies,
		csrfToken,
	)
	if invalidSwitch.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(invalidSwitch.Body.String(), `"field":"enabled"`) {
		testingObject.Fatalf(
			"invalid web proxy switch = %d %s",
			invalidSwitch.Code,
			invalidSwitch.Body.String(),
		)
	}

	enableWithoutLogin := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy",
		`{"enabled":true}`,
		cookies,
		csrfToken,
	)
	if enableWithoutLogin.Code != http.StatusOK ||
		!strings.Contains(enableWithoutLogin.Body.String(), `"enabled":true`) {
		testingObject.Fatalf(
			"enable without login = %d %s",
			enableWithoutLogin.Code,
			enableWithoutLogin.Body.String(),
		)
	}
	configurationEnabledWithoutLogin, _ := readWebProxyTestConfig(testingObject, server)
	if !configurationEnabledWithoutLogin.Enabled || len(configurationEnabledWithoutLogin.Logins) != 0 {
		testingObject.Fatalf("enabled runtime config without login = %+v", configurationEnabledWithoutLogin)
	}

	missingCSRF := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"living-room"}`,
		cookies,
		"",
	)
	if missingCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("create login without CSRF = %d", missingCSRF.Code)
	}

	invalid := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"bad space"}`,
		cookies,
		csrfToken,
	)
	if invalid.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(invalid.Body.String(), `"code":"invalid_request"`) ||
		!strings.Contains(invalid.Body.String(), `"field":"username"`) {
		testingObject.Fatalf("invalid login = %d %s", invalid.Code, invalid.Body.String())
	}

	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPost,
			"/api/v1/web-proxy/logins",
			`{"username":"chosen-password","password":"a secure proxy password"}`,
			cookies,
			csrfToken,
		),
		http.StatusUnprocessableEntity,
		"invalid_request",
		"This field isn't accepted.",
		"password",
	)

	invalidConnection := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"missing-vpn","connectionId":"vpc-ffffffffffffffff"}`,
		cookies,
		csrfToken,
	)
	if invalidConnection.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(invalidConnection.Body.String(), `"field":"connectionId"`) ||
		!strings.Contains(invalidConnection.Body.String(), webProxyConnectionMessage) {
		testingObject.Fatalf(
			"invalid login connection = %d %s",
			invalidConnection.Code,
			invalidConnection.Body.String(),
		)
	}

	created := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"Proxy_User-1"}`,
		cookies,
		csrfToken,
	)
	if created.Code != http.StatusCreated ||
		!strings.Contains(created.Body.String(), `"passwordSet":true`) ||
		strings.Contains(created.Body.String(), "passwordHash") {
		testingObject.Fatalf("create login = %d %s", created.Code, created.Body.String())
	}

	var createdCredential struct {
		Login    webProxyLoginResponse `json:"login"`
		Password string                `json:"password"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdCredential); err != nil {
		testingObject.Fatalf("decode created login: %v", err)
	}
	createdLogin := createdCredential.Login
	if !validWebProxyLoginID(createdLogin.ID) || createdLogin.ConnectionID != nil ||
		createdLogin.EffectiveConnectionID != defaultConnection.ID {
		testingObject.Fatalf("created login = %+v", createdLogin)
	}
	decodedPassword, err := base64.RawURLEncoding.DecodeString(createdCredential.Password)
	if err != nil || len(decodedPassword) != 32 || strings.Contains(createdCredential.Password, "=") {
		testingObject.Fatalf(
			"generated web proxy password %q decoded to %d bytes: %v",
			createdCredential.Password,
			len(decodedPassword),
			err,
		)
	}

	configurationCreated, _ := readWebProxyTestConfig(testingObject, server)
	if len(configurationCreated.Logins) != 1 ||
		!strings.HasPrefix(configurationCreated.Logins[0].PasswordHash, "$argon2id$") ||
		configurationCreated.Logins[0].ConnectionID != defaultConnection.ID {
		testingObject.Fatalf("created runtime config = %+v", configurationCreated)
	}
	storedCreatedLogin, err := server.store.FindWebProxyLogin(
		testingObject.Context(),
		createdLogin.ID,
	)
	if err != nil {
		testingObject.Fatalf("read stored web proxy login: %v", err)
	}
	createdHash := storedCreatedLogin.PasswordHash
	if configurationCreated.Logins[0].PasswordHash != createdHash {
		testingObject.Fatal("runtime config did not receive the stored password verifier")
	}
	passwordMatches, err := security.VerifyPassword(createdCredential.Password, createdHash)
	if err != nil || !passwordMatches {
		testingObject.Fatalf("created web proxy password verification = %t, %v", passwordMatches, err)
	}
	configurationContent, err := os.ReadFile(server.webProxyConfigPath)
	if err != nil {
		testingObject.Fatalf("read runtime config: %v", err)
	}
	if strings.Contains(string(configurationContent), createdCredential.Password) {
		testingObject.Fatal("runtime config contains a plaintext password")
	}

	invalidEdit := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"username":"bad space"}`,
		cookies,
		csrfToken,
	)
	if invalidEdit.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(invalidEdit.Body.String(), `"field":"username"`) {
		testingObject.Fatalf("invalid login edit = %d %s", invalidEdit.Code, invalidEdit.Body.String())
	}

	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/web-proxy/logins/"+createdLogin.ID,
			`{"password":"another secure proxy password"}`,
			cookies,
			csrfToken,
		),
		http.StatusUnprocessableEntity,
		"invalid_request",
		"This field isn't accepted.",
		"password",
	)

	duplicate := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"proxy_user-1"}`,
		cookies,
		csrfToken,
	)
	if duplicate.Code != http.StatusConflict ||
		!strings.Contains(duplicate.Body.String(), `"field":"username"`) {
		testingObject.Fatalf("duplicate login = %d %s", duplicate.Code, duplicate.Body.String())
	}

	renamed := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"username":"living-room"}`,
		cookies,
		csrfToken,
	)
	if renamed.Code != http.StatusOK ||
		strings.Contains(renamed.Body.String(), "passwordHash") ||
		strings.Contains(renamed.Body.String(), `"password"`) {
		testingObject.Fatalf("rename login = %d %s", renamed.Code, renamed.Body.String())
	}
	configurationRenamed, _ := readWebProxyTestConfig(testingObject, server)
	if configurationRenamed.Logins[0].PasswordHash != createdHash {
		testingObject.Fatal("renaming the login changed the password verifier")
	}

	connectionChanged := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"username":"living-room","connectionId":"`+secondConnection.ID+`"}`,
		cookies,
		csrfToken,
	)
	if connectionChanged.Code != http.StatusOK ||
		!strings.Contains(connectionChanged.Body.String(), `"connectionId":"`+secondConnection.ID+`"`) ||
		!strings.Contains(connectionChanged.Body.String(), `"effectiveConnectionId":"`+secondConnection.ID+`"`) {
		testingObject.Fatalf(
			"change login connection = %d %s",
			connectionChanged.Code,
			connectionChanged.Body.String(),
		)
	}
	configurationConnectionChanged, _ := readWebProxyTestConfig(testingObject, server)
	if configurationConnectionChanged.Logins[0].ConnectionID != secondConnection.ID {
		testingObject.Fatalf(
			"changed runtime login = %+v",
			configurationConnectionChanged.Logins[0],
		)
	}

	invalidConnectionEdit := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"username":"living-room","connectionId":"vpc-ffffffffffffffff"}`,
		cookies,
		csrfToken,
	)
	if invalidConnectionEdit.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(invalidConnectionEdit.Body.String(), `"field":"connectionId"`) {
		testingObject.Fatalf(
			"invalid login connection edit = %d %s",
			invalidConnectionEdit.Code,
			invalidConnectionEdit.Body.String(),
		)
	}

	defaultedConnection := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"username":"living-room","connectionId":null}`,
		cookies,
		csrfToken,
	)
	if defaultedConnection.Code != http.StatusOK ||
		!strings.Contains(defaultedConnection.Body.String(), `"connectionId":null`) ||
		!strings.Contains(defaultedConnection.Body.String(), `"effectiveConnectionId":"`+defaultConnection.ID+`"`) {
		testingObject.Fatalf(
			"default login connection = %d %s",
			defaultedConnection.Code,
			defaultedConnection.Body.String(),
		)
	}

	passwordChanged := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		`{"regeneratePassword":true}`,
		cookies,
		csrfToken,
	)
	if passwordChanged.Code != http.StatusOK {
		testingObject.Fatalf("regenerate login password = %d %s", passwordChanged.Code, passwordChanged.Body.String())
	}
	var regeneratedCredential struct {
		Login    webProxyLoginResponse `json:"login"`
		Password string                `json:"password"`
	}
	if err := json.Unmarshal(passwordChanged.Body.Bytes(), &regeneratedCredential); err != nil {
		testingObject.Fatalf("decode regenerated login: %v", err)
	}
	if regeneratedCredential.Login.ID != createdLogin.ID ||
		regeneratedCredential.Password == "" ||
		regeneratedCredential.Password == createdCredential.Password {
		testingObject.Fatalf("regenerated login = %+v", regeneratedCredential)
	}
	storedRegeneratedLogin, err := server.store.FindWebProxyLogin(
		testingObject.Context(),
		createdLogin.ID,
	)
	if err != nil {
		testingObject.Fatalf("read regenerated web proxy login: %v", err)
	}
	configurationChanged, _ := readWebProxyTestConfig(testingObject, server)
	if storedRegeneratedLogin.PasswordHash == createdHash ||
		strings.Contains(storedRegeneratedLogin.PasswordHash, regeneratedCredential.Password) {
		testingObject.Fatal("replacement password was not safely rehashed")
	}
	if configurationChanged.Logins[0].PasswordHash != storedRegeneratedLogin.PasswordHash {
		testingObject.Fatal("runtime config did not receive the regenerated password verifier")
	}
	oldPasswordMatches, err := security.VerifyPassword(
		createdCredential.Password,
		storedRegeneratedLogin.PasswordHash,
	)
	if err != nil || oldPasswordMatches {
		testingObject.Fatalf("old web proxy password verification = %t, %v", oldPasswordMatches, err)
	}
	newPasswordMatches, err := security.VerifyPassword(
		regeneratedCredential.Password,
		storedRegeneratedLogin.PasswordHash,
	)
	if err != nil || !newPasswordMatches {
		testingObject.Fatalf("regenerated web proxy password verification = %t, %v", newPasswordMatches, err)
	}

	statusContent := []byte(`{"state":"listening","updatedAt":"2026-11-04T00:00:00Z"}`)
	if err := os.WriteFile(server.webProxyStatusPath, statusContent, 0o640); err != nil {
		testingObject.Fatalf("write proxy status: %v", err)
	}
	listed := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		cookies,
		"",
	)
	if listed.Code != http.StatusOK ||
		!strings.Contains(listed.Body.String(), `"state":"listening"`) ||
		strings.Contains(listed.Body.String(), "passwordHash") ||
		strings.Contains(listed.Body.String(), "$argon2id$") {
		testingObject.Fatalf("list proxy = %d %s", listed.Code, listed.Body.String())
	}

	statusContent = []byte(`{"state":"error","error":"listener failed","updatedAt":"2026-11-04T00:00:01Z"}`)
	if err := os.WriteFile(server.webProxyStatusPath, statusContent, 0o640); err != nil {
		testingObject.Fatalf("write proxy error status: %v", err)
	}
	errorStatus := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		cookies,
		"",
	)
	if errorStatus.Code != http.StatusOK ||
		!strings.Contains(errorStatus.Body.String(), `"state":"error"`) ||
		!strings.Contains(errorStatus.Body.String(), `"error":"listener failed"`) {
		testingObject.Fatalf("proxy error status = %d %s", errorStatus.Code, errorStatus.Body.String())
	}

	enabled := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy",
		`{"enabled":true}`,
		cookies,
		csrfToken,
	)
	if enabled.Code != http.StatusOK || !strings.Contains(enabled.Body.String(), `"enabled":true`) {
		testingObject.Fatalf("enable proxy = %d %s", enabled.Code, enabled.Body.String())
	}

	deleteLast := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/web-proxy/logins/"+createdLogin.ID,
		"",
		cookies,
		csrfToken,
	)
	if deleteLast.Code != http.StatusNoContent {
		testingObject.Fatalf("delete enabled final login = %d %s", deleteLast.Code, deleteLast.Body.String())
	}
	configurationEnabledWithoutLogin, _ = readWebProxyTestConfig(testingObject, server)
	if !configurationEnabledWithoutLogin.Enabled || len(configurationEnabledWithoutLogin.Logins) != 0 {
		testingObject.Fatalf("enabled runtime config after final login deletion = %+v", configurationEnabledWithoutLogin)
	}

	disabled := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/web-proxy",
		`{"enabled":false}`,
		cookies,
		csrfToken,
	)
	if disabled.Code != http.StatusOK || !strings.Contains(disabled.Body.String(), `"enabled":false`) {
		testingObject.Fatalf("disable proxy = %d %s", disabled.Code, disabled.Body.String())
	}

	configurationDeleted, _ := readWebProxyTestConfig(testingObject, server)
	if configurationDeleted.Enabled || len(configurationDeleted.Logins) != 0 {
		testingObject.Fatalf("deleted runtime config = %+v", configurationDeleted)
	}
}

// TestWebProxyLoginRequiresVPNConnection gives first-run setup guidance without field names.
//
// The same prerequisite blocks enabling but never blocks turning the proxy off.
//
// Since: UNRELEASED
func TestWebProxyLoginRequiresVPNConnection(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	legacyLogin, err := server.store.CreateWebProxyLogin(
		context.Background(),
		storage.WebProxyLogin{
			ID:           "wpl-0000000000000099",
			Username:     "legacy-client",
			PasswordHash: "legacy-hash",
		},
	)
	if err != nil {
		t.Fatalf("create legacy web proxy login: %v", err)
	}
	listed := performRequest(
		t,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		cookies,
		"",
	)
	if listed.Code != http.StatusOK ||
		!strings.Contains(listed.Body.String(), `"username":"legacy-client"`) ||
		!strings.Contains(listed.Body.String(), `"effectiveConnectionId":""`) {
		t.Fatalf("list legacy web proxy login = %d %s", listed.Code, listed.Body.String())
	}

	expectError(
		t,
		performRequest(
			t,
			server,
			http.MethodPost,
			"/api/v1/web-proxy/logins",
			`{"username":"laptop","connectionId":null}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"vpn_connection_required",
		"Add a VPN connection before adding a login.",
	)
	expectError(
		t,
		performRequest(
			t,
			server,
			http.MethodPut,
			"/api/v1/web-proxy",
			`{"enabled":true}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"vpn_connection_required",
		"Add a VPN connection before turning on the web proxy.",
	)

	disabled := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/web-proxy",
		`{"enabled":false}`,
		cookies,
		csrfToken,
	)
	if disabled.Code != http.StatusOK || !strings.Contains(disabled.Body.String(), `"enabled":false`) {
		t.Fatalf("disable web proxy without VPN = %d %s", disabled.Code, disabled.Body.String())
	}

	updated := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/web-proxy/logins/"+legacyLogin.ID,
		`{"username":"legacy-updated"}`,
		cookies,
		csrfToken,
	)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"username":"legacy-updated"`) {
		t.Fatalf("update legacy web proxy login = %d %s", updated.Code, updated.Body.String())
	}
	deleted := performRequest(
		t,
		server,
		http.MethodDelete,
		"/api/v1/web-proxy/logins/"+legacyLogin.ID,
		"",
		cookies,
		csrfToken,
	)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete legacy web proxy login = %d %s", deleted.Code, deleted.Body.String())
	}
}

// TestWebProxyPublishRetriesAfterSavedChange reconciles SQLite and the runtime file.
//
// The request reports that its committed login is waiting for publication, then the
// single background retry publishes that same durable snapshot after the writer heals.
func TestWebProxyPublishRetriesAfterSavedChange(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	defaultConnection, _ := createWebProxyVPNConnectionsForTest(
		testingObject,
		server,
		cookies,
		csrfToken,
	)
	originalPublisher := server.webProxyConfigPublisher
	server.webProxyRetryInterval = 10 * time.Millisecond
	var attempts atomic.Int32
	published := make(chan struct{})
	server.webProxyConfigPublisher = func(
		path string,
		configuration webProxyRuntimeConfig,
	) error {
		if attempts.Add(1) == 1 {
			return errors.New("test publisher unavailable")
		}

		if err := originalPublisher(path, configuration); err != nil {
			return err
		}
		close(published)

		return nil
	}

	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/web-proxy/logins",
		`{"username":"retry-client"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusInternalServerError ||
		!strings.Contains(response.Body.String(), "change was saved") ||
		!strings.Contains(response.Body.String(), "will be retried") {
		testingObject.Fatalf("deferred publish response %d: %s", response.Code, response.Body.String())
	}

	_, logins, err := server.store.WebProxyConfiguration(context.Background())
	if err != nil || len(logins) != 1 || logins[0].Username != "retry-client" {
		testingObject.Fatalf("saved login = %+v, %v", logins, err)
	}
	select {
	case <-published:
	case <-time.After(time.Second):
		testingObject.Fatal("web proxy configuration was not retried")
	}

	configuration, _ := readWebProxyTestConfig(testingObject, server)
	if len(configuration.Logins) != 1 || configuration.Logins[0].Username != "retry-client" ||
		configuration.Logins[0].ConnectionID != defaultConnection.ID {
		testingObject.Fatalf("retried runtime configuration = %+v", configuration)
	}
}

// TestWebProxyMissingConnectionFallsBackToDefault keeps legacy or externally
// corrupted login references from blocking both GET and runtime publication.
func TestWebProxyMissingConnectionFallsBackToDefault(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	defaultConnection, missingConnection := createWebProxyVPNConnectionsForTest(
		testingObject,
		server,
		cookies,
		csrfToken,
	)
	login, err := server.store.CreateWebProxyLogin(
		context.Background(),
		storage.WebProxyLogin{
			ID:           "wpl-0000000000000042",
			Username:     "legacy-route",
			PasswordHash: "test-hash",
			ConnectionID: &missingConnection.ID,
		},
	)
	if err != nil {
		testingObject.Fatalf("create legacy-routed login: %v", err)
	}
	if err := server.store.DeleteVPNConnection(
		context.Background(),
		missingConnection.ID,
	); err != nil {
		testingObject.Fatalf("remove referenced connection fixture: %v", err)
	}

	var logOutput bytes.Buffer
	server.logger = slog.New(slog.NewTextHandler(&logOutput, nil))
	response := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/web-proxy",
		"",
		cookies,
		"",
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"id":"`+login.ID+`"`) ||
		!strings.Contains(
			response.Body.String(),
			`"effectiveConnectionId":"`+defaultConnection.ID+`"`,
		) {
		testingObject.Fatalf("missing-route response = %d %s", response.Code, response.Body.String())
	}
	if err := server.writeWebProxyConfig(context.Background()); err != nil {
		testingObject.Fatalf("publish missing-route proxy config: %v", err)
	}
	configuration, _ := readWebProxyTestConfig(testingObject, server)
	if len(configuration.Logins) != 1 ||
		configuration.Logins[0].ConnectionID != defaultConnection.ID {
		testingObject.Fatalf("missing-route runtime config = %+v", configuration)
	}
	if !strings.Contains(logOutput.String(), "references a missing VPN connection") ||
		!strings.Contains(logOutput.String(), login.ID) {
		testingObject.Fatalf("missing-route warning = %q", logOutput.String())
	}
}

// createWebProxyVPNConnectionsForTest supplies the default and explicit login routes.
func createWebProxyVPNConnectionsForTest(
	testingObject *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
) (storage.EncryptedVPNConnection, storage.EncryptedVPNConnection) {
	testingObject.Helper()
	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	defaultConnection := createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Default proxy VPN",
		profileID,
		storage.DefaultVPNPeerPort,
	)
	secondConnection := createVPNConnectionForMultiTest(
		testingObject,
		server,
		secondTestConnectionID,
		"Second proxy VPN",
		profileID,
		storage.DefaultVPNPeerPort+1,
	)

	return defaultConnection, secondConnection
}

// readWebProxyTestConfig reads the test server's private runtime hand-off and mode.
func readWebProxyTestConfig(
	testingObject *testing.T,
	server *Server,
) (webProxyRuntimeConfig, os.FileMode) {
	testingObject.Helper()

	content, err := os.ReadFile(server.webProxyConfigPath)
	if err != nil {
		testingObject.Fatalf("read web proxy config: %v", err)
	}

	var configuration webProxyRuntimeConfig
	if err := json.Unmarshal(content, &configuration); err != nil {
		testingObject.Fatalf("decode web proxy config: %v", err)
	}

	information, err := os.Stat(server.webProxyConfigPath)
	if err != nil {
		testingObject.Fatalf("stat web proxy config: %v", err)
	}

	return configuration, information.Mode().Perm()
}
