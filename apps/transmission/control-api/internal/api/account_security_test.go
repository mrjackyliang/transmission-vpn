package api

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const testPassword = "a secure local password"

// newClaimedTestServer returns a server whose installation is already claimed, plus
// the claiming browser session's cookies and CSRF token.
func newClaimedTestServer(t *testing.T) (*Server, []*http.Cookie, string) {
	t.Helper()

	server := newUnclaimedTestServer(t, "ABCDE-23456-FGHIJ", false)

	claim := performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ABCDE-23456-FGHIJ","username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if claim.Code != http.StatusCreated {
		t.Fatalf("claim status %d: %s", claim.Code, claim.Body.String())
	}

	cookies := claim.Result().Cookies()

	return server, cookies, cookieValue(t, cookies, "tvpn_csrf")
}

// newUnclaimedTestServer returns a server still waiting for its first administrator,
// with claimCode as the active setup code, generated or mounted.
func newUnclaimedTestServer(t *testing.T, claimCode string, mountedSetupCode bool) *Server {
	t.Helper()

	ctx := context.Background()
	temporaryDirectory := t.TempDir()
	runtimeDirectory := filepath.Join(temporaryDirectory, "runtime")
	prepareRuntimeMarkers(t, runtimeDirectory)

	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	if err := store.ReplaceSetupClaim(ctx, security.Digest(claimCode), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("store setup claim: %v", err)
	}

	server, err := NewServer(Config{
		Store:            store,
		Registry:         settings.NewRegistry(),
		InstallationKey:  make([]byte, 32),
		DirectoryBrowser: testDirectoryBrowser{},
		RuntimeDirectory: runtimeDirectory,
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Version:          "test",
		MountedSetupCode: mountedSetupCode,
	})
	if err != nil {
		t.Fatalf("create API server: %v", err)
	}
	t.Cleanup(server.Close)

	return server
}

// decodeBody unmarshals a JSON response or fails the test.
func decodeBody(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()

	if err := json.Unmarshal(response.Body.Bytes(), target); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
}

func TestTOTPSignInWithRecoveryCodesAndReplayProtection(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	setupWrong := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"wrong password"}`, cookies, csrfToken)
	if setupWrong.Code != http.StatusUnprocessableEntity || !strings.Contains(setupWrong.Body.String(), `"field":"password"`) {
		t.Fatalf("totp setup with a wrong password status %d: %s", setupWrong.Code, setupWrong.Body.String())
	}

	setup := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"`+testPassword+`"}`, cookies, csrfToken)
	if setup.Code != http.StatusOK {
		t.Fatalf("totp setup status %d: %s", setup.Code, setup.Body.String())
	}

	var setupBody struct {
		Secret string `json:"secret"`
		URI    string `json:"uri"`
		QRCode string `json:"qrCode"`
	}
	decodeBody(t, setup, &setupBody)
	if setupBody.Secret == "" || !strings.HasPrefix(setupBody.URI, "otpauth://totp/") || !strings.HasPrefix(setupBody.QRCode, "data:image/svg+xml;base64,") {
		t.Fatalf("unexpected totp setup body: %s", setup.Body.String())
	}

	wrongCode := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"000000"}`, cookies, csrfToken)
	if wrongCode.Code != http.StatusUnprocessableEntity || !strings.Contains(wrongCode.Body.String(), `"field":"code"`) {
		t.Fatalf("wrong enable code status %d: %s", wrongCode.Code, wrongCode.Body.String())
	}

	currentStep := security.TOTPStep(time.Now())
	enableCode, _ := security.TOTPCode(setupBody.Secret, currentStep)
	enable := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"`+enableCode+`"}`, cookies, csrfToken)
	if enable.Code != http.StatusOK {
		t.Fatalf("totp enable status %d: %s", enable.Code, enable.Body.String())
	}

	var enableBody struct {
		RecoveryCodes []string `json:"recoveryCodes"`
	}
	decodeBody(t, enable, &enableBody)
	if len(enableBody.RecoveryCodes) != 10 {
		t.Fatalf("expected 10 recovery codes, got %d", len(enableBody.RecoveryCodes))
	}

	signIn := func() string {
		t.Helper()

		login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
			`{"username":"administrator","password":"`+testPassword+`"}`, nil, "")
		if login.Code != http.StatusOK || login.Header().Get("Set-Cookie") != "" {
			t.Fatalf("password step should not issue a session: %d %s", login.Code, login.Body.String())
		}

		var loginBody struct {
			Status    string `json:"status"`
			Challenge string `json:"challenge"`
		}
		decodeBody(t, login, &loginBody)
		if loginBody.Status != "second_factor_required" || loginBody.Challenge == "" {
			t.Fatalf("expected a second-factor challenge: %s", login.Body.String())
		}

		return loginBody.Challenge
	}

	secondFactor := func(challenge string, code string) *httptest.ResponseRecorder {
		t.Helper()

		return performRequest(t, server, http.MethodPost, "/api/v1/auth/login/second-factor",
			`{"challenge":"`+challenge+`","code":"`+code+`"}`, nil, "")
	}

	challenge := signIn()
	if response := secondFactor(challenge, "123456"); response.Code != http.StatusUnauthorized {
		t.Fatalf("wrong code status %d: %s", response.Code, response.Body.String())
	}

	// The enable step used the current code, so the next step's code is the only fresh one.
	nextCode, _ := security.TOTPCode(setupBody.Secret, currentStep+1)
	accepted := secondFactor(challenge, nextCode)
	if accepted.Code != http.StatusOK || cookieValue(t, accepted.Result().Cookies(), "tvpn_session") == "" {
		t.Fatalf("valid code status %d: %s", accepted.Code, accepted.Body.String())
	}

	if replay := secondFactor(signIn(), nextCode); replay.Code != http.StatusUnauthorized {
		t.Fatalf("replayed code status %d, want 401", replay.Code)
	}

	recoveryCode := strings.ToLower(enableBody.RecoveryCodes[0])
	if recovered := secondFactor(signIn(), recoveryCode); recovered.Code != http.StatusOK {
		t.Fatalf("recovery code status %d: %s", recovered.Code, recovered.Body.String())
	}

	if reused := secondFactor(signIn(), recoveryCode); reused.Code != http.StatusUnauthorized {
		t.Fatalf("reused recovery code status %d, want 401", reused.Code)
	}

	security := performRequest(t, server, http.MethodGet, "/api/v1/auth/security", "", cookies, "")
	if !strings.Contains(security.Body.String(), `"totpEnabled":true`) || !strings.Contains(security.Body.String(), `"recoveryCodesRemaining":9`) {
		t.Fatalf("unexpected security body: %s", security.Body.String())
	}

	disableWrong := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/disable", `{"password":"wrong password"}`, cookies, csrfToken)
	if disableWrong.Code != http.StatusUnprocessableEntity {
		t.Fatalf("disable with wrong password status %d", disableWrong.Code)
	}

	disable := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/disable", `{"password":"`+testPassword+`"}`, cookies, csrfToken)
	if disable.Code != http.StatusNoContent {
		t.Fatalf("disable status %d: %s", disable.Code, disable.Body.String())
	}

	login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if !strings.Contains(login.Body.String(), `"status":"authenticated"`) {
		t.Fatalf("login after disabling the authenticator should finish at once: %s", login.Body.String())
	}
}

func TestChangePasswordSignsOutOtherSessions(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	other := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"`+testPassword+`"}`, nil, "")
	otherCookies := other.Result().Cookies()

	wrong := performRequest(t, server, http.MethodPost, "/api/v1/auth/password",
		`{"currentPassword":"not it","newPassword":"a brand new password"}`, cookies, csrfToken)
	if wrong.Code != http.StatusUnprocessableEntity || !strings.Contains(wrong.Body.String(), `"field":"currentPassword"`) {
		t.Fatalf("wrong current password status %d: %s", wrong.Code, wrong.Body.String())
	}

	short := performRequest(t, server, http.MethodPost, "/api/v1/auth/password",
		`{"currentPassword":"`+testPassword+`","newPassword":"short"}`, cookies, csrfToken)
	if short.Code != http.StatusUnprocessableEntity || !strings.Contains(short.Body.String(), `"field":"newPassword"`) {
		t.Fatalf("short new password status %d: %s", short.Code, short.Body.String())
	}

	changed := performRequest(t, server, http.MethodPost, "/api/v1/auth/password",
		`{"currentPassword":"`+testPassword+`","newPassword":"a brand new password"}`, cookies, csrfToken)
	if changed.Code != http.StatusNoContent {
		t.Fatalf("password change status %d: %s", changed.Code, changed.Body.String())
	}

	if response := performRequest(t, server, http.MethodGet, "/api/v1/auth/me", "", cookies, ""); response.Code != http.StatusOK {
		t.Fatalf("the session that changed the password should stay signed in, got %d", response.Code)
	}

	if response := performRequest(t, server, http.MethodGet, "/api/v1/auth/me", "", otherCookies, ""); response.Code != http.StatusUnauthorized {
		t.Fatalf("other sessions should be signed out, got %d", response.Code)
	}

	login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"a brand new password"}`, nil, "")
	if login.Code != http.StatusOK {
		t.Fatalf("login with the new password status %d", login.Code)
	}
}

func TestSignInLimitAndProxyClientAddress(t *testing.T) {
	server, _, _ := newClaimedTestServer(t)

	attempt := func(forwardedFor string) int {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
			strings.NewReader(`{"username":"administrator","password":"wrong password"}`))
		request.RemoteAddr = "172.18.0.5:41000"
		request.Header.Set("X-Forwarded-For", forwardedFor)
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)

		return response.Code
	}

	for range signInAttemptLimit {
		if code := attempt("203.0.113.7"); code != http.StatusUnauthorized {
			t.Fatalf("failed sign-in status %d, want 401", code)
		}
	}

	if code := attempt("203.0.113.7"); code != http.StatusTooManyRequests {
		t.Fatalf("eleventh attempt status %d, want 429", code)
	}

	if code := attempt("198.51.100.20"); code != http.StatusUnauthorized {
		t.Fatalf("a different visitor behind the same proxy should not be limited, got %d", code)
	}
}

func TestPasskeyCeremoniesNeedASecureDomain(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	plain := performRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/login/options", "", nil, "")
	if plain.Code != http.StatusConflict || !strings.Contains(plain.Body.String(), "passkeys_unavailable") {
		t.Fatalf("passkeys on plain http status %d: %s", plain.Code, plain.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "https://torrents.example.com/api/v1/auth/passkeys/login/options", nil)
	request.TLS = &tls.ConnectionState{}
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("passkey login options status %d: %s", response.Code, response.Body.String())
	}

	var loginOptions struct {
		CeremonyID string `json:"ceremonyId"`
		Options    struct {
			Challenge string `json:"challenge"`
			RPID      string `json:"rpId"`
		} `json:"options"`
	}
	decodeBody(t, response, &loginOptions)
	if loginOptions.CeremonyID == "" || loginOptions.Options.Challenge == "" || loginOptions.Options.RPID != "torrents.example.com" {
		t.Fatalf("unexpected passkey login options: %s", response.Body.String())
	}

	register := func(body string) *httptest.ResponseRecorder {
		t.Helper()

		registration := httptest.NewRequest(http.MethodPost, "https://torrents.example.com/api/v1/auth/passkeys/register/options", strings.NewReader(body))
		registration.TLS = &tls.ConnectionState{}
		registration.Header.Set("X-CSRF-Token", csrfToken)
		for _, cookie := range cookies {
			registration.AddCookie(cookie)
		}
		registrationResponse := httptest.NewRecorder()
		server.ServeHTTP(registrationResponse, registration)

		return registrationResponse
	}

	wrongPassword := register(`{"name":"Laptop","password":"wrong password"}`)
	if wrongPassword.Code != http.StatusUnprocessableEntity || !strings.Contains(wrongPassword.Body.String(), `"field":"password"`) {
		t.Fatalf("passkey registration with a wrong password status %d: %s", wrongPassword.Code, wrongPassword.Body.String())
	}

	unnamed := register(`{"name":" ","password":"` + testPassword + `"}`)
	if unnamed.Code != http.StatusUnprocessableEntity || !strings.Contains(unnamed.Body.String(), `"field":"name"`) {
		t.Fatalf("passkey registration without a name status %d: %s", unnamed.Code, unnamed.Body.String())
	}

	registrationResponse := register(`{"name":"Laptop","password":"` + testPassword + `"}`)
	if registrationResponse.Code != http.StatusOK || !strings.Contains(registrationResponse.Body.String(), `"residentKey":"required"`) {
		t.Fatalf("passkey registration options status %d: %s", registrationResponse.Code, registrationResponse.Body.String())
	}

	stale := performRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/register/verify",
		`{"ceremonyId":"missing","name":"Laptop","credential":{}}`, cookies, csrfToken)
	if stale.Code != http.StatusConflict {
		t.Fatalf("unknown ceremony status %d: %s", stale.Code, stale.Body.String())
	}
}
