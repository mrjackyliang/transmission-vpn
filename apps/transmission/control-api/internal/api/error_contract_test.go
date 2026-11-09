package api

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

// errorResponse is the shared { error: { code, message, issues } } envelope.
type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Issues  []struct {
			Field   string   `json:"field"`
			Path    []string `json:"path"`
			Message string   `json:"message"`
		} `json:"issues"`
	} `json:"error"`
}

// expectError checks the status, code and message of one failed response, and the
// issue fields in order when any are given.
func expectError(
	t *testing.T,
	response *httptest.ResponseRecorder,
	status int,
	code string,
	message string,
	fields ...string,
) {
	t.Helper()

	var body errorResponse
	decodeBody(t, response, &body)
	if response.Code != status || body.Error.Code != code || body.Error.Message != message {
		t.Fatalf("want %d %s %q, got %d: %s", status, code, message, response.Code, response.Body.String())
	}

	if len(fields) == 0 {
		return
	}

	if len(body.Error.Issues) != len(fields) {
		t.Fatalf("want issues on %v, got %s", fields, response.Body.String())
	}

	for index, field := range fields {
		issue := body.Error.Issues[index]
		if issue.Field != field || len(issue.Path) == 0 || issue.Message == "" {
			t.Fatalf("want an issue on %s, got %s", field, response.Body.String())
		}
	}
}

// TestSharedErrorContract checks the codes and messages tv shares with
// pfsense-actions for the same situations.
func TestSharedErrorContract(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login", `{bad`, nil, ""),
		http.StatusBadRequest, "invalid_json", "The request body is not valid JSON.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"`+testPassword+`","remember":true}`, nil, ""),
		http.StatusUnprocessableEntity, "invalid_request", "This field isn't accepted.", "remember")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"`+strings.Repeat("a", int(maximumRequestBytes))+`","password":"x"}`, nil, ""),
		http.StatusRequestEntityTooLarge, "payload_too_large", "The request body is larger than 1 MB.")

	expectError(t, performRequest(t, server, http.MethodGet, "/api/v1/nothing-here", "", nil, ""),
		http.StatusNotFound, "not_found", "No route matches this request.")

	expectError(t, performRequest(t, server, http.MethodGet, "/api/v1/auth/security", "", nil, ""),
		http.StatusUnauthorized, "authentication_required", "Sign in to continue.")

	expectError(t, performRequest(t, server, http.MethodGet, "/api/v1/status", "", nil, ""),
		http.StatusUnauthorized, "authentication_required", "Sign in, or send a valid API token.")

	created := performRequest(t, server, http.MethodPost, "/api/v1/auth/tokens",
		`{"name":"status board","scopes":["vpn:read"]}`, cookies, csrfToken)
	var createdBody struct {
		Plaintext string `json:"plaintext"`
	}
	decodeBody(t, created, &createdBody)

	bearerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil)
	bearerRequest.Header.Set("Authorization", "Bearer "+createdBody.Plaintext)
	bearerResponse := httptest.NewRecorder()
	server.ServeHTTP(bearerResponse, bearerRequest)
	expectError(t, bearerResponse, http.StatusForbidden, "scope_required", "This token doesn't have the settings:read scope.")

	expectError(t, performRequest(t, server, http.MethodDelete, "/api/v1/auth/tokens/missing", "", cookies, csrfToken),
		http.StatusNotFound, "token_not_found", "That token no longer exists.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login", `{"username":"","password":""}`, nil, ""),
		http.StatusUnprocessableEntity, "invalid_request", "Enter your username.", "username", "password")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"wrong password"}`, nil, ""),
		http.StatusUnauthorized, "credentials_invalid", "The username or password is incorrect.")

	if login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"ADMINISTRATOR","password":"`+testPassword+`"}`, nil, ""); login.Code != http.StatusOK {
		t.Fatalf("usernames should match without regard to case, got %d: %s", login.Code, login.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login/second-factor", `{"challenge":"x","code":" "}`, nil, ""),
		http.StatusUnprocessableEntity, "invalid_request", "Enter the code from your authenticator app, or a recovery code.", "code")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/login/second-factor", `{"challenge":"x","code":"123456"}`, nil, ""),
		http.StatusUnauthorized, "challenge_expired", "Your sign-in timed out. Enter your password again.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/password",
		`{"currentPassword":"","newPassword":"short"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter your current password.", "currentPassword", "newPassword")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":""}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter your password.", "password")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"wrong password"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "password_incorrect", "That password is incorrect.", "password")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/disable", `{"password":"`+testPassword+`"}`, cookies, csrfToken),
		http.StatusConflict, "totp_disabled", "The authenticator app is already off.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/recovery-codes", `{"password":"`+testPassword+`"}`, cookies, csrfToken),
		http.StatusConflict, "totp_disabled", "Turn on the authenticator app first.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"12"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter the 6-digit code from your app.", "code")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"123456"}`, cookies, csrfToken),
		http.StatusConflict, "totp_setup_expired", "Authenticator setup expired. Start again.")

	setup := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"`+testPassword+`"}`, cookies, csrfToken)
	var setupBody struct {
		Secret string `json:"secret"`
	}
	decodeBody(t, setup, &setupBody)

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"000000"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "code_invalid", "That code doesn't match. Check the time on your device and try again.", "code")

	enableCode, _ := security.TOTPCode(setupBody.Secret, security.TOTPStep(time.Now()))
	if enable := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"`+enableCode+`"}`, cookies, csrfToken); enable.Code != http.StatusOK {
		t.Fatalf("totp enable status %d: %s", enable.Code, enable.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"`+testPassword+`"}`, cookies, csrfToken),
		http.StatusConflict, "totp_enabled", "The authenticator app is already on.")

	expectError(t, performRequest(t, server, http.MethodDelete, "/api/v1/auth/passkeys/"+strings.Repeat("a", 513),
		`{"password":"`+testPassword+`"}`, cookies, csrfToken),
		http.StatusNotFound, "passkey_not_found", "That passkey no longer exists.")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/register/options",
		`{"name":"","password":""}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Name this passkey.", "name", "password")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/login/options", "", nil, ""),
		http.StatusConflict, "passkeys_unavailable", "Passkeys need https and a domain name. Open this page at its domain, or use your password.")
}

// TestRateLimitedResponsesSayWhenToRetry checks that a limited client gets the shared
// message and a Retry-After header.
func TestRateLimitedResponsesSayWhenToRetry(t *testing.T) {
	server, _, _ := newClaimedTestServer(t)

	for range signInAttemptLimit {
		performRequest(t, server, http.MethodPost, "/api/v1/auth/login", `{"username":"administrator","password":"wrong password"}`, nil, "")
	}

	limited := performRequest(t, server, http.MethodPost, "/api/v1/auth/login", `{"username":"administrator","password":"wrong password"}`, nil, "")
	expectError(t, limited, http.StatusTooManyRequests, "rate_limited", "Too many sign-in attempts. Try again in 15 minutes.")

	retryAfter, err := strconv.Atoi(limited.Header().Get("Retry-After"))
	if err != nil || retryAfter < 1 || retryAfter > int(signInAttemptWindow.Seconds()) {
		t.Fatalf("Retry-After should give the seconds left in the window, got %q", limited.Header().Get("Retry-After"))
	}
}

// TestSetupClaimContract checks first-run setup: the checks run in the same order as
// pfsense-actions, and a generated code works however it's typed.
func TestSetupClaimContract(t *testing.T) {
	server := newUnclaimedTestServer(t, "ABCDE-FGHJK-LMNPQ", false)

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"","username":"ab","password":"short"}`, nil, ""),
		http.StatusUnprocessableEntity, "invalid_request", "Enter the setup code from the container log.", "claimCode", "username", "password")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ZZZZZ-ZZZZZ-ZZZZZ","username":"administrator","password":"`+testPassword+`"}`, nil, ""),
		http.StatusUnauthorized, "claim_invalid", "That setup code is wrong or expired. Restart the container to print a new one.", "claimCode")

	claim := performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":" abcde fghjk lmnpq ","username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if claim.Code != http.StatusCreated {
		t.Fatalf("a lowercase code without dashes should be accepted, got %d: %s", claim.Code, claim.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ABCDE-FGHJK-LMNPQ","username":"administrator","password":"`+testPassword+`"}`, nil, ""),
		http.StatusConflict, "claim_unavailable", "Setup is already complete. Sign in instead.")
}

// TestMountedSetupCodeMatchesExactly keeps a mounted secret exact, even one shaped like
// a generated code.
func TestMountedSetupCodeMatchesExactly(t *testing.T) {
	server := newUnclaimedTestServer(t, "abcde-fghjk-lmnpq", true)

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ABCDE-FGHJK-LMNPQ","username":"administrator","password":"`+testPassword+`"}`, nil, ""),
		http.StatusUnauthorized, "claim_invalid", "That setup code is wrong or expired. Restart the container to print a new one.", "claimCode")

	claim := performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"abcde-fghjk-lmnpq","username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if claim.Code != http.StatusCreated {
		t.Fatalf("the mounted secret typed exactly should be accepted, got %d: %s", claim.Code, claim.Body.String())
	}
}

// TestChangeUsername renames the administrator after a password check. tv allows one
// administrator, so another account can never hold the new name.
func TestChangeUsername(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/username",
		`{"username":"x","password":""}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter your password.", "password", "username")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/username",
		`{"username":"_hidden","password":"`+testPassword+`"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Use 3 to 64 letters, numbers, periods, underscores, or hyphens, starting with a letter or number.", "username")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/username",
		`{"username":"operator","password":"wrong password"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "password_incorrect", "That password is incorrect.", "password")

	changed := performRequest(t, server, http.MethodPost, "/api/v1/auth/username",
		`{"username":"operator","password":"`+testPassword+`"}`, cookies, csrfToken)
	if changed.Code != http.StatusOK || !strings.Contains(changed.Body.String(), `"username":"operator"`) {
		t.Fatalf("username change status %d: %s", changed.Code, changed.Body.String())
	}

	if me := performRequest(t, server, http.MethodGet, "/api/v1/auth/me", "", cookies, ""); me.Code != http.StatusOK ||
		!strings.Contains(me.Body.String(), `"username":"operator"`) {
		t.Fatalf("the session should stay signed in with the new name: %d %s", me.Code, me.Body.String())
	}

	if login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"`+testPassword+`"}`, nil, ""); login.Code != http.StatusUnauthorized {
		t.Fatalf("the old username should stop working, got %d", login.Code)
	}

	if login := performRequest(t, server, http.MethodPost, "/api/v1/auth/login",
		`{"username":"Operator","password":"`+testPassword+`"}`, nil, ""); login.Code != http.StatusOK {
		t.Fatalf("the new username should sign in in any letter case, got %d", login.Code)
	}

	if recased := performRequest(t, server, http.MethodPost, "/api/v1/auth/username",
		`{"username":"OPERATOR","password":"`+testPassword+`"}`, cookies, csrfToken); recased.Code != http.StatusOK {
		t.Fatalf("changing only the letter case of your own name should work, got %d: %s", recased.Code, recased.Body.String())
	}
}
