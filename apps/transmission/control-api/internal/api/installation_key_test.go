package api

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// newKeyTestServer builds an API server on an existing store with the given key.
func newKeyTestServer(t *testing.T, store *storage.Store, key []byte) *Server {
	t.Helper()

	runtimeDirectory := filepath.Join(t.TempDir(), "runtime")
	prepareRuntimeMarkers(t, runtimeDirectory)

	server, err := NewServer(Config{
		Store:            store,
		Registry:         settings.NewRegistry(),
		InstallationKey:  key,
		DirectoryBrowser: testDirectoryBrowser{},
		RuntimeDirectory: runtimeDirectory,
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Version:          "test",
	})
	if err != nil {
		t.Fatalf("create API server: %v", err)
	}
	t.Cleanup(server.Close)

	return server
}

// TestPrepareInstallationKeyReplacesAMissingKey checks that a lost key costs only what
// it sealed: VPN connection details and the authenticator, each listed for the web
// interface until it is entered again or dismissed.
func TestPrepareInstallationKeyReplacesAMissingKey(t *testing.T) {
	ctx := context.Background()
	temporaryDirectory := t.TempDir()
	keyPath := filepath.Join(temporaryDirectory, "keys", "installation.key")

	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	first, err := PrepareInstallationKey(ctx, store, keyPath)
	if err != nil || !first.Created || len(first.Removed) != 0 {
		t.Fatalf("first start = %+v, %v", first, err)
	}

	if err := store.ReplaceSetupClaim(ctx, security.Digest("ABCDE-23456-FGHIJ"), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("store setup claim: %v", err)
	}

	server := newKeyTestServer(t, store, first.Key)
	claim := performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ABCDE-23456-FGHIJ","username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if claim.Code != http.StatusCreated {
		t.Fatalf("claim status %d: %s", claim.Code, claim.Body.String())
	}
	cookies := claim.Result().Cookies()
	csrfToken := cookieValue(t, cookies, "tvpn_csrf")

	setup := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/setup", `{"password":"`+testPassword+`"}`, cookies, csrfToken)
	var setupBody struct {
		Secret string `json:"secret"`
	}
	decodeBody(t, setup, &setupBody)
	enableCode, _ := security.TOTPCode(setupBody.Secret, security.TOTPStep(time.Now()))
	enable := performRequest(t, server, http.MethodPost, "/api/v1/auth/totp/enable", `{"code":"`+enableCode+`"}`, cookies, csrfToken)
	if enable.Code != http.StatusOK {
		t.Fatalf("totp enable status %d: %s", enable.Code, enable.Body.String())
	}

	profileID := "custom:office:0123456789ab"
	nonce, ciphertext, err := security.EncryptSecret(first.Key, "vpn/profile/"+profileID, []byte("client\nremote vpn.example.com 1194\n"))
	if err != nil {
		t.Fatalf("seal VPN profile: %v", err)
	}
	if err := store.UpsertCustomVPNProfile(ctx, storage.EncryptedVPNProfile{
		ID:          profileID,
		ProviderID:  "custom",
		Tunnel:      "openvpn",
		DisplayName: "Office",
		Protocol:    "udp",
		RemoteHost:  "vpn.example.com",
		RemotePort:  1194,
		Fingerprint: "0123456789abcdef",
		Source:      "upload",
		Nonce:       nonce,
		Ciphertext:  ciphertext,
	}); err != nil {
		t.Fatalf("store VPN profile: %v", err)
	}
	connectionID, err := storage.NewVPNConnectionID()
	if err != nil {
		t.Fatalf("generate VPN connection ID: %v", err)
	}
	credentialNonce, credentialCiphertext, err := security.EncryptSecret(
		first.Key,
		"vpn/connection/"+connectionID,
		[]byte(`{"username":"alice","password":"secret"}`),
	)
	if err != nil {
		t.Fatalf("seal VPN credentials: %v", err)
	}
	if _, err := store.CreateVPNConnection(ctx, storage.EncryptedVPNConnection{
		ID:                    connectionID,
		Name:                  "Office",
		Enabled:               true,
		ProviderID:            "custom",
		Tunnel:                "openvpn",
		ProfileIDs:            []string{profileID},
		EndpointStrategy:      "sticky",
		CredentialsNonce:      credentialNonce,
		CredentialsCiphertext: credentialCiphertext,
		DNSServers:            []string{},
		RetryIntervalSeconds:  10,
		PeerPort:              storage.DefaultVPNPeerPort,
	}); err != nil {
		t.Fatalf("store VPN connection: %v", err)
	}

	if err := os.Remove(keyPath); err != nil {
		t.Fatalf("remove installation key: %v", err)
	}

	replaced, err := PrepareInstallationKey(ctx, store, keyPath)
	if err != nil {
		t.Fatalf("replace installation key: %v", err)
	}
	if !replaced.Created || bytes.Equal(replaced.Key, first.Key) {
		t.Fatal("a missing key did not get a new key")
	}
	if strings.Join(replaced.Removed, "|") != "the VPN details for each connection|the authenticator app for administrator" {
		t.Fatalf("removed = %q", replaced.Removed)
	}

	savedKey, found, err := security.LoadInstallationKey(keyPath)
	if err != nil || !found || !bytes.Equal(savedKey, replaced.Key) {
		t.Fatalf("saved key found %v, error %v", found, err)
	}

	profiles, err := store.ListVPNProfiles(ctx, "custom", "")
	if err != nil || len(profiles) != 0 {
		t.Fatalf("VPN profiles after replacement = %d, %v", len(profiles), err)
	}
	preservedConnection, err := store.DefaultVPNConnection(ctx)
	if err != nil || preservedConnection.ID != connectionID || preservedConnection.Enabled ||
		len(preservedConnection.ProfileIDs) != 0 ||
		len(preservedConnection.CredentialsNonce) != 0 ||
		len(preservedConnection.CredentialsCiphertext) != 0 {
		t.Fatalf("VPN connection after replacement = %+v, %v", preservedConnection, err)
	}

	restarted := newKeyTestServer(t, store, replaced.Key)
	me := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/me", "", cookies, "")
	if me.Code != http.StatusOK {
		t.Fatalf("me status %d: %s", me.Code, me.Body.String())
	}
	status := performRequest(t, restarted, http.MethodGet, "/api/v1/status", "", cookies, "")
	if status.Code != http.StatusOK ||
		!strings.Contains(status.Body.String(), `"protectionState":"setup-required"`) {
		t.Fatalf("status after replacement %d: %s", status.Code, status.Body.String())
	}
	var meBody struct {
		RemovedSecrets []struct {
			Kind      string    `json:"kind"`
			RemovedAt time.Time `json:"removedAt"`
		} `json:"removedSecrets"`
	}
	decodeBody(t, me, &meBody)
	if len(meBody.RemovedSecrets) != 2 || meBody.RemovedSecrets[0].Kind != "authenticator" || meBody.RemovedSecrets[1].Kind != "vpn" || meBody.RemovedSecrets[0].RemovedAt.IsZero() {
		t.Fatalf("removed secrets = %s", me.Body.String())
	}

	accountSecurity := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/security", "", cookies, "")
	if !strings.Contains(accountSecurity.Body.String(), `"totpEnabled":false`) {
		t.Fatalf("authenticator still on after replacement: %s", accountSecurity.Body.String())
	}

	login := performRequest(t, restarted, http.MethodPost, "/api/v1/auth/login",
		`{"username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if login.Code != http.StatusOK || login.Header().Get("Set-Cookie") == "" {
		t.Fatalf("password sign-in after replacement %d: %s", login.Code, login.Body.String())
	}

	if dismiss := performRequest(t, restarted, http.MethodDelete, "/api/v1/auth/removed-secrets", "", cookies, ""); dismiss.Code != http.StatusForbidden {
		t.Fatalf("dismiss without CSRF status %d", dismiss.Code)
	}
	if dismiss := performRequest(t, restarted, http.MethodDelete, "/api/v1/auth/removed-secrets", "", cookies, csrfToken); dismiss.Code != http.StatusNoContent {
		t.Fatalf("dismiss status %d: %s", dismiss.Code, dismiss.Body.String())
	}

	afterDismiss := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/me", "", cookies, "")
	if !strings.Contains(afterDismiss.Body.String(), `"removedSecrets":[]`) {
		t.Fatalf("removed secrets after dismiss: %s", afterDismiss.Body.String())
	}

	again, err := PrepareInstallationKey(ctx, store, keyPath)
	if err != nil || again.Created || len(again.Removed) != 0 || !bytes.Equal(again.Key, replaced.Key) {
		t.Fatalf("restart with the new key = %+v, %v", again, err)
	}
}

// TestPrepareInstallationKeyStopsOnAKeyFromAnotherDatabase checks that a key file that
// can't open the saved secrets stops startup instead of removing them.
func TestPrepareInstallationKeyStopsOnAKeyFromAnotherDatabase(t *testing.T) {
	ctx := context.Background()
	temporaryDirectory := t.TempDir()
	keyPath := filepath.Join(temporaryDirectory, "keys", "installation.key")

	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	if _, err := PrepareInstallationKey(ctx, store, keyPath); err != nil {
		t.Fatalf("first start: %v", err)
	}

	otherKey, err := security.GenerateInstallationKey()
	if err != nil {
		t.Fatalf("generate other key: %v", err)
	}
	if err := os.WriteFile(keyPath, otherKey, 0o600); err != nil {
		t.Fatalf("write other key: %v", err)
	}

	if _, err := PrepareInstallationKey(ctx, store, keyPath); err == nil || !strings.Contains(err.Error(), "doesn't belong to this database") {
		t.Fatalf("a key from another database = %v", err)
	}

	if err := os.WriteFile(keyPath, []byte("short"), 0o600); err != nil {
		t.Fatalf("write damaged key: %v", err)
	}

	if _, err := PrepareInstallationKey(ctx, store, keyPath); err == nil || !strings.Contains(err.Error(), "exactly 32 bytes") {
		t.Fatalf("a damaged key = %v", err)
	}
}
