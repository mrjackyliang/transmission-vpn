package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// testRPCLogin is the safe RPC login metadata returned by management routes.
type testRPCLogin struct {
	ID         string     `json:"id"`
	Username   string     `json:"username"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

// createTestRPCLogin creates a login through the browser route and returns its one-time
// password.
func createTestRPCLogin(
	testingObject *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	username string,
) (testRPCLogin, string) {
	testingObject.Helper()

	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/rpc/logins",
		`{"username":"`+username+`"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("create RPC login %q: %d %s", username, response.Code, response.Body.String())
	}

	var created struct {
		Login    testRPCLogin `json:"login"`
		Password string       `json:"password"`
	}
	decodeBody(testingObject, response, &created)

	return created.Login, created.Password
}

// TestRPCLoginRoutes covers session authorization, validation, CRUD, and one-time
// password disclosure.
//
// Browser sessions alone manage these credentials, every mutation requires CSRF, and
// neither lists nor ordinary edits can reveal a password or digest.
//
// Since: 2.0.0
func TestRPCLoginRoutes(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)

	expectError(
		testingObject,
		performRequest(testingObject, server, http.MethodGet, "/api/v1/rpc/logins", "", nil, ""),
		http.StatusUnauthorized,
		"authentication_required",
		"Sign in to continue.",
	)

	_, tokenValue := createTestToken(
		testingObject,
		server,
		cookies,
		csrfToken,
		`{"name":"RPC manager","scopes":["settings:write"]}`,
	)
	expectError(
		testingObject,
		bearerRequest(server, http.MethodGet, "/api/v1/rpc/logins", tokenValue),
		http.StatusForbidden,
		"session_required",
		"An administrator browser session is required.",
	)

	for _, testCase := range []struct {
		body    string
		message string
		field   string
	}{
		{`{}`, "Enter a username.", "username"},
		{`{"username":null}`, "Enter a username.", "username"},
		{`{"username":42}`, "Enter a username.", "username"},
		{`{"username":""}`, "Enter a username.", "username"},
		{`{"username":"bad space"}`, "Use 1 to 64 letters, numbers, periods, underscores, or hyphens.", "username"},
		{`{"username":"` + strings.Repeat("a", 65) + `"}`, "Use 1 to 64 letters, numbers, periods, underscores, or hyphens.", "username"},
		{`{"username":"desktop","password":"chosen"}`, "This field isn't accepted.", "password"},
	} {
		expectError(
			testingObject,
			performRequest(
				testingObject,
				server,
				http.MethodPost,
				"/api/v1/rpc/logins",
				testCase.body,
				cookies,
				csrfToken,
			),
			http.StatusUnprocessableEntity,
			"invalid_request",
			testCase.message,
			testCase.field,
		)
	}

	missingCreateCSRF := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/rpc/logins",
		`{"username":"desktop"}`,
		cookies,
		"",
	)
	if missingCreateCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("create RPC login without CSRF = %d", missingCreateCSRF.Code)
	}
	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPost,
			"/api/v1/rpc/logins",
			`{"username":"desktop"}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"vpn_connection_required",
		"Add a VPN connection before adding a login.",
	)
	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"RPC VPN",
		profileID,
		storage.DefaultVPNPeerPort,
	)

	first, firstPassword := createTestRPCLogin(
		testingObject,
		server,
		cookies,
		csrfToken,
		"Desktop.Client-1",
	)
	decodedPassword, err := base64.RawURLEncoding.DecodeString(firstPassword)
	if err != nil || len(decodedPassword) != 32 || strings.Contains(firstPassword, "=") {
		testingObject.Fatalf("generated RPC password %q decoded to %d bytes: %v", firstPassword, len(decodedPassword), err)
	}
	storedFirst, err := server.store.FindRPCLogin(context.Background(), first.ID)
	if err != nil || !security.DigestsEqual(storedFirst.SecretDigest, security.Digest(firstPassword)) {
		testingObject.Fatalf("stored RPC login digest = %+v, %v", storedFirst, err)
	}

	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPost,
			"/api/v1/rpc/logins",
			`{"username":"desktop.client-1"}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"rpc_login_exists",
		"An RPC login with this username already exists.",
		"username",
	)

	second, _ := createTestRPCLogin(
		testingObject,
		server,
		cookies,
		csrfToken,
		"phone",
	)
	enableRPC := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"rpc.compatibilityEnabled":true}}`,
		cookies,
		csrfToken,
	)
	if enableRPC.Code != http.StatusOK {
		testingObject.Fatalf("enable RPC proxy = %d %s", enableRPC.Code, enableRPC.Body.String())
	}

	listed := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/rpc/logins",
		"",
		cookies,
		"",
	)
	var listBody struct {
		Logins []testRPCLogin `json:"logins"`
	}
	decodeBody(testingObject, listed, &listBody)
	if listed.Code != http.StatusOK || len(listBody.Logins) != 2 ||
		strings.Contains(listed.Body.String(), firstPassword) ||
		strings.Contains(strings.ToLower(listed.Body.String()), "digest") ||
		strings.Contains(listed.Body.String(), `"password"`) {
		testingObject.Fatalf("list RPC logins = %d %s", listed.Code, listed.Body.String())
	}

	for _, testCase := range []struct {
		body    string
		message string
		fields  []string
	}{
		{`{}`, "Change the username or regenerate the password.", []string{"regeneratePassword"}},
		{`{"regeneratePassword":false}`, "Change the username or regenerate the password.", []string{"regeneratePassword"}},
		{`{"username":"bad space","regeneratePassword":"yes"}`, "Use 1 to 64 letters, numbers, periods, underscores, or hyphens.", []string{"username", "regeneratePassword"}},
		{`{"username":"desktop","password":"chosen"}`, "This field isn't accepted.", []string{"password"}},
	} {
		expectError(
			testingObject,
			performRequest(
				testingObject,
				server,
				http.MethodPut,
				"/api/v1/rpc/logins/"+first.ID,
				testCase.body,
				cookies,
				csrfToken,
			),
			http.StatusUnprocessableEntity,
			"invalid_request",
			testCase.message,
			testCase.fields...,
		)
	}

	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/rpc/logins/not-a-login",
			`{"username":"desktop"}`,
			cookies,
			csrfToken,
		),
		http.StatusNotFound,
		"rpc_login_not_found",
		"That RPC login no longer exists.",
	)

	missingUpdateCSRF := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/rpc/logins/"+first.ID,
		`{"username":"television"}`,
		cookies,
		"",
	)
	if missingUpdateCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("update RPC login without CSRF = %d", missingUpdateCSRF.Code)
	}

	renamed := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/rpc/logins/"+first.ID,
		`{"username":"television"}`,
		cookies,
		csrfToken,
	)
	var renamedBody struct {
		Login testRPCLogin `json:"login"`
	}
	decodeBody(testingObject, renamed, &renamedBody)
	if renamed.Code != http.StatusOK || renamedBody.Login.Username != "television" ||
		strings.Contains(renamed.Body.String(), `"password"`) {
		testingObject.Fatalf("rename RPC login = %d %s", renamed.Code, renamed.Body.String())
	}

	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/rpc/logins/"+first.ID,
			`{"username":"PHONE"}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"rpc_login_exists",
		"An RPC login with this username already exists.",
		"username",
	)

	regenerated := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/rpc/logins/"+first.ID,
		`{"regeneratePassword":true}`,
		cookies,
		csrfToken,
	)
	var regeneratedBody struct {
		Login    testRPCLogin `json:"login"`
		Password string       `json:"password"`
	}
	decodeBody(testingObject, regenerated, &regeneratedBody)
	if regenerated.Code != http.StatusOK || regeneratedBody.Login.Username != "television" ||
		regeneratedBody.Password == "" || regeneratedBody.Password == firstPassword {
		testingObject.Fatalf("regenerate RPC password = %d %s", regenerated.Code, regenerated.Body.String())
	}
	storedFirst, err = server.store.FindRPCLogin(context.Background(), first.ID)
	if err != nil || !security.DigestsEqual(
		storedFirst.SecretDigest,
		security.Digest(regeneratedBody.Password),
	) {
		testingObject.Fatalf("regenerated RPC login digest = %+v, %v", storedFirst, err)
	}

	listed = performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/rpc/logins",
		"",
		cookies,
		"",
	)
	if strings.Contains(listed.Body.String(), firstPassword) ||
		strings.Contains(listed.Body.String(), regeneratedBody.Password) ||
		strings.Contains(strings.ToLower(listed.Body.String()), "digest") ||
		strings.Contains(listed.Body.String(), `"password"`) {
		testingObject.Fatalf("listed RPC secrets = %s", listed.Body.String())
	}

	missingDeleteCSRF := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/rpc/logins/"+first.ID,
		"",
		cookies,
		"",
	)
	if missingDeleteCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("delete RPC login without CSRF = %d", missingDeleteCSRF.Code)
	}

	deleted := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/rpc/logins/"+first.ID,
		"",
		cookies,
		csrfToken,
	)
	if deleted.Code != http.StatusNoContent {
		testingObject.Fatalf("delete RPC login = %d %s", deleted.Code, deleted.Body.String())
	}

	for _, id := range []string{first.ID, "not-a-login"} {
		expectError(
			testingObject,
			performRequest(
				testingObject,
				server,
				http.MethodDelete,
				"/api/v1/rpc/logins/"+id,
				"",
				cookies,
				csrfToken,
			),
			http.StatusNotFound,
			"rpc_login_not_found",
			"That RPC login no longer exists.",
		)
	}

	remaining, err := server.store.FindRPCLogin(context.Background(), second.ID)
	if err != nil || remaining.Username != "phone" {
		testingObject.Fatalf("remaining RPC login = %+v, %v", remaining, err)
	}
	deleted = performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/rpc/logins/"+second.ID,
		"",
		cookies,
		csrfToken,
	)
	if deleted.Code != http.StatusNoContent {
		testingObject.Fatalf("delete enabled final RPC login = %d %s", deleted.Code, deleted.Body.String())
	}
}
