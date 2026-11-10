package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

// failedCatalogLookup returns the error chain a catalog download produces when the
// container can't resolve the source host.
func failedCatalogLookup(host string) error {
	return fmt.Errorf("download VPN catalog: %w", &url.Error{
		Op:  "Get",
		URL: "https://" + host + "/catalog.zip",
		Err: &net.OpError{
			Op:  "dial",
			Net: "tcp",
			Err: &net.DNSError{
				Err:         "server misbehaving",
				Name:        host,
				Server:      "127.0.0.11:53",
				IsTemporary: true,
			},
		},
	})
}

// skipCatalogRetryPauses makes catalog lookup retries run without waiting for the
// rest of the test.
func skipCatalogRetryPauses(t *testing.T) {
	t.Helper()

	previousDelay := catalogLookupRetryDelay
	catalogLookupRetryDelay = 0
	t.Cleanup(func() { catalogLookupRetryDelay = previousDelay })
}

// TestCatalogDownloadRetriesFailedLookups checks which download failures are tried
// again, and how many times.
func TestCatalogDownloadRetriesFailedLookups(t *testing.T) {
	skipCatalogRetryPauses(t)

	lookupFailure := failedCatalogLookup("www.privateinternetaccess.com")
	tests := []struct {
		name         string
		failures     []error
		cancelOnCall int
		wantCalls    int
		wantContent  bool
		wantLookup   bool
	}{
		{
			name:        "a lookup that fails twice, then works",
			failures:    []error{lookupFailure, lookupFailure},
			wantCalls:   3,
			wantContent: true,
		},
		{
			name:       "a lookup that fails every time",
			failures:   []error{lookupFailure, lookupFailure, lookupFailure, lookupFailure},
			wantCalls:  3,
			wantLookup: true,
		},
		{
			name:      "a provider error",
			failures:  []error{errors.New("VPN catalog returned HTTP 503")},
			wantCalls: 1,
		},
		{
			name:         "a refresh canceled during the first try",
			failures:     []error{lookupFailure, lookupFailure, lookupFailure},
			cancelOnCall: 1,
			wantCalls:    1,
			wantLookup:   true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)

			calls := 0
			server := &Server{
				downloadCatalog: func(context.Context, provider.CatalogSource) ([]byte, error) {
					calls++
					if calls == test.cancelOnCall {
						cancel()
					}

					if calls <= len(test.failures) {
						return nil, test.failures[calls-1]
					}

					return []byte("catalog archive"), nil
				},
			}

			content, err := server.downloadCatalogSourceWithRetries(ctx, provider.CatalogSource{URL: provider.PIAStrongUDPCatalogURL})
			if calls != test.wantCalls {
				t.Fatalf("download calls = %d, want %d", calls, test.wantCalls)
			}

			if test.wantContent {
				if err != nil || string(content) != "catalog archive" {
					t.Fatalf("download = %q, %v; want the archive", content, err)
				}

				return
			}

			var lookupError *net.DNSError
			if err == nil || errors.As(err, &lookupError) != test.wantLookup {
				t.Fatalf("download error = %v, want a lookup error: %t", err, test.wantLookup)
			}
		})
	}
}

// TestCustomOpenVPNUploadKeepsEveryRemote builds the ordered controller pool.
func TestCustomOpenVPNUploadKeepsEveryRemote(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	body, err := json.Marshal(map[string]string{
		"tunnel":      provider.TunnelOpenVPN,
		"profileName": "canada.ovpn",
		"profile": `client
proto udp
remote vpn-toronto.example.test 1194
remote vpn-montreal.example.test 443 tcp-client
dev tun
<ca>
certificate
</ca>
`,
	})
	if err != nil {
		t.Fatalf("encode custom profile: %v", err)
	}
	upload := performRequest(t, server, http.MethodPost, "/api/v1/vpn/profiles/custom", string(body), cookies, csrfToken)
	if upload.Code != http.StatusCreated {
		t.Fatalf("upload status %d: %s", upload.Code, upload.Body.String())
	}
	var uploaded struct {
		ID       string `json:"id"`
		Profiles []struct {
			ID         string `json:"id"`
			RemoteHost string `json:"remoteHost"`
			Protocol   string `json:"protocol"`
		} `json:"profiles"`
	}
	decodeBody(t, upload, &uploaded)
	if len(uploaded.Profiles) != 2 || uploaded.ID != uploaded.Profiles[0].ID ||
		uploaded.Profiles[0].RemoteHost != "vpn-toronto.example.test" ||
		uploaded.Profiles[1].RemoteHost != "vpn-montreal.example.test" ||
		uploaded.Profiles[1].Protocol != "tcp" {
		t.Fatalf("uploaded profiles = %+v", uploaded)
	}

	profileIDs := []string{uploaded.Profiles[0].ID, uploaded.Profiles[1].ID}
	connection, _, err := server.connectionFromInput(
		context.Background(),
		"custom",
		provider.TunnelOpenVPN,
		profileIDs,
		"ordered",
		map[string]string{"username": "owner", "password": "secret"},
		nil,
		10,
	)
	if err != nil {
		t.Fatalf("build controller pool: %v", err)
	}
	defer clearConnectionProfiles(&connection)
	if len(connection.Endpoints) != 2 ||
		connection.Endpoints[0].RemoteHost != "vpn-toronto.example.test" ||
		connection.Endpoints[1].RemoteHost != "vpn-montreal.example.test" {
		t.Fatalf("controller endpoints = %+v", connection.Endpoints)
	}
	for index, endpoint := range connection.Endpoints {
		if strings.Count(string(endpoint.Configuration), "\nremote ") != 1 {
			t.Fatalf("endpoint %d contains multiple remotes:\n%s", index, endpoint.Configuration)
		}
	}
}

// TestRefreshVPNCatalogNamesTheFailedHost checks the code and message of a refresh
// whose lookup failed and of one whose download failed some other way.
func TestRefreshVPNCatalogNamesTheFailedHost(t *testing.T) {
	skipCatalogRetryPauses(t)

	tests := []struct {
		name    string
		err     error
		code    string
		message string
	}{
		{
			name:    "a failed lookup",
			err:     failedCatalogLookup("www.privateinternetaccess.com"),
			code:    "catalog_lookup_failed",
			message: "The container could not look up www.privateinternetaccess.com to download the VPN provider catalog.",
		},
		{
			name:    "a provider error",
			err:     errors.New("VPN catalog returned HTTP 503"),
			code:    "catalog_download_failed",
			message: "The official VPN provider catalog could not be downloaded from www.privateinternetaccess.com.",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server, cookies, csrfToken := newClaimedTestServer(t)
			if server.downloadCatalog == nil {
				t.Fatal("NewServer left the catalog downloader unset")
			}

			server.downloadCatalog = func(context.Context, provider.CatalogSource) ([]byte, error) {
				return nil, test.err
			}

			response := performRequest(t, server, http.MethodPost, "/api/v1/vpn/providers/pia/tunnels/openvpn/catalog/refresh", "", cookies, csrfToken)
			expectError(t, response, http.StatusBadGateway, test.code, test.message)
		})
	}
}

// TestCatalogDownloadUsesTheSourceLimits checks that a download stops at its source's
// size cap, whether or not the server says how large the body is.
func TestCatalogDownloadUsesTheSourceLimits(t *testing.T) {
	body := strings.Repeat("x", 100)
	tests := []struct {
		name         string
		maximumBytes int64
		chunked      bool
		wantError    bool
	}{
		{
			name:         "a body within the cap",
			maximumBytes: 100,
		},
		{
			name:         "a declared length over the cap",
			maximumBytes: 50,
			wantError:    true,
		},
		{
			name:         "an undeclared length over the cap",
			maximumBytes: 50,
			chunked:      true,
			wantError:    true,
		},
		{
			name: "the default cap",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			catalogServer := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
				if test.chunked {
					responseWriter.(http.Flusher).Flush()
				}

				_, _ = responseWriter.Write([]byte(body))
			}))
			t.Cleanup(catalogServer.Close)

			content, err := downloadVPNCatalogSource(context.Background(), provider.CatalogSource{
				URL:          catalogServer.URL,
				MaximumBytes: test.maximumBytes,
			}, nil)
			if test.wantError {
				if err == nil || !strings.Contains(err.Error(), "download size limit") {
					t.Fatalf("download error = %v, want the size limit", err)
				}

				return
			}

			if err != nil || string(content) != body {
				t.Fatalf("download = %d bytes, %v; want the whole body", len(content), err)
			}
		})
	}
}

// TestRefreshVPNCatalogPassesTheSourceLimits checks that a large catalog reaches the
// downloader with its own size cap and time limit.
func TestRefreshVPNCatalogPassesTheSourceLimits(t *testing.T) {
	skipCatalogRetryPauses(t)

	server, cookies, csrfToken := newClaimedTestServer(t)
	var requested provider.CatalogSource
	server.downloadCatalog = func(_ context.Context, source provider.CatalogSource) ([]byte, error) {
		requested = source

		return nil, errors.New("VPN catalog returned HTTP 503")
	}

	response := performRequest(t, server, http.MethodPost, "/api/v1/vpn/providers/nordvpn/tunnels/openvpn/catalog/refresh", "", cookies, csrfToken)
	expectError(t, response, http.StatusBadGateway, "catalog_download_failed", "The official VPN provider catalog could not be downloaded from downloads.nordcdn.com.")

	maximumBytes, timeout := requested.DownloadLimits()
	_, defaultTimeout := provider.CatalogSource{}.DownloadLimits()
	if requested.URL != provider.NordVPNCatalogURL || maximumBytes <= provider.DefaultCatalogDownloadBytes || timeout <= defaultTimeout {
		t.Fatalf("downloader got %s with %d bytes and %s, want NordVPN's own limits", requested.URL, maximumBytes, timeout)
	}
}

// testWireGuardPrivateKey and testWireGuardPublicKey are the examples from wg(8).
const (
	testWireGuardPrivateKey = "yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk="
	testWireGuardPublicKey  = "xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg="
)

// mullvadRelayListFixture is a two-relay copy of Mullvad's public relay list.
const mullvadRelayListFixture = `[
  {"hostname": "se-sto-wg-001", "country_code": "se", "country_name": "Sweden", "city_name": "Stockholm",
   "active": true, "type": "wireguard", "ipv4_addr_in": "185.213.154.68", "pubkey": "` + testWireGuardPublicKey + `"},
  {"hostname": "gb-lon-wg-002", "country_code": "gb", "country_name": "UK", "city_name": "London",
   "active": true, "type": "wireguard", "ipv4_addr_in": "141.98.252.130", "pubkey": "` + testWireGuardPublicKey + `"}
]`

// TestRefreshVPNWireGuardCatalog refreshes Mullvad's list as JSON and keeps it per tunnel.
//
// The provider list must show the WireGuard catalog under its tunnel, and a tunnel the
// provider lacks must have no refresh.
func TestRefreshVPNWireGuardCatalog(t *testing.T) {
	skipCatalogRetryPauses(t)

	server, cookies, csrfToken := newClaimedTestServer(t)
	var requested provider.CatalogSource
	server.downloadCatalog = func(_ context.Context, source provider.CatalogSource) ([]byte, error) {
		requested = source

		return []byte(mullvadRelayListFixture), nil
	}

	response := performRequest(t, server, http.MethodPost, "/api/v1/vpn/providers/mullvad/tunnels/wireguard/catalog/refresh", "", cookies, csrfToken)
	if response.Code != http.StatusOK {
		t.Fatalf("refresh status %d: %s", response.Code, response.Body.String())
	}
	if requested.URL != provider.MullvadWireGuardCatalogURL || !strings.Contains(requested.AcceptHeader(), "application/json") {
		t.Fatalf("downloader got %s accepting %q", requested.URL, requested.AcceptHeader())
	}
	var refreshed struct {
		Tunnel        string `json:"tunnel"`
		EndpointCount int    `json:"endpointCount"`
	}
	decodeBody(t, response, &refreshed)
	if refreshed.Tunnel != provider.TunnelWireGuard || refreshed.EndpointCount != 2 {
		t.Fatalf("refreshed catalog = %+v", refreshed)
	}

	providers := performRequest(t, server, http.MethodGet, "/api/v1/vpn/providers", "", cookies, "")
	var providerList struct {
		Items []struct {
			ID      string `json:"id"`
			Tunnels []struct {
				ID      string `json:"id"`
				Catalog *struct {
					EndpointCount int `json:"endpointCount"`
				} `json:"catalog"`
			} `json:"tunnels"`
		} `json:"items"`
	}
	decodeBody(t, providers, &providerList)
	found := false
	for _, item := range providerList.Items {
		if item.ID != "mullvad" {
			continue
		}
		found = len(item.Tunnels) == 1 && item.Tunnels[0].ID == provider.TunnelWireGuard &&
			item.Tunnels[0].Catalog != nil && item.Tunnels[0].Catalog.EndpointCount == 2
	}
	if !found {
		t.Fatalf("Mullvad's provider entry lacks its WireGuard catalog: %s", providers.Body.String())
	}

	profiles := performRequest(t, server, http.MethodGet, "/api/v1/vpn/profiles?provider=mullvad&tunnel=wireguard", "", cookies, "")
	var profileList struct {
		Items []struct {
			Tunnel string `json:"tunnel"`
		} `json:"items"`
	}
	decodeBody(t, profiles, &profileList)
	if len(profileList.Items) != 2 || profileList.Items[0].Tunnel != provider.TunnelWireGuard {
		t.Fatalf("Mullvad profiles: %s", profiles.Body.String())
	}

	missingTunnel := performRequest(t, server, http.MethodPost, "/api/v1/vpn/providers/mullvad/tunnels/openvpn/catalog/refresh", "", cookies, csrfToken)
	expectError(t, missingTunnel, http.StatusNotFound, "catalog_unavailable", "This VPN provider does not expose a refreshable catalog for this tunnel.")
}

// TestConnectionFromInputMergesWireGuardKeys completes catalog templates at connect.
//
// The merged configuration must be complete and canonical for the controller, a
// missing address must be refused, and nothing is merged into a complete upload.
func TestConnectionFromInputMergesWireGuardKeys(t *testing.T) {
	skipCatalogRetryPauses(t)

	server, cookies, csrfToken := newClaimedTestServer(t)
	server.downloadCatalog = func(context.Context, provider.CatalogSource) ([]byte, error) {
		return []byte(mullvadRelayListFixture), nil
	}
	refresh := performRequest(t, server, http.MethodPost, "/api/v1/vpn/providers/mullvad/tunnels/wireguard/catalog/refresh", "", cookies, csrfToken)
	if refresh.Code != http.StatusOK {
		t.Fatalf("refresh status %d: %s", refresh.Code, refresh.Body.String())
	}
	profiles, err := server.store.ListVPNProfiles(context.Background(), "mullvad", provider.TunnelWireGuard)
	if err != nil || len(profiles) != 2 {
		t.Fatalf("Mullvad profiles = %d, %v", len(profiles), err)
	}

	connection, _, err := server.connectionFromInput(
		context.Background(),
		"mullvad",
		provider.TunnelWireGuard,
		[]string{profiles[0].ID, profiles[1].ID},
		"ordered",
		map[string]string{"privateKey": testWireGuardPrivateKey, "address": "10.68.12.34/32"},
		nil,
		10,
	)
	if err != nil {
		t.Fatalf("connection from input: %v", err)
	}
	defer clearConnectionProfiles(&connection)
	if connection.Tunnel != provider.TunnelWireGuard || connection.Username != "" || len(connection.Endpoints) != 2 {
		t.Fatalf("connection = tunnel %q, username %q, %d endpoints", connection.Tunnel, connection.Username, len(connection.Endpoints))
	}
	for _, endpoint := range connection.Endpoints {
		configuration := string(endpoint.Configuration)
		if !strings.Contains(configuration, "PrivateKey = "+testWireGuardPrivateKey) ||
			!strings.Contains(configuration, "Address = 10.68.12.34/32") {
			t.Fatalf("merged configuration:\n%s", configuration)
		}
		if _, err := provider.ValidateNormalizedWireGuardProfile(endpoint.Configuration); err != nil {
			t.Fatalf("the merged configuration would fail the controller: %v", err)
		}
	}

	if _, _, err := server.connectionFromInput(
		context.Background(),
		"mullvad",
		provider.TunnelWireGuard,
		[]string{profiles[0].ID},
		"sticky",
		map[string]string{"privateKey": testWireGuardPrivateKey},
		nil,
		10,
	); err == nil || !strings.Contains(err.Error(), "Tunnel address is required") {
		t.Fatalf("a missing address error = %v", err)
	}

	wireGuardFile := `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 10.0.0.2/32, fd00::2/128
DNS = 10.0.0.1

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = vpn.example.test:51820
AllowedIPs = 0.0.0.0/0, ::/0
`
	uploadBody := func(tunnel string, content string) string {
		body, _ := json.Marshal(map[string]string{"tunnel": tunnel, "profileName": "home.conf", "profile": content})

		return string(body)
	}
	wrongTunnel := performRequest(t, server, http.MethodPost, "/api/v1/vpn/profiles/custom", uploadBody(provider.TunnelOpenVPN, wireGuardFile), cookies, csrfToken)
	expectError(t, wrongTunnel, http.StatusUnprocessableEntity, "invalid_request", "This is a WireGuard file. Choose the WireGuard tunnel to upload it.", "profile")
	notWireGuard := performRequest(t, server, http.MethodPost, "/api/v1/vpn/profiles/custom", uploadBody(provider.TunnelWireGuard, "client\nremote vpn.example.test 1194\n"), cookies, csrfToken)
	expectError(t, notWireGuard, http.StatusUnprocessableEntity, "invalid_request", "This is not a WireGuard file because it has no [Interface] section. For an OpenVPN profile, choose the OpenVPN tunnel.", "profile")

	upload := performRequest(t, server, http.MethodPost, "/api/v1/vpn/profiles/custom", uploadBody(provider.TunnelWireGuard, wireGuardFile), cookies, csrfToken)
	if upload.Code != http.StatusCreated {
		t.Fatalf("upload status %d: %s", upload.Code, upload.Body.String())
	}
	var uploaded struct {
		ID     string `json:"id"`
		Tunnel string `json:"tunnel"`
	}
	decodeBody(t, upload, &uploaded)
	if uploaded.Tunnel != provider.TunnelWireGuard {
		t.Fatalf("uploaded profile = %+v", uploaded)
	}

	customConnection, _, err := server.connectionFromInput(
		context.Background(),
		"custom",
		provider.TunnelWireGuard,
		[]string{uploaded.ID},
		"sticky",
		map[string]string{},
		nil,
		10,
	)
	if err != nil {
		t.Fatalf("custom WireGuard connection: %v", err)
	}
	defer clearConnectionProfiles(&customConnection)
	configuration := string(customConnection.Endpoints[0].Configuration)
	if strings.Contains(configuration, "fd00::2") || strings.Contains(configuration, "::/0") ||
		!strings.Contains(configuration, "Address = 10.0.0.2/32") {
		t.Fatalf("custom configuration kept IPv6 or lost its address:\n%s", configuration)
	}
	if _, _, err := server.connectionFromInput(
		context.Background(),
		"custom",
		provider.TunnelOpenVPN,
		[]string{uploaded.ID},
		"sticky",
		map[string]string{},
		nil,
		10,
	); err == nil || !strings.Contains(err.Error(), "must use the selected tunnel") {
		t.Fatalf("a WireGuard upload in an OpenVPN pool error = %v", err)
	}
}
