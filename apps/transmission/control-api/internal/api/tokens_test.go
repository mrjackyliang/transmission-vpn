package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

// testToken is one token as the API returns it.
type testToken struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Scopes     []string `json:"scopes"`
	ExpiresAt  *string  `json:"expiresAt"`
	CreatedAt  string   `json:"createdAt"`
	LastUsedAt *string  `json:"lastUsedAt"`
}

// createTestToken creates a token the way the console does and returns it with its
// one-time value.
func createTestToken(
	t *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	body string,
) (testToken, string) {
	t.Helper()

	response := performRequest(t, server, http.MethodPost, "/api/v1/auth/tokens", body, cookies, csrfToken)
	if response.Code != http.StatusCreated {
		t.Fatalf("create token %s: %d %s", body, response.Code, response.Body.String())
	}

	var created struct {
		Token     testToken `json:"token"`
		Plaintext string    `json:"plaintext"`
	}
	decodeBody(t, response, &created)

	return created.Token, created.Plaintext
}

// updateTestToken edits a token and returns the token object from the response.
func updateTestToken(
	t *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	tokenID string,
	body string,
) testToken {
	t.Helper()

	response := performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/"+tokenID, body, cookies, csrfToken)
	if response.Code != http.StatusOK {
		t.Fatalf("edit token %s: %d %s", body, response.Code, response.Body.String())
	}

	var token testToken
	decodeBody(t, response, &token)

	return token
}

// listTestTokens returns the token list, which never mentions revocation any more.
func listTestTokens(t *testing.T, server *Server, cookies []*http.Cookie) []testToken {
	t.Helper()

	response := performRequest(t, server, http.MethodGet, "/api/v1/auth/tokens", "", cookies, "")
	if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "revokedAt") {
		t.Fatalf("token list: %d %s", response.Code, response.Body.String())
	}

	var list struct {
		Items []testToken `json:"items"`
	}
	decodeBody(t, response, &list)

	return list.Items
}

// bearerRequest sends one request with a token instead of a browser session.
func bearerRequest(server *Server, method string, path string, plaintext string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Authorization", "Bearer "+plaintext)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)

	return response
}

// futureTime returns an expiry the API accepts, as ISO 8601 in UTC.
func futureTime(offset time.Duration) string {
	return time.Now().Add(offset).UTC().Format(time.RFC3339)
}

// TestTokenFieldIssues checks each token field's messages, which match pfsense-actions.
func TestTokenFieldIssues(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	cases := []struct {
		body    string
		message string
		fields  []string
	}{
		{`{"name":"","scopes":[]}`, "Name this token.", []string{"name", "scopes"}},
		{`{"scopes":["vpn:read"]}`, "Name this token.", []string{"name"}},
		{`{"name":null,"scopes":["vpn:read"]}`, "Name this token.", []string{"name"}},
		{`{"name":42,"scopes":["vpn:read"]}`, "Name this token.", []string{"name"}},
		{`{"name":"   ","scopes":["vpn:read"]}`, "Name this token.", []string{"name"}},
		{`{"name":"` + strings.Repeat("é", 81) + `","scopes":["vpn:read"]}`, "Use 80 characters or fewer.", []string{"name"}},
		{`{"name":"Script"}`, "Choose at least one scope.", []string{"scopes"}},
		{`{"name":"Script","scopes":"vpn:read"}`, "Choose at least one scope.", []string{"scopes"}},
		{`{"name":"Script","scopes":["transmission:write"]}`, "Choose from: torrents:read, torrents:write, vpn:read, vpn:write, settings:read, settings:write.", []string{"scopes"}},
		{`{"name":"Script","scopes":[7]}`, "Choose from: torrents:read, torrents:write, vpn:read, vpn:write, settings:read, settings:write.", []string{"scopes"}},
		{`{"name":"Script","scopes":["vpn:read","vpn:read"]}`, "Choose each scope only once.", []string{"scopes"}},
		{`{"name":"Script","scopes":["vpn:read"],"expiresAt":"2030-01-01"}`, "Use an ISO 8601 date and time with a time zone, like 2030-01-01T00:00:00Z.", []string{"expiresAt"}},
		{`{"name":"Script","scopes":["vpn:read"],"expiresAt":"2030-01-01T00:00:00"}`, "Use an ISO 8601 date and time with a time zone, like 2030-01-01T00:00:00Z.", []string{"expiresAt"}},
		{`{"name":"Script","scopes":["vpn:read"],"expiresAt":1893456000}`, "Use an ISO 8601 date and time with a time zone, like 2030-01-01T00:00:00Z.", []string{"expiresAt"}},
		{`{"name":"Script","scopes":["vpn:read"],"expiresAt":"2020-01-01T00:00:00Z"}`, "Choose an expiration date in the future.", []string{"expiresAt"}},
		{`{"name":"Script","scopes":["vpn:read"],"expiresInDays":30}`, "This field isn't accepted.", []string{"expiresInDays"}},
	}

	for _, testCase := range cases {
		expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/tokens", testCase.body, cookies, csrfToken),
			http.StatusUnprocessableEntity, "invalid_request", testCase.message, testCase.fields...)
	}

	token, _ := createTestToken(t, server, cookies, csrfToken,
		`{"name":"  `+strings.Repeat("é", 80)+`  ","scopes":["torrents:write"]}`)
	if token.Name != strings.Repeat("é", 80) {
		t.Fatalf("a name is trimmed and counted in characters, got %q", token.Name)
	}
	if strings.Join(token.Scopes, ",") != "torrents:read,torrents:write" || token.ExpiresAt != nil || token.LastUsedAt != nil {
		t.Fatalf("a write scope adds its read scope, and no expiry means never: %+v", token)
	}

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/"+token.ID,
		`{"name":"","scopes":["vpn:read"],"expiresAt":"soon"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Name this token.", "name", "expiresAt")

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/missing",
		`{"name":"Script","scopes":["vpn:read"]}`, cookies, csrfToken),
		http.StatusNotFound, "token_not_found", "That token no longer exists.")

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/"+strings.Repeat("a", 65),
		`{"name":"","scopes":[]}`, cookies, csrfToken),
		http.StatusNotFound, "token_not_found", "That token no longer exists.")
}

// TestTokenLifecycle creates, edits, and revokes tokens, and checks what each change
// does to the token's value.
func TestTokenLifecycle(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	board, boardValue := createTestToken(t, server, cookies, csrfToken, `{"name":"Status board","scopes":["vpn:read"]}`)
	remoteExpiry := futureTime(48 * time.Hour)
	remote, remoteValue := createTestToken(t, server, cookies, csrfToken,
		`{"name":"Transmission Remote","scopes":["torrents:write"],"expiresAt":"`+remoteExpiry+`"}`)
	if remote.ExpiresAt == nil || !sameInstant(t, *remote.ExpiresAt, remoteExpiry) {
		t.Fatalf("the new token should expire when asked: %+v", remote)
	}

	if tokens := listTestTokens(t, server, cookies); len(tokens) != 2 || tokens[0].ID != remote.ID || tokens[1].ID != board.ID {
		t.Fatalf("tokens should be listed newest first: %+v", tokens)
	}

	me := bearerRequest(server, http.MethodGet, "/api/v1/auth/me", boardValue)
	var principalBody map[string]any
	decodeBody(t, me, &principalBody)
	keys := make([]string, 0, len(principalBody))
	for key := range principalBody {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	if me.Code != http.StatusOK || strings.Join(keys, ",") != "authenticationType,id,name,scopes" ||
		principalBody["authenticationType"] != "token" || principalBody["id"] != board.ID || principalBody["name"] != "Status board" {
		t.Fatalf("a token caller should see its id, name and scopes: %d %s", me.Code, me.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/auth/tokens",
		`{"name":"status BOARD","scopes":["vpn:read"]}`, cookies, csrfToken),
		http.StatusConflict, "token_exists", "A token with this name already exists.", "name")

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/"+board.ID,
		`{"name":"TRANSMISSION REMOTE","scopes":["vpn:read"]}`, cookies, csrfToken),
		http.StatusConflict, "token_exists", "A token with this name already exists.", "name")

	expectError(t, bearerRequest(server, http.MethodGet, "/api/v1/settings", boardValue),
		http.StatusForbidden, "scope_required", "This token doesn't have the settings:read scope.")

	board = updateTestToken(t, server, cookies, csrfToken, board.ID, `{"name":"status board","scopes":["vpn:read","settings:read"]}`)
	if board.Name != "status board" || strings.Join(board.Scopes, ",") != "settings:read,vpn:read" || board.ExpiresAt != nil {
		t.Fatalf("a token can keep its own name in another letter case and change its scopes: %+v", board)
	}

	if settings := bearerRequest(server, http.MethodGet, "/api/v1/settings", boardValue); settings.Code != http.StatusOK {
		t.Fatalf("the same token value should get the new scope at once: %d %s", settings.Code, settings.Body.String())
	}

	remote = updateTestToken(t, server, cookies, csrfToken, remote.ID, `{"name":"Transmission Remote on iPhone","scopes":["torrents:write"]}`)
	if remote.Name != "Transmission Remote on iPhone" || remote.ExpiresAt == nil || !sameInstant(t, *remote.ExpiresAt, remoteExpiry) {
		t.Fatalf("leaving out expiresAt should keep the expiry: %+v", remote)
	}

	remote = updateTestToken(t, server, cookies, csrfToken, remote.ID, `{"name":"Transmission Remote on iPhone","scopes":["torrents:write"],"expiresAt":null}`)
	if remote.ExpiresAt != nil {
		t.Fatalf("expiresAt null should remove the expiry: %+v", remote)
	}

	laterExpiry := futureTime(90 * 24 * time.Hour)
	remote = updateTestToken(t, server, cookies, csrfToken, remote.ID,
		`{"name":"Transmission Remote on iPhone","scopes":["torrents:write"],"expiresAt":"`+laterExpiry+`"}`)
	if remote.ExpiresAt == nil || !sameInstant(t, *remote.ExpiresAt, laterExpiry) {
		t.Fatalf("a new expiresAt should replace the expiry: %+v", remote)
	}

	if response := performRequest(t, server, http.MethodDelete, "/api/v1/auth/tokens/"+board.ID, "", cookies, csrfToken); response.Code != http.StatusNoContent {
		t.Fatalf("revoke token: %d %s", response.Code, response.Body.String())
	}

	expectError(t, bearerRequest(server, http.MethodGet, "/api/v1/auth/me", boardValue),
		http.StatusUnauthorized, "authentication_required", "Sign in, or send a valid API token.")

	if me := bearerRequest(server, http.MethodGet, "/api/v1/auth/me", remoteValue); me.Code != http.StatusOK {
		t.Fatalf("revoking one token should leave the others working: %d %s", me.Code, me.Body.String())
	}

	if tokens := listTestTokens(t, server, cookies); len(tokens) != 1 || tokens[0].ID != remote.ID {
		t.Fatalf("a revoked token should leave the list: %+v", tokens)
	}

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/auth/tokens/"+board.ID,
		`{"name":"Status board","scopes":["vpn:read"]}`, cookies, csrfToken),
		http.StatusNotFound, "token_not_found", "That token no longer exists.")

	expectError(t, performRequest(t, server, http.MethodDelete, "/api/v1/auth/tokens/"+board.ID, "", cookies, csrfToken),
		http.StatusNotFound, "token_not_found", "That token no longer exists.")

	if renamed, _ := createTestToken(t, server, cookies, csrfToken, `{"name":"Status board","scopes":["vpn:read"]}`); renamed.ID == board.ID {
		t.Fatalf("a revoked token's name should be free again with a new identifier: %+v", renamed)
	}
}

// TestExpiredTokenStaysListed checks that an expired token stops working but stays in
// the list, where it can be given a new expiry or revoked.
func TestExpiredTokenStaysListed(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	expiredAt := time.Now().Add(-time.Hour)
	if _, err := server.store.CreateAPIToken(
		context.Background(),
		"expired-token",
		1,
		"Old script",
		security.Digest("tvpn_expired_test_token"),
		[]string{"vpn:read"},
		&expiredAt,
	); err != nil {
		t.Fatalf("create expired token: %v", err)
	}

	expectError(t, bearerRequest(server, http.MethodGet, "/api/v1/auth/me", "tvpn_expired_test_token"),
		http.StatusUnauthorized, "authentication_required", "Sign in, or send a valid API token.")

	if tokens := listTestTokens(t, server, cookies); len(tokens) != 1 || tokens[0].ExpiresAt == nil {
		t.Fatalf("an expired token should stay listed with its expiry: %+v", tokens)
	}

	updateTestToken(t, server, cookies, csrfToken, "expired-token", `{"name":"Old script","scopes":["vpn:read"],"expiresAt":"`+futureTime(time.Hour)+`"}`)

	if me := bearerRequest(server, http.MethodGet, "/api/v1/auth/me", "tvpn_expired_test_token"); me.Code != http.StatusOK {
		t.Fatalf("a new expiry should let the same value work again: %d %s", me.Code, me.Body.String())
	}
}

// sameInstant reports whether two ISO 8601 times are the same moment.
func sameInstant(t *testing.T, left string, right string) bool {
	t.Helper()

	leftTime, leftError := time.Parse(time.RFC3339Nano, left)
	rightTime, rightError := time.Parse(time.RFC3339Nano, right)
	if leftError != nil || rightError != nil {
		t.Fatalf("parse times %q and %q", left, right)
	}

	return leftTime.Equal(rightTime)
}
