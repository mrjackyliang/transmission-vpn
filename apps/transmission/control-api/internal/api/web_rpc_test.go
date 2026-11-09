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

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestWebInterfaceAndCompatibleRPC verifies the single-port browser and client boundary.
//
// Static navigation remains separate from machine routes, while compatible native RPC
// access stays disabled until explicitly enabled and always requires its own login.
func TestWebInterfaceAndCompatibleRPC(testingObject *testing.T) {
	ctx := context.Background()
	temporaryDirectory := testingObject.TempDir()
	runtimeDirectory := filepath.Join(temporaryDirectory, "runtime")
	prepareRuntimeMarkers(testingObject, runtimeDirectory)

	webDirectory := filepath.Join(temporaryDirectory, "web")
	if err := os.MkdirAll(filepath.Join(webDirectory, "assets"), 0o755); err != nil {
		testingObject.Fatalf("create web directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(webDirectory, "index.html"),
		[]byte("<!doctype html><title>Transmission VPN</title><main>application shell</main>"),
		0o644,
	); err != nil {
		testingObject.Fatalf("write web index: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(webDirectory, "assets", "application.js"),
		[]byte("globalThis.transmissionVPN = true;"),
		0o644,
	); err != nil {
		testingObject.Fatalf("write web asset: %v", err)
	}

	_, transmission := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "session-get" {
			return map[string]any{"rpc-version": 17, "version": "test"}
		}

		return map[string]any{}
	})

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
	administrator, err := store.ClaimInstallation(
		ctx,
		security.Digest(claimCode),
		"administrator",
		"unused-test-password-hash",
	)
	if err != nil {
		testingObject.Fatalf("claim test installation: %v", err)
	}

	const rpcLoginID = "rpl-0000000000000001"
	const rpcUsername = "desktop-client"
	const rpcPassword = "p7PCx_HlwQD9xX7fBTxD-zPa3_5BU5gkU9dmxwB2YhM"
	if _, err := store.CreateRPCLogin(ctx, storage.RPCLogin{
		ID:           rpcLoginID,
		Username:     rpcUsername,
		SecretDigest: security.Digest(rpcPassword),
	}); err != nil {
		testingObject.Fatalf("create compatible RPC login: %v", err)
	}

	const rpcToken = "tvpn_test_compatible_rpc_token"
	if _, err := store.CreateAPIToken(
		ctx,
		"compatible-rpc-token",
		administrator.ID,
		"compatible client",
		security.Digest(rpcToken),
		[]string{"torrents:read", "torrents:write"},
		nil,
	); err != nil {
		testingObject.Fatalf("create compatible RPC token: %v", err)
	}

	registry := settings.NewRegistry()
	server, err := NewServer(Config{
		Store:            store,
		Registry:         registry,
		InstallationKey:  make([]byte, 32),
		RuntimeDirectory: runtimeDirectory,
		Transmission:     transmission,
		WebDirectory:     webDirectory,
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Version:          "test",
	})
	if err != nil {
		testingObject.Fatalf("create API server: %v", err)
	}
	defer server.Close()

	rootResponse := performRequest(testingObject, server, http.MethodGet, "/", "", nil, "")
	if rootResponse.Code != http.StatusOK ||
		!strings.Contains(rootResponse.Body.String(), "application shell") {
		testingObject.Fatalf("root response %d: %s", rootResponse.Code, rootResponse.Body.String())
	}

	deepPaths := []string{
		"/torrents",
		"/vpn",
		"/vpn/new",
		"/vpn/vpn-0000000000000001",
		"/remote-apps",
		"/settings",
		"/notifications",
		"/account",
		"/not-a-console-page",
	}
	for _, deepPath := range deepPaths {
		fallbackResponse := performRequest(
			testingObject,
			server,
			http.MethodGet,
			deepPath,
			"",
			nil,
			"",
		)
		if fallbackResponse.Code != http.StatusOK ||
			!strings.Contains(fallbackResponse.Body.String(), "application shell") {
			testingObject.Fatalf(
				"history fallback response for %q = %d: %s",
				deepPath,
				fallbackResponse.Code,
				fallbackResponse.Body.String(),
			)
		}
	}

	assetResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/assets/application.js",
		"",
		nil,
		"",
	)
	if assetResponse.Code != http.StatusOK ||
		!strings.Contains(assetResponse.Body.String(), "transmissionVPN") ||
		assetResponse.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		testingObject.Fatalf("asset response %d: %s", assetResponse.Code, assetResponse.Body.String())
	}

	missingAPIResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/not-a-route",
		"",
		nil,
		"",
	)
	if missingAPIResponse.Code != http.StatusNotFound ||
		!strings.Contains(missingAPIResponse.Body.String(), `"code":"not_found"`) {
		testingObject.Fatalf(
			"missing API response %d: %s",
			missingAPIResponse.Code,
			missingAPIResponse.Body.String(),
		)
	}

	disabledRPCResponse := performRequest(
		testingObject,
		server.RPCHandler(),
		http.MethodPost,
		"/transmission/rpc",
		`{"method":"session-get"}`,
		nil,
		"",
	)
	if disabledRPCResponse.Code != http.StatusUnauthorized {
		testingObject.Fatalf("disabled unauthenticated RPC status = %d, want 401", disabledRPCResponse.Code)
	}
	if disabledRPCResponse.Header().Get("WWW-Authenticate") == "" ||
		disabledRPCResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatal("disabled RPC did not authenticate before the compatibility gate")
	}
	disabledWrongPasswordRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	disabledWrongPasswordRequest.SetBasicAuth(rpcUsername, "wrong-password")
	disabledWrongPasswordResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(disabledWrongPasswordResponse, disabledWrongPasswordRequest)
	if disabledWrongPasswordResponse.Code != http.StatusUnauthorized ||
		disabledWrongPasswordResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatalf(
			"disabled wrong-password RPC response %d: %s",
			disabledWrongPasswordResponse.Code,
			disabledWrongPasswordResponse.Body.String(),
		)
	}
	disabledAuthenticatedRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	disabledAuthenticatedRequest.SetBasicAuth(rpcUsername, rpcPassword)
	disabledAuthenticatedResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(disabledAuthenticatedResponse, disabledAuthenticatedRequest)
	if disabledAuthenticatedResponse.Code != http.StatusForbidden ||
		disabledAuthenticatedResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatalf(
			"disabled authenticated RPC response %d: %s",
			disabledAuthenticatedResponse.Code,
			disabledAuthenticatedResponse.Body.String(),
		)
	}
	const rpcProfileID = "custom:rpc:123456789abc"
	if err := store.UpsertCustomVPNProfile(ctx, storage.EncryptedVPNProfile{
		ID:          rpcProfileID,
		ProviderID:  "custom",
		Tunnel:      "wireguard",
		DisplayName: "RPC route",
		Protocol:    "udp",
		RemoteHost:  "vpn.example.test",
		RemotePort:  51_820,
		Fingerprint: "123456789abcdef",
		Source:      "upload",
		Nonce:       []byte("nonce-value"),
		Ciphertext:  []byte("encrypted-profile"),
	}); err != nil {
		testingObject.Fatalf("store compatible RPC VPN profile: %v", err)
	}
	createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Compatible RPC VPN",
		rpcProfileID,
		storage.DefaultVPNPeerPort,
	)

	if _, err := store.UpdateSettings(
		ctx,
		registry,
		0,
		storage.SettingChanges{
			"rpc.compatibilityEnabled": json.RawMessage("true"),
		},
		"test",
	); err != nil {
		testingObject.Fatalf("enable compatible RPC: %v", err)
	}
	server.rpcCompatibilityAllowed.Store(true)

	for attempt := 0; attempt < rpcSignInAttemptLimit+2; attempt++ {
		unauthenticatedRequest := httptest.NewRequest(
			http.MethodPost,
			"/transmission/rpc",
			strings.NewReader(`{"method":"session-get"}`),
		)
		unauthenticatedRequest.RemoteAddr = "192.168.1.70:4000"
		unauthenticatedRPCResponse := httptest.NewRecorder()
		server.RPCHandler().ServeHTTP(unauthenticatedRPCResponse, unauthenticatedRequest)
		if unauthenticatedRPCResponse.Code != http.StatusUnauthorized ||
			unauthenticatedRPCResponse.Header().Get("WWW-Authenticate") == "" ||
			unauthenticatedRPCResponse.Header().Get("X-Transmission-Session-Id") != "" {
			testingObject.Fatalf(
				"unauthenticated RPC response %d: %s",
				unauthenticatedRPCResponse.Code,
				unauthenticatedRPCResponse.Body.String(),
			)
		}
	}
	challengeFollowup := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	challengeFollowup.RemoteAddr = "192.168.1.70:4000"
	challengeFollowup.SetBasicAuth(rpcUsername, rpcPassword)
	challengeFollowupResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(challengeFollowupResponse, challengeFollowup)
	if challengeFollowupResponse.Code != http.StatusConflict {
		testingObject.Fatalf(
			"credential-less challenges consumed the limiter: %d %s",
			challengeFollowupResponse.Code,
			challengeFollowupResponse.Body.String(),
		)
	}

	wrongPasswordRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	wrongPasswordRequest.RemoteAddr = "198.51.100.10:4000"
	wrongPasswordRequest.SetBasicAuth(rpcUsername, "wrong-password")
	wrongPasswordResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(wrongPasswordResponse, wrongPasswordRequest)
	if wrongPasswordResponse.Code != http.StatusUnauthorized ||
		wrongPasswordResponse.Header().Get("WWW-Authenticate") == "" ||
		wrongPasswordResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatalf(
			"wrong RPC password response %d: %s",
			wrongPasswordResponse.Code,
			wrongPasswordResponse.Body.String(),
		)
	}

	unknownUsernameRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	unknownUsernameRequest.RemoteAddr = "198.51.100.11:4000"
	unknownUsernameRequest.SetBasicAuth("unknown-client", rpcPassword)
	unknownUsernameResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(unknownUsernameResponse, unknownUsernameRequest)
	if unknownUsernameResponse.Code != http.StatusUnauthorized ||
		unknownUsernameResponse.Header().Get("WWW-Authenticate") == "" ||
		unknownUsernameResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatalf(
			"unknown RPC username response %d: %s",
			unknownUsernameResponse.Code,
			unknownUsernameResponse.Body.String(),
		)
	}

	apiTokenRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	apiTokenRequest.RemoteAddr = "198.51.100.12:4000"
	apiTokenRequest.SetBasicAuth(rpcUsername, rpcToken)
	apiTokenResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(apiTokenResponse, apiTokenRequest)
	if apiTokenResponse.Code != http.StatusUnauthorized ||
		apiTokenResponse.Header().Get("X-Transmission-Session-Id") != "" {
		testingObject.Fatalf(
			"API token on RPC response %d: %s",
			apiTokenResponse.Code,
			apiTokenResponse.Body.String(),
		)
	}

	rpcRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	rpcRequest.Host = "transmission-vpn:9091"
	rpcRequest.SetBasicAuth(rpcUsername, rpcPassword)
	rpcRequest.AddCookie(&http.Cookie{Name: "tvpn_session", Value: "must-not-leak"})
	rpcResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(rpcResponse, rpcRequest)
	if rpcResponse.Code != http.StatusConflict {
		testingObject.Fatalf("proxied RPC status = %d, want 409", rpcResponse.Code)
	}
	sessionID := rpcResponse.Header().Get("X-Transmission-Session-Id")
	if sessionID == "" {
		testingObject.Fatal("facade handshake omitted its session identifier")
	}
	rpcRequest = httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get","tag":4}`),
	)
	rpcRequest.SetBasicAuth(rpcUsername, rpcPassword)
	rpcRequest.Header.Set("X-Transmission-Session-Id", sessionID)
	rpcResponse = httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(rpcResponse, rpcRequest)
	if rpcResponse.Code != http.StatusOK ||
		!strings.Contains(rpcResponse.Body.String(), `"rpc-version":17`) ||
		!strings.Contains(rpcResponse.Body.String(), `"tag":4`) {
		testingObject.Fatalf("facade session-get response %d: %s", rpcResponse.Code, rpcResponse.Body.String())
	}
	jsonRPCRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"jsonrpc":"2.0","method":"session-get","id":1}`),
	)
	jsonRPCRequest.SetBasicAuth(rpcUsername, rpcPassword)
	jsonRPCRequest.Header.Set("X-Transmission-Session-Id", sessionID)
	jsonRPCResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(jsonRPCResponse, jsonRPCRequest)
	if jsonRPCResponse.Code != http.StatusOK ||
		!strings.Contains(jsonRPCResponse.Body.String(), "JSON-RPC 2.0 is not supported by transmission-vpn") {
		testingObject.Fatalf(
			"JSON-RPC rejection %d: %s",
			jsonRPCResponse.Code,
			jsonRPCResponse.Body.String(),
		)
	}
	usedLogin, err := store.FindRPCLogin(ctx, rpcLoginID)
	if err != nil || usedLogin.LastUsedAt == nil {
		testingObject.Fatalf("used RPC login = %+v, %v", usedLogin, err)
	}

	rpcPasswordAsBearer := bearerRequest(
		server,
		http.MethodGet,
		"/api/v1/status",
		rpcPassword,
	)
	if rpcPasswordAsBearer.Code != http.StatusUnauthorized {
		testingObject.Fatalf(
			"RPC password as API bearer response %d: %s",
			rpcPasswordAsBearer.Code,
			rpcPasswordAsBearer.Body.String(),
		)
	}

	for attempt := 1; attempt <= rpcSignInAttemptLimit; attempt++ {
		limitedRequest := httptest.NewRequest(
			http.MethodPost,
			"/transmission/rpc",
			strings.NewReader(`{"method":"session-get"}`),
		)
		limitedRequest.RemoteAddr = "192.168.1.50:4000"
		limitedRequest.Header.Set("X-Forwarded-For", "192.168.1.60")
		limitedRequest.SetBasicAuth(rpcUsername, "wrong-password")
		limitedResponse := httptest.NewRecorder()
		server.RPCHandler().ServeHTTP(limitedResponse, limitedRequest)
		if limitedResponse.Code != http.StatusUnauthorized {
			testingObject.Fatalf(
				"RPC failure %d status = %d, want 401: %s",
				attempt,
				limitedResponse.Code,
				limitedResponse.Body.String(),
			)
		}
	}

	limitedRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	limitedRequest.RemoteAddr = "192.168.1.50:4000"
	limitedRequest.Header.Set("X-Forwarded-For", "192.168.1.61")
	limitedRequest.SetBasicAuth(rpcUsername, "wrong-password")
	limitedResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(limitedResponse, limitedRequest)
	retryAfter, retryError := strconv.Atoi(limitedResponse.Header().Get("Retry-After"))
	if limitedResponse.Code != http.StatusTooManyRequests || retryError != nil ||
		retryAfter < 1 || retryAfter > int(rpcSignInAttemptWindow.Seconds()) {
		testingObject.Fatalf(
			"limited RPC response %d retry %q: %s",
			limitedResponse.Code,
			limitedResponse.Header().Get("Retry-After"),
			limitedResponse.Body.String(),
		)
	}
	missingAfterLimit := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	missingAfterLimit.RemoteAddr = "192.168.1.50:4000"
	missingAfterLimitResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(missingAfterLimitResponse, missingAfterLimit)
	if missingAfterLimitResponse.Code != http.StatusUnauthorized ||
		missingAfterLimitResponse.Header().Get("WWW-Authenticate") == "" {
		testingObject.Fatalf(
			"credential-less limited-peer challenge %d: %s",
			missingAfterLimitResponse.Code,
			missingAfterLimitResponse.Body.String(),
		)
	}

	victimRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	victimRequest.RemoteAddr = "192.168.1.60:4000"
	victimRequest.SetBasicAuth(rpcUsername, rpcPassword)
	victimResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(victimResponse, victimRequest)
	if victimResponse.Code != http.StatusConflict {
		testingObject.Fatalf(
			"spoofed forwarded address limited its victim: %d %s",
			victimResponse.Code,
			victimResponse.Body.String(),
		)
	}

	controlPortRPCRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	controlPortRPCRequest.SetBasicAuth(rpcUsername, rpcPassword)
	controlPortRPCResponse := httptest.NewRecorder()
	server.ServeHTTP(controlPortRPCResponse, controlPortRPCRequest)
	if controlPortRPCResponse.Code != http.StatusMethodNotAllowed {
		testingObject.Fatalf("control port RPC status = %d, want 405", controlPortRPCResponse.Code)
	}

	rpcPortAPIResponse := performRequest(
		testingObject,
		server.RPCHandler(),
		http.MethodGet,
		"/api/v1/health/live",
		"",
		nil,
		"",
	)
	if rpcPortAPIResponse.Code != http.StatusNotFound ||
		!strings.Contains(rpcPortAPIResponse.Body.String(), `"code":"not_found"`) {
		testingObject.Fatalf(
			"RPC port API response %d: %s",
			rpcPortAPIResponse.Code,
			rpcPortAPIResponse.Body.String(),
		)
	}

	if err := store.DeleteRPCLogin(ctx, rpcLoginID); err != nil {
		testingObject.Fatalf("revoke enabled compatible RPC login: %v", err)
	}

	zeroLoginRPCRequest := httptest.NewRequest(
		http.MethodPost,
		"/transmission/rpc",
		strings.NewReader(`{"method":"session-get"}`),
	)
	zeroLoginRPCRequest.RemoteAddr = "198.51.100.60:4000"
	zeroLoginRPCRequest.SetBasicAuth(rpcUsername, rpcPassword)
	zeroLoginRPCResponse := httptest.NewRecorder()
	server.RPCHandler().ServeHTTP(zeroLoginRPCResponse, zeroLoginRPCRequest)
	if zeroLoginRPCResponse.Code != wrongPasswordResponse.Code ||
		zeroLoginRPCResponse.Header().Get("WWW-Authenticate") != wrongPasswordResponse.Header().Get("WWW-Authenticate") ||
		zeroLoginRPCResponse.Header().Get("X-Transmission-Session-Id") != "" ||
		zeroLoginRPCResponse.Body.String() != wrongPasswordResponse.Body.String() {
		testingObject.Fatalf(
			"zero-login RPC response %d: %s",
			zeroLoginRPCResponse.Code,
			zeroLoginRPCResponse.Body.String(),
		)
	}
}
