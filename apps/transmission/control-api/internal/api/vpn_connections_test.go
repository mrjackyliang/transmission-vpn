package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/capacity"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestVPNConnectionRoutesCreateListUpdateAndSwitchDefault covers the E4 contract.
func TestVPNConnectionRoutesCreateListUpdateAndSwitchDefault(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	server.capacity = fixedCapacityReader{snapshot: capacity.Snapshot{
		Limit: 2, MemoryBytes: 1024 * 1024 * 1024, CPUs: 2, Source: "cgroup-v2",
	}}
	webProxyPublishes := 0
	var publishedWebProxyConfig webProxyRuntimeConfig
	server.webProxyConfigPublisher = func(
		_ string,
		configuration webProxyRuntimeConfig,
	) error {
		webProxyPublishes++
		publishedWebProxyConfig = configuration

		return nil
	}
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	createBody := func(name string) string {
		content, _ := json.Marshal(map[string]any{
			"name": name, "providerId": "custom", "tunnel": "wireguard",
			"profileIds": []string{profileID}, "endpointStrategy": "sticky",
			"credentials": map[string]string{}, "dnsServers": []string{},
			"retryIntervalSeconds": 10,
		})

		return string(content)
	}
	firstResponse := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connections", createBody("Primary"), cookies, csrfToken)
	if firstResponse.Code != http.StatusCreated {
		t.Fatalf("first create status %d: %s", firstResponse.Code, firstResponse.Body.String())
	}
	var firstBody struct {
		Connection vpnConnectionResponse `json:"connection"`
	}
	decodeBody(t, firstResponse, &firstBody)
	// The console reads lists strictly, so provider DNS must be [] rather than null.
	if !strings.Contains(firstResponse.Body.String(), `"dnsServers":[]`) {
		t.Fatalf("created connection DNS servers must encode as an empty list: %s", firstResponse.Body.String())
	}
	if firstBody.Connection.Slot != 0 || !firstBody.Connection.Default ||
		firstBody.Connection.PeerPort != storage.DefaultVPNPeerPort || firstBody.Connection.ChangeRunning {
		t.Fatalf("first connection = %+v", firstBody.Connection)
	}

	secondResponse := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connections", createBody("Secondary"), cookies, csrfToken)
	if secondResponse.Code != http.StatusCreated {
		t.Fatalf("second create status %d: %s", secondResponse.Code, secondResponse.Body.String())
	}
	var secondBody struct {
		Connection vpnConnectionResponse `json:"connection"`
	}
	decodeBody(t, secondResponse, &secondBody)
	if secondBody.Connection.Slot != 1 || secondBody.Connection.Default ||
		secondBody.Connection.PeerPort != storage.DefaultVPNPeerPort+1 {
		t.Fatalf("second connection = %+v", secondBody.Connection)
	}

	list := performRequest(t, server, http.MethodGet, "/api/v1/vpn/connections", "", cookies, "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"used":2`) ||
		!strings.Contains(list.Body.String(), `"source":"cgroup-v2"`) ||
		strings.Contains(list.Body.String(), `"dnsServers":null`) {
		t.Fatalf("connection list %d: %s", list.Code, list.Body.String())
	}

	third := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connections", createBody("Third"), cookies, csrfToken)
	if third.Code != http.StatusConflict || !strings.Contains(third.Body.String(), `"code":"capacity_reached"`) ||
		!strings.Contains(third.Body.String(), `"details":{"limit":2,"used":2}`) {
		t.Fatalf("capacity response %d: %s", third.Code, third.Body.String())
	}

	updateBody, _ := json.Marshal(map[string]any{
		"expectedRevision": secondBody.Connection.Revision,
		"name":             "Secondary renamed",
		"peerPort":         52000,
	})
	updated := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+secondBody.Connection.ID,
		string(updateBody),
		cookies,
		csrfToken,
	)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"peerPort":52000`) ||
		!strings.Contains(updated.Body.String(), `"name":"Secondary renamed"`) {
		t.Fatalf("connection update %d: %s", updated.Code, updated.Body.String())
	}
	storedSecond, err := server.store.VPNConnectionByID(context.Background(), secondBody.Connection.ID)
	if err != nil {
		t.Fatalf("read updated second connection: %v", err)
	}
	configuration := map[string]any{
		"providerId": "custom", "tunnel": "wireguard",
		"profileIds": []string{profileID}, "endpointStrategy": "sticky",
		"credentials": map[string]string{}, "dnsServers": []string{},
		"retryIntervalSeconds": 10,
	}
	connectCount := fake.connectCount()
	staleBody, _ := json.Marshal(map[string]any{
		"expectedRevision": secondBody.Connection.Revision,
		"configuration":    configuration,
	})
	stale := performRequest(t, server, http.MethodPut, "/api/v1/vpn/connections/"+secondBody.Connection.ID, string(staleBody), cookies, csrfToken)
	expectError(t, stale, http.StatusConflict, "revision_conflict", "The VPN connection changed. Reload it and try again.")
	duplicateBody, _ := json.Marshal(map[string]any{
		"expectedRevision": storedSecond.Revision,
		"name":             "PRIMARY",
		"configuration":    configuration,
	})
	duplicate := performRequest(t, server, http.MethodPut, "/api/v1/vpn/connections/"+secondBody.Connection.ID, string(duplicateBody), cookies, csrfToken)
	expectError(t, duplicate, http.StatusConflict, "name_taken", "A VPN connection already uses that name.")
	if fake.connectCount() != connectCount {
		t.Fatalf("rejected updates reached the controller: connects %d -> %d", connectCount, fake.connectCount())
	}
	var daemonList []transmissionDaemonConfiguration
	readJSONFileForTest(
		t,
		filepath.Join(server.runtimeDirectory, "transmission-config", "daemons.json"),
		&daemonList,
	)
	if len(daemonList) != 2 || daemonList[1].PeerPort != 52000 {
		t.Fatalf("published daemons = %+v", daemonList)
	}
	if _, err := server.store.CreateWebProxyLogin(context.Background(), storage.WebProxyLogin{
		ID:           "wpl-0000000000000003",
		Username:     "default-following-proxy",
		PasswordHash: "test-hash",
	}); err != nil {
		t.Fatalf("create default-following proxy login: %v", err)
	}

	defaultBody := `{"connectionId":"` + secondBody.Connection.ID + `"}`
	fake.restart()
	switched := performRequest(t, server, http.MethodPut, "/api/v1/vpn/default", defaultBody, cookies, csrfToken)
	if switched.Code != http.StatusOK {
		t.Fatalf("default switch %d: %s", switched.Code, switched.Body.String())
	}
	defaultConnection, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != secondBody.Connection.ID {
		t.Fatalf("stored default = %+v, %v", defaultConnection, err)
	}
	readJSONFileForTest(
		t,
		filepath.Join(server.runtimeDirectory, "transmission-config", "daemons.json"),
		&daemonList,
	)
	if len(daemonList) != 2 || daemonList[0].Default || !daemonList[1].Default {
		t.Fatalf("default-switched daemons = %+v", daemonList)
	}
	if webProxyPublishes != 1 {
		t.Fatalf("web proxy publish count = %d, want 1", webProxyPublishes)
	}
	if len(publishedWebProxyConfig.Logins) != 1 ||
		publishedWebProxyConfig.Logins[0].ConnectionID != secondBody.Connection.ID {
		t.Fatalf("default-switched web proxy config = %+v", publishedWebProxyConfig)
	}
}

// TestVPNConnectionCredentialUpdatesPreserveSavedValues covers key-only reads and
// both configuration routes that replace an existing connection candidate.
func TestVPNConnectionCredentialUpdatesPreserveSavedValues(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	startFakeController(t, server)
	server.capacity = fixedCapacityReader{snapshot: capacity.Snapshot{
		Limit: 4, MemoryBytes: 2 * 1024 * 1024 * 1024, CPUs: 4, Source: "cgroup-v2",
	}}
	pureVPNProfileID := storeTestCatalogVPNProfile(
		t,
		server,
		"purevpn",
		provider.TunnelOpenVPN,
		"purevpn-test-udp",
	)
	nordVPNProfileID := storeTestCatalogVPNProfile(
		t,
		server,
		"nordvpn",
		provider.TunnelOpenVPN,
		"nordvpn-test-udp",
	)

	missingUsernameBody, _ := json.Marshal(map[string]any{
		"name":             "Missing username",
		"providerId":       "purevpn",
		"tunnel":           provider.TunnelOpenVPN,
		"profileIds":       []string{pureVPNProfileID},
		"endpointStrategy": "sticky",
		"credentials":      map[string]string{"password": "not-in-the-message"},
		"dnsServers":       []string{},
	})
	missingUsername := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/vpn/connections",
		string(missingUsernameBody),
		cookies,
		csrfToken,
	)
	if missingUsername.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(missingUsername.Body.String(), `"message":"VPN username is required."`) ||
		!strings.Contains(missingUsername.Body.String(), `"field":"credentials.username"`) ||
		!strings.Contains(missingUsername.Body.String(), `"path":["credentials","username"]`) ||
		strings.Contains(missingUsername.Body.String(), "not-in-the-message") {
		t.Fatalf("missing username response = %d %s", missingUsername.Code, missingUsername.Body.String())
	}

	const originalUsername = "credential-user-4821"
	const originalPassword = "credential-password-9375"
	createBody, _ := json.Marshal(map[string]any{
		"name":             "PureVPN saved sign-in",
		"providerId":       "purevpn",
		"tunnel":           provider.TunnelOpenVPN,
		"profileIds":       []string{pureVPNProfileID},
		"endpointStrategy": "sticky",
		"credentials": map[string]string{
			"username": originalUsername,
			"password": originalPassword,
		},
		"dnsServers": []string{},
	})
	createdResponse := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/vpn/connections",
		string(createBody),
		cookies,
		csrfToken,
	)
	if createdResponse.Code != http.StatusCreated ||
		!strings.Contains(createdResponse.Body.String(), `"savedCredentials":["username","password"]`) ||
		strings.Contains(createdResponse.Body.String(), originalUsername) ||
		strings.Contains(createdResponse.Body.String(), originalPassword) {
		t.Fatalf("created credential response = %d %s", createdResponse.Code, createdResponse.Body.String())
	}
	var createdBody struct {
		Connection vpnConnectionResponse `json:"connection"`
	}
	decodeBody(t, createdResponse, &createdBody)

	assertStoredCredentials := func(username string, password string) storage.EncryptedVPNConnection {
		stored, err := server.store.VPNConnectionByID(context.Background(), createdBody.Connection.ID)
		if err != nil {
			t.Fatalf("read stored credential connection: %v", err)
		}
		credentials, err := server.decryptVPNConnectionCredentials(stored)
		if err != nil {
			t.Fatalf("decrypt stored credentials: %v", err)
		}
		defer clear(credentials)
		if credentials["username"] != username || credentials["password"] != password || len(credentials) != 2 {
			t.Fatalf("stored credentials = %#v", credentials)
		}

		return stored
	}

	stored := assertStoredCredentials(originalUsername, originalPassword)
	omittedConfiguration := map[string]any{
		"providerId":           "purevpn",
		"tunnel":               provider.TunnelOpenVPN,
		"profileIds":           []string{pureVPNProfileID},
		"endpointStrategy":     "sticky",
		"dnsServers":           []string{},
		"retryIntervalSeconds": 10,
	}
	omittedBody, _ := json.Marshal(map[string]any{
		"expectedRevision": stored.Revision,
		"configuration":    omittedConfiguration,
	})
	omitted := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+createdBody.Connection.ID,
		string(omittedBody),
		cookies,
		csrfToken,
	)
	if omitted.Code != http.StatusOK {
		t.Fatalf("omitted credential update = %d %s", omitted.Code, omitted.Body.String())
	}
	stored = assertStoredCredentials(originalUsername, originalPassword)

	blankConfiguration := mapsCloneForTest(omittedConfiguration)
	blankConfiguration["credentials"] = map[string]string{
		"username": "",
		"password": "",
	}
	blankBody, _ := json.Marshal(map[string]any{
		"expectedRevision": stored.Revision,
		"configuration":    blankConfiguration,
	})
	blank := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+createdBody.Connection.ID,
		string(blankBody),
		cookies,
		csrfToken,
	)
	if blank.Code != http.StatusOK {
		t.Fatalf("blank credential update = %d %s", blank.Code, blank.Body.String())
	}
	stored = assertStoredCredentials(originalUsername, originalPassword)

	const replacementUsername = "replacement-user-6248"
	replacementConfiguration := mapsCloneForTest(omittedConfiguration)
	replacementConfiguration["credentials"] = map[string]string{"username": replacementUsername}
	replacementBody, _ := json.Marshal(map[string]any{
		"expectedRevision": stored.Revision,
		"configuration":    replacementConfiguration,
	})
	replaced := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+createdBody.Connection.ID,
		string(replacementBody),
		cookies,
		csrfToken,
	)
	if replaced.Code != http.StatusOK {
		t.Fatalf("replacement credential update = %d %s", replaced.Code, replaced.Body.String())
	}
	stored = assertStoredCredentials(replacementUsername, originalPassword)

	providerChangeConfiguration := mapsCloneForTest(omittedConfiguration)
	providerChangeConfiguration["providerId"] = "pia"
	providerChangeConfiguration["credentials"] = map[string]string{}
	providerChangeBody, _ := json.Marshal(map[string]any{
		"expectedRevision": stored.Revision,
		"configuration":    providerChangeConfiguration,
	})
	providerChange := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+createdBody.Connection.ID,
		string(providerChangeBody),
		cookies,
		csrfToken,
	)
	if providerChange.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(providerChange.Body.String(), `"field":"configuration.credentials.username"`) ||
		!strings.Contains(providerChange.Body.String(), `"message":"VPN username is required."`) {
		t.Fatalf("provider change credential response = %d %s", providerChange.Code, providerChange.Body.String())
	}
	providerChangeConfiguration["credentials"] = map[string]string{"username": "new-provider-user"}
	providerChangeBody, _ = json.Marshal(map[string]any{
		"expectedRevision": stored.Revision,
		"configuration":    providerChangeConfiguration,
	})
	providerChange = performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+createdBody.Connection.ID,
		string(providerChangeBody),
		cookies,
		csrfToken,
	)
	if providerChange.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(providerChange.Body.String(), `"field":"configuration.credentials.password"`) ||
		!strings.Contains(providerChange.Body.String(), `"message":"VPN password is required."`) {
		t.Fatalf("provider change password response = %d %s", providerChange.Code, providerChange.Body.String())
	}
	stored = assertStoredCredentials(replacementUsername, originalPassword)

	nordVPNCreateBody, _ := json.Marshal(map[string]any{
		"name":             "NordVPN tunnel change",
		"providerId":       "nordvpn",
		"tunnel":           provider.TunnelOpenVPN,
		"profileIds":       []string{nordVPNProfileID},
		"endpointStrategy": "sticky",
		"credentials": map[string]string{
			"username": "nordvpn-user",
			"password": "nordvpn-password",
		},
		"dnsServers": []string{},
	})
	nordVPNCreated := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/vpn/connections",
		string(nordVPNCreateBody),
		cookies,
		csrfToken,
	)
	if nordVPNCreated.Code != http.StatusCreated {
		t.Fatalf("NordVPN create = %d %s", nordVPNCreated.Code, nordVPNCreated.Body.String())
	}
	var nordVPNBody struct {
		Connection vpnConnectionResponse `json:"connection"`
	}
	decodeBody(t, nordVPNCreated, &nordVPNBody)
	tunnelChangeBody, _ := json.Marshal(map[string]any{
		"expectedRevision": nordVPNBody.Connection.Revision,
		"configuration": map[string]any{
			"providerId":           "nordvpn",
			"tunnel":               provider.TunnelWireGuard,
			"profileIds":           []string{"nordvpn-test-wireguard"},
			"endpointStrategy":     "sticky",
			"credentials":          map[string]string{},
			"dnsServers":           []string{},
			"retryIntervalSeconds": 10,
		},
	})
	tunnelChange := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/vpn/connections/"+nordVPNBody.Connection.ID,
		string(tunnelChangeBody),
		cookies,
		csrfToken,
	)
	if tunnelChange.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(tunnelChange.Body.String(), `"field":"configuration.credentials.privateKey"`) ||
		!strings.Contains(tunnelChange.Body.String(), `"message":"Private key is required."`) {
		t.Fatalf("tunnel change credential response = %d %s", tunnelChange.Code, tunnelChange.Body.String())
	}

	legacyBody, _ := json.Marshal(map[string]any{
		"expectedRevision":     stored.Revision,
		"providerId":           "purevpn",
		"tunnel":               provider.TunnelOpenVPN,
		"profileIds":           []string{pureVPNProfileID},
		"endpointStrategy":     "sticky",
		"dnsServers":           []string{},
		"retryIntervalSeconds": 10,
	})
	legacyUpdate := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/vpn/connect",
		string(legacyBody),
		cookies,
		csrfToken,
	)
	if legacyUpdate.Code != http.StatusOK {
		t.Fatalf("legacy omitted credential update = %d %s", legacyUpdate.Code, legacyUpdate.Body.String())
	}
	assertStoredCredentials(replacementUsername, originalPassword)

	list := performRequest(t, server, http.MethodGet, "/api/v1/vpn/connections", "", cookies, "")
	if list.Code != http.StatusOK ||
		!strings.Contains(list.Body.String(), `"savedCredentials":["username","password"]`) ||
		strings.Contains(list.Body.String(), replacementUsername) ||
		strings.Contains(list.Body.String(), originalPassword) {
		t.Fatalf("credential list response = %d %s", list.Code, list.Body.String())
	}
}

// TestDeleteVPNConnectionRefusesDefaultAndTorrentUse preserves E5 move inputs.
func TestDeleteVPNConnectionRefusesDefaultAndTorrentUse(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 9, "hashString": secondTestHash, "name": "Used",
				}}}
			}

			return map[string]any{}
		},
	)
	startFakeController(t, fixture.server)
	profileID := newTorrentProfileID()
	if _, err := fixture.server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
		ID:                profileID,
		Name:              "Secondary profile",
		DownloadDirectory: "/data/secondary",
		Labels:            []string{},
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
		MatchPatterns: []string{"Secondary*"},
		ConnectionID:  &fixture.second.ID,
	}); err != nil {
		t.Fatalf("create connection profile use: %v", err)
	}
	const loginID = "wpl-0000000000000001"
	if _, err := fixture.server.store.CreateWebProxyLogin(context.Background(), storage.WebProxyLogin{
		ID:           loginID,
		Username:     "secondary-proxy",
		PasswordHash: "test-hash",
		ConnectionID: &fixture.second.ID,
	}); err != nil {
		t.Fatalf("create connection login use: %v", err)
	}

	defaultResponse := performRequest(
		t,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.first.ID,
		"",
		fixture.cookies,
		fixture.csrfToken,
	)
	if defaultResponse.Code != http.StatusConflict ||
		!strings.Contains(defaultResponse.Body.String(), `"code":"default_connection"`) {
		t.Fatalf("delete default %d: %s", defaultResponse.Code, defaultResponse.Body.String())
	}

	usedResponse := performRequest(
		t,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		"",
		fixture.cookies,
		fixture.csrfToken,
	)
	if usedResponse.Code != http.StatusConflict ||
		!strings.Contains(usedResponse.Body.String(), `"code":"connection_in_use"`) ||
		!strings.Contains(usedResponse.Body.String(), `"torrents":1`) ||
		!strings.Contains(usedResponse.Body.String(), `"profiles":[{"id":"`+profileID+`","name":"Secondary profile"}]`) ||
		!strings.Contains(usedResponse.Body.String(), `"logins":[{"id":"`+loginID+`","username":"secondary-proxy"}]`) {
		t.Fatalf("delete used connection %d: %s", usedResponse.Code, usedResponse.Body.String())
	}
}

// TestDeleteVPNConnectionScopesDaemonReadinessToTheRemovedConnection covers E5 removal.
func TestDeleteVPNConnectionScopesDaemonReadinessToTheRemovedConnection(t *testing.T) {
	t.Run("removed daemon unavailable", func(t *testing.T) {
		fixture := newMultiTransmissionFixture(
			t,
			func(recordedTransmissionCall) any { return map[string]any{"torrents": []map[string]any{}} },
			func(recordedTransmissionCall) any { return map[string]any{"torrents": []map[string]any{}} },
		)
		startFakeController(t, fixture.server)
		fixture.secondFake.server.Close()

		response := performRequest(
			t,
			fixture.server,
			http.MethodDelete,
			"/api/v1/vpn/connections/"+fixture.second.ID,
			"",
			fixture.cookies,
			fixture.csrfToken,
		)
		if response.Code != http.StatusConflict ||
			!strings.Contains(response.Body.String(), `"code":"daemon_unavailable"`) ||
			!strings.Contains(response.Body.String(), "Transmission for Secondary must answer") {
			t.Fatalf("unavailable source delete = %d: %s", response.Code, response.Body.String())
		}
	})

	t.Run("unrelated daemon unavailable", func(t *testing.T) {
		fixture := newMultiTransmissionFixture(
			t,
			func(recordedTransmissionCall) any { return map[string]any{"torrents": []map[string]any{}} },
			func(recordedTransmissionCall) any { return map[string]any{"torrents": []map[string]any{}} },
		)
		startFakeController(t, fixture.server)
		fixture.firstFake.server.Close()

		response := performRequest(
			t,
			fixture.server,
			http.MethodDelete,
			"/api/v1/vpn/connections/"+fixture.second.ID,
			"",
			fixture.cookies,
			fixture.csrfToken,
		)
		if response.Code != http.StatusOK {
			t.Fatalf("delete with unrelated daemon unavailable = %d: %s", response.Code, response.Body.String())
		}
	})
}

// TestDeleteVPNConnectionMovesAndReassignsDependents covers the explicit moveTo flow.
func TestDeleteVPNConnectionMovesAndReassignsDependents(testingObject *testing.T) {
	const (
		hash         = "ffffffffffffffffffffffffffffffffffffffff"
		incomingHash = "edededededededededededededededededededed"
	)
	targetPresent := false
	sourcePresent := true
	midDeleteAddResult := ""
	var fixture multiTransmissionFixture
	fixture = newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				if targetPresent {
					return map[string]any{"torrents": []map[string]any{{
						"id": 61, "hashString": hash, "name": "Removal torrent",
					}}}
				}

				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				addedHash := hash
				addedName := "Removal torrent"
				if filename, _ := call.Arguments["filename"].(string); strings.Contains(
					filename,
					incomingHash,
				) {
					addedHash = incomingHash
					addedName = "Incoming torrent"
				}
				targetPresent = true

				return map[string]any{"torrent-added": map[string]any{
					"id": 61, "hashString": addedHash, "name": addedName,
				}}
			}
			if call.Method == "torrent-verify" {
				_, midDeleteAddResult = fixture.server.rpcFacadeTorrentAdd(
					context.Background(),
					map[string]any{
						"filename": "magnet:?xt=urn:btih:" + incomingHash + "&dn=Incoming+torrent",
					},
				)

				return fakeTransmissionResponse{Status: http.StatusBadGateway}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && !sourcePresent {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(hash, 1, 4)
			}
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 9, "hashString": hash, "name": "Removal torrent",
				}}}
			}
			if call.Method == "torrent-remove" {
				sourcePresent = false
			}

			return map[string]any{}
		},
	)
	startFakeController(testingObject, fixture.server)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("removal metainfo")}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	profile.MatchPatterns = []string{"Incoming*"}
	profile, err := fixture.server.store.UpdateTorrentProfile(
		context.Background(),
		profile.ID,
		profile,
	)
	if err != nil {
		testingObject.Fatalf("add incoming match pattern: %v", err)
	}
	login, err := fixture.server.store.CreateWebProxyLogin(
		context.Background(),
		storage.WebProxyLogin{
			ID:           "wpl-0000000000000002",
			Username:     "removal-proxy",
			PasswordHash: "test-hash",
			ConnectionID: &fixture.second.ID,
		},
	)
	if err != nil {
		testingObject.Fatalf("create removal login: %v", err)
	}

	selfTarget := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		`{"moveTo":"`+fixture.second.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if selfTarget.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(selfTarget.Body.String(), `"field":"moveTo"`) {
		testingObject.Fatalf("self removal target = %d %s", selfTarget.Code, selfTarget.Body.String())
	}
	missingTarget := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		`{"moveTo":"vpc-ffffffffffffffff"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if missingTarget.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(missingTarget.Body.String(), `"field":"moveTo"`) {
		testingObject.Fatalf(
			"missing removal target = %d %s",
			missingTarget.Code,
			missingTarget.Body.String(),
		)
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		`{"moveTo":"`+fixture.first.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) ||
		!strings.Contains(response.Body.String(), `"warnings"`) ||
		!strings.Contains(response.Body.String(), `"profiles":1`) ||
		!strings.Contains(response.Body.String(), `"logins":1`) {
		testingObject.Fatalf("move-and-delete response = %d %s", response.Code, response.Body.String())
	}
	if _, err := fixture.server.store.VPNConnectionByID(
		context.Background(),
		fixture.second.ID,
	); !errors.Is(err, storage.ErrNotFound) {
		testingObject.Fatalf("deleted connection lookup error = %v", err)
	}
	storedProfile, err := fixture.server.store.FindTorrentProfile(context.Background(), profile.ID)
	if err != nil || storedProfile.ConnectionID != nil {
		testingObject.Fatalf("reassigned default profile = %+v, %v", storedProfile, err)
	}
	_, logins, err := fixture.server.store.WebProxyConfiguration(context.Background())
	if err != nil || len(logins) != 1 || logins[0].ID != login.ID || logins[0].ConnectionID != nil {
		testingObject.Fatalf("reassigned default logins = %+v, %v", logins, err)
	}
	configuration, _ := readWebProxyTestConfig(testingObject, fixture.server)
	if len(configuration.Logins) != 1 ||
		configuration.Logins[0].ConnectionID != fixture.first.ID {
		testingObject.Fatalf("reassigned proxy runtime config = %+v", configuration)
	}
	if !containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-remove") ||
		!containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") {
		testingObject.Fatalf(
			"removal move calls = source %v target %v",
			transmissionMethods(fixture.secondFake.recordedCalls()),
			transmissionMethods(fixture.firstFake.recordedCalls()),
		)
	}
	if midDeleteAddResult != "success" {
		testingObject.Fatalf("mid-delete RPC add result = %q", midDeleteAddResult)
	}
	incomingAddFound := false
	for _, call := range fixture.firstFake.recordedCalls() {
		filename, _ := call.Arguments["filename"].(string)
		if call.Method == "torrent-add" && strings.Contains(filename, incomingHash) {
			incomingAddFound = true
		}
	}
	if !incomingAddFound || containsTransmissionMethod(
		fixture.secondFake.recordedCalls(),
		"torrent-add",
	) {
		testingObject.Fatalf(
			"mid-delete add calls = target %v source %v",
			transmissionMethods(fixture.firstFake.recordedCalls()),
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}
}

// TestDeleteVPNConnectionStopsAfterTheFirstMoveFailure keeps the connection intact.
func TestDeleteVPNConnectionStopsAfterTheFirstMoveFailure(testingObject *testing.T) {
	const firstHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const secondHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	var addCount atomic.Int32
	var stateMutex sync.Mutex
	sourcePresent := map[string]bool{firstHash: true, secondHash: true}
	targetPresent := map[string]bool{}
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				requestedHash := requestedTransmissionHash(call)
				stateMutex.Lock()
				present := targetPresent[requestedHash]
				stateMutex.Unlock()
				if requestedHash != "" && present {
					return map[string]any{"torrents": []map[string]any{{
						"id": 71, "hashString": requestedHash, "name": "First move",
					}}}
				}

				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				if addCount.Add(1) == 1 {
					stateMutex.Lock()
					targetPresent[firstHash] = true
					stateMutex.Unlock()

					return map[string]any{"torrent-added": map[string]any{
						"id": 71, "hashString": firstHash, "name": "First move",
					}}
				}

				return map[string]any{"torrent-duplicate": map[string]any{
					"id": 72, "hashString": secondHash, "name": "Second move",
				}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				hash := requestedTransmissionHash(call)

				return torrentMoveSnapshotResponse(hash, 1, 0)
			}
			if call.Method == "torrent-get" {
				requestedHash := requestedTransmissionHash(call)
				stateMutex.Lock()
				defer stateMutex.Unlock()
				torrents := []map[string]any{}
				for index, hash := range []string{firstHash, secondHash} {
					if sourcePresent[hash] && (requestedHash == "" || requestedHash == hash) {
						torrents = append(torrents, map[string]any{
							"id": index + 9, "hashString": hash, "name": "Move torrent",
						})
					}
				}

				return map[string]any{"torrents": torrents}
			}
			if call.Method == "torrent-remove" {
				hash := requestedTransmissionHash(call)
				stateMutex.Lock()
				sourcePresent[hash] = false
				stateMutex.Unlock()
			}

			return map[string]any{}
		},
	)
	startFakeController(testingObject, fixture.server)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("partial move metainfo")}
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		`{"moveTo":"`+fixture.first.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusConflict ||
		!strings.Contains(response.Body.String(), `"code":"move_failed"`) ||
		!strings.Contains(response.Body.String(), `"hash":"`+firstHash+`","id":71,"name":"Moved torrent","result":"moved"`) ||
		!strings.Contains(response.Body.String(), `"hash":"`+secondHash+`","name":"Moved torrent","result":"failed"`) {
		testingObject.Fatalf("partial removal response = %d %s", response.Code, response.Body.String())
	}
	if _, err := fixture.server.store.VPNConnectionByID(
		context.Background(),
		fixture.second.ID,
	); err != nil {
		testingObject.Fatalf("partially moved connection was deleted: %v", err)
	}
	if addCount.Load() != 2 {
		testingObject.Fatalf("target add count = %d, want 2", addCount.Load())
	}
}

// TestConnectionRemovalMarkerRejectsMutationsAndRedirectsFacadeAdds covers the
// public conflict contract and the compatible RPC exception during moveTo deletion.
func TestConnectionRemovalMarkerRejectsMutationsAndRedirectsFacadeAdds(
	testingObject *testing.T,
) {
	const incomingHash = "cececececececececececececececececececece"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{{
					"id": 4, "hashString": firstTestHash, "name": "Existing torrent",
				}}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 84, "hashString": incomingHash, "name": "Incoming torrent",
				}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
	)
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	profile.MatchPatterns = []string{"Incoming*"}
	profile, err := fixture.server.store.UpdateTorrentProfile(
		context.Background(),
		profile.ID,
		profile,
	)
	if err != nil {
		testingObject.Fatalf("add removal-marker match pattern: %v", err)
	}

	fixture.server.markVPNConnectionRemoving(fixture.second.ID, fixture.first.ID)
	defer fixture.server.unmarkVPNConnectionRemoving(fixture.second.ID)
	for _, request := range []struct {
		name string
		path string
		body string
	}{
		{
			name: "torrent add",
			path: "/api/v1/torrents",
			body: `{"filename":"magnet:?xt=urn:btih:` + incomingHash +
				`","profileId":"` + profile.ID + `"}`,
		},
		{
			name: "torrent reassignment",
			path: "/api/v1/torrents/profile",
			body: `{"ids":[],"hashes":["` + firstTestHash +
				`"],"profileId":"` + profile.ID + `","applyOptions":false}`,
		},
		{
			name: "profile edit",
			path: "/api/v1/torrent-profiles/" + profile.ID,
			body: torrentProfileRequestWithConnection(
				testingObject,
				profile.Name,
				fixture.second.ID,
				false,
			),
		},
		{
			name: "proxy login",
			path: "/api/v1/web-proxy/logins",
			body: `{"username":"removal-login",` +
				`"connectionId":"` + fixture.second.ID + `"}`,
		},
	} {
		testingObject.Run(request.name, func(testingObject *testing.T) {
			method := http.MethodPost
			if request.name == "torrent reassignment" || request.name == "profile edit" {
				method = http.MethodPut
			}
			response := performRequest(
				testingObject,
				fixture.server,
				method,
				request.path,
				request.body,
				fixture.cookies,
				fixture.csrfToken,
			)
			if response.Code != http.StatusConflict ||
				!strings.Contains(response.Body.String(), `"code":"connection_being_removed"`) {
				testingObject.Fatalf(
					"removal mutation = %d %s",
					response.Code,
					response.Body.String(),
				)
			}
		})
	}

	moveResult, moveError := fixture.server.moveTorrent(
		context.Background(),
		firstTestHash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if !errors.Is(moveError, errConnectionBeingRemoved) || moveResult.Result != "failed" {
		testingObject.Fatalf("move into removing connection = %+v, %v", moveResult, moveError)
	}
	_, rpcResult := fixture.server.rpcFacadeTorrentAdd(
		context.Background(),
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + incomingHash + "&dn=Incoming+torrent",
		},
	)
	if rpcResult != "success" ||
		!containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatalf(
			"redirected facade add = %q, target %v, source %v",
			rpcResult,
			transmissionMethods(fixture.firstFake.recordedCalls()),
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}
}

// TestConnectionRemovalMarkerWaitsForReferenceWriter closes the pre-marker window:
// a save that already owns the relationship gate finishes before deletion is marked.
func TestConnectionRemovalMarkerWaitsForReferenceWriter(testingObject *testing.T) {
	server := &Server{vpnConnectionsRemoving: map[string]string{}}
	connectionID := "vpc-2222222222222222"
	releaseReference, removing := server.holdVPNConnectionReference(&connectionID)
	if removing {
		testingObject.Fatal("an unmarked connection was reported as being removed")
	}

	marked := make(chan struct{})
	go func() {
		server.markVPNConnectionRemoving(connectionID, "vpc-1111111111111111")
		close(marked)
	}()
	select {
	case <-marked:
		testingObject.Fatal("removal marker bypassed an in-flight reference writer")
	case <-time.After(25 * time.Millisecond):
	}
	releaseReference()
	select {
	case <-marked:
	case <-time.After(time.Second):
		testingObject.Fatal("removal marker did not resume after the reference writer")
	}
	defer server.unmarkVPNConnectionRemoving(connectionID)
	if target, found := server.vpnConnectionRemovalTarget(connectionID); !found || target != "vpc-1111111111111111" {
		testingObject.Fatalf("removal target = %q, found %t", target, found)
	}
}

func requestedTransmissionHash(call recordedTransmissionCall) string {
	ids, _ := call.Arguments["ids"].([]any)
	if len(ids) != 1 {
		return ""
	}
	hash, _ := ids[0].(string)

	return hash
}

func mapsCloneForTest(source map[string]any) map[string]any {
	cloned := make(map[string]any, len(source))
	for key, value := range source {
		cloned[key] = value
	}

	return cloned
}

type defaultVPNMoveTestState struct {
	sourcePresent atomic.Bool
	targetPresent atomic.Bool
	failTargetAdd bool
}

// TestSetDefaultVPNConnectionRequiresTorrentMoveConfirmation keeps the durable default unchanged.
//
// Since: 2.0.0
func TestSetDefaultVPNConnectionRequiresTorrentMoveConfirmation(testingObject *testing.T) {
	fixture, state := newDefaultVPNMoveTestFixture(testingObject, true, false)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusConflict {
		testingObject.Fatalf("unconfirmed default switch status %d: %s", response.Code, response.Body.String())
	}
	var body struct {
		Error struct {
			Code    string                `json:"code"`
			Details vpnDefaultMoveDetails `json:"details"`
		} `json:"error"`
	}
	decodeBody(testingObject, response, &body)
	if body.Error.Code != "torrents_must_move" ||
		body.Error.Details.Torrents != 1 ||
		body.Error.Details.DefaultProfileTorrents != 1 ||
		body.Error.Details.FollowingProfileTorrents != 0 {
		testingObject.Fatalf("confirmation conflict = %+v", body.Error)
	}
	if body.Error.Details.FromConnection.ID != fixture.first.ID ||
		body.Error.Details.ToConnection.ID != fixture.second.ID {
		testingObject.Fatalf("confirmation connections = %+v", body.Error.Details)
	}
	defaultConnection, err := fixture.server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != fixture.first.ID {
		testingObject.Fatalf("default after refused switch = %+v, %v", defaultConnection, err)
	}
	if !state.sourcePresent.Load() || state.targetPresent.Load() {
		testingObject.Fatalf(
			"torrent locations after refusal: source=%t target=%t",
			state.sourcePresent.Load(),
			state.targetPresent.Load(),
		)
	}
	if methods := transmissionMethods(fixture.secondFake.recordedCalls()); slicesContainForTest(methods, "torrent-add") {
		testingObject.Fatalf("refused switch reached target add: %v", methods)
	}
}

// TestSetDefaultVPNConnectionMovesFollowingProfileTorrents includes named profiles
// whose nil connection follows whichever VPN connection is currently the default.
func TestSetDefaultVPNConnectionMovesFollowingProfileTorrents(testingObject *testing.T) {
	fixture, state := newDefaultVPNMoveTestFixture(testingObject, true, false)
	profile, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                "tpr-00000000000000df",
			Name:              "Follows default",
			DownloadDirectory: "/data/downloads/follows-default",
			Labels:            []string{},
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 50,
				Queue:     "normal",
			},
			MatchPatterns: []string{},
		},
	)
	if err != nil {
		testingObject.Fatalf("create following profile: %v", err)
	}
	if err := fixture.server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{firstTestHash},
		&profile.ID,
	); err != nil {
		testingObject.Fatalf("assign following profile: %v", err)
	}
	if err := fixture.server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh following profile assignment: %v", err)
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusConflict {
		testingObject.Fatalf("following profile confirmation status %d: %s", response.Code, response.Body.String())
	}
	var conflict struct {
		Error struct {
			Code    string                `json:"code"`
			Details vpnDefaultMoveDetails `json:"details"`
		} `json:"error"`
	}
	decodeBody(testingObject, response, &conflict)
	if conflict.Error.Code != "torrents_must_move" ||
		conflict.Error.Details.Torrents != 1 ||
		conflict.Error.Details.DefaultProfileTorrents != 0 ||
		conflict.Error.Details.FollowingProfileTorrents != 1 {
		testingObject.Fatalf("following profile conflict = %+v", conflict.Error)
	}

	response = performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`","moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("following profile move status %d: %s", response.Code, response.Body.String())
	}
	var body struct {
		Moved []torrentMoveResult `json:"moved"`
	}
	decodeBody(testingObject, response, &body)
	if len(body.Moved) != 1 || body.Moved[0].Hash != firstTestHash ||
		body.Moved[0].Result != "moved" || state.sourcePresent.Load() || !state.targetPresent.Load() {
		testingObject.Fatalf("following profile move = %+v, source=%t target=%t", body.Moved, state.sourcePresent.Load(), state.targetPresent.Load())
	}
}

// TestSetDefaultVPNConnectionMovesDefaultProfileTorrents reports the completed move.
//
// Since: 2.0.0
func TestSetDefaultVPNConnectionMovesDefaultProfileTorrents(testingObject *testing.T) {
	fixture, state := newDefaultVPNMoveTestFixture(testingObject, true, false)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`","moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("confirmed default switch status %d: %s", response.Code, response.Body.String())
	}
	var body struct {
		Moved []torrentMoveResult `json:"moved"`
	}
	decodeBody(testingObject, response, &body)
	if len(body.Moved) != 1 || body.Moved[0].Hash != firstTestHash || body.Moved[0].Result != "moved" {
		testingObject.Fatalf("default switch move results = %+v", body.Moved)
	}
	defaultConnection, err := fixture.server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != fixture.second.ID {
		testingObject.Fatalf("default after confirmed switch = %+v, %v", defaultConnection, err)
	}
	if state.sourcePresent.Load() || !state.targetPresent.Load() {
		testingObject.Fatalf(
			"torrent locations after move: source=%t target=%t",
			state.sourcePresent.Load(),
			state.targetPresent.Load(),
		)
	}
	sourceMethods := transmissionMethods(fixture.firstFake.recordedCalls())
	targetMethods := transmissionMethods(fixture.secondFake.recordedCalls())
	if !slicesContainForTest(sourceMethods, "torrent-remove") || !slicesContainForTest(targetMethods, "torrent-add") {
		testingObject.Fatalf("move methods: source=%v target=%v", sourceMethods, targetMethods)
	}
}

// TestSetDefaultVPNConnectionKeepsFailedMoveOnSource applies the default independently.
//
// Since: 2.0.0
func TestSetDefaultVPNConnectionKeepsFailedMoveOnSource(testingObject *testing.T) {
	fixture, state := newDefaultVPNMoveTestFixture(testingObject, true, true)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`","moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("failed-move default switch status %d: %s", response.Code, response.Body.String())
	}
	var body struct {
		Moved []torrentMoveResult `json:"moved"`
	}
	decodeBody(testingObject, response, &body)
	if len(body.Moved) != 1 || body.Moved[0].Result != "failed" || body.Moved[0].Error == "" {
		testingObject.Fatalf("failed default switch move results = %+v", body.Moved)
	}
	defaultConnection, err := fixture.server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != fixture.second.ID {
		testingObject.Fatalf("default after failed move = %+v, %v", defaultConnection, err)
	}
	if !state.sourcePresent.Load() || state.targetPresent.Load() {
		testingObject.Fatalf(
			"torrent locations after failed move: source=%t target=%t",
			state.sourcePresent.Load(),
			state.targetPresent.Load(),
		)
	}
	if methods := transmissionMethods(fixture.firstFake.recordedCalls()); slicesContainForTest(methods, "torrent-remove") {
		testingObject.Fatalf("failed add removed the source: %v", methods)
	}
}

// TestSetDefaultVPNConnectionWithoutTorrentsNeedsNoConfirmation preserves the simple path.
//
// Since: 2.0.0
func TestSetDefaultVPNConnectionWithoutTorrentsNeedsNoConfirmation(testingObject *testing.T) {
	fixture, _ := newDefaultVPNMoveTestFixture(testingObject, false, false)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"moved":[]`) {
		testingObject.Fatalf("empty default switch status %d: %s", response.Code, response.Body.String())
	}
	defaultConnection, err := fixture.server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != fixture.second.ID {
		testingObject.Fatalf("default after empty switch = %+v, %v", defaultConnection, err)
	}
	if methods := transmissionMethods(fixture.secondFake.recordedCalls()); slicesContainForTest(methods, "torrent-add") {
		testingObject.Fatalf("empty switch reached target add: %v", methods)
	}
}

func newDefaultVPNMoveTestFixture(
	testingObject *testing.T,
	sourcePresent bool,
	failTargetAdd bool,
) (multiTransmissionFixture, *defaultVPNMoveTestState) {
	testingObject.Helper()

	state := &defaultVPNMoveTestState{failTargetAdd: failTargetAdd}
	state.sourcePresent.Store(sourcePresent)
	firstRespond := func(call recordedTransmissionCall) any {
		switch call.Method {
		case "torrent-get":
			if !state.sourcePresent.Load() {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(firstTestHash, 0, 4)
			}

			return defaultVPNMoveTorrentResponse(firstTestHash)
		case "torrent-remove":
			state.sourcePresent.Store(false)
		}

		return map[string]any{}
	}
	secondRespond := func(call recordedTransmissionCall) any {
		switch call.Method {
		case "torrent-get":
			if state.targetPresent.Load() {
				return defaultVPNMoveTorrentResponse(firstTestHash)
			}

			return map[string]any{"torrents": []map[string]any{}}
		case "torrent-add":
			if state.failTargetAdd {
				return fakeTransmissionResponse{Result: "mock target add failure"}
			}
			state.targetPresent.Store(true)

			return map[string]any{"torrent-added": map[string]any{
				"hashString": firstTestHash,
				"id":         11,
				"name":       "Moved torrent",
			}}
		case "torrent-remove":
			state.targetPresent.Store(false)
		}

		return map[string]any{}
	}
	fixture := newMultiTransmissionFixture(testingObject, firstRespond, secondRespond)
	startFakeController(testingObject, fixture.server)

	return fixture, state
}

func defaultVPNMoveTorrentResponse(hash string) map[string]any {
	return map[string]any{"torrents": []map[string]any{{
		"downloadDir": "/data/downloads",
		"hashString":  hash,
		"id":          7,
		"name":        "Moved torrent",
	}}}
}

func slicesContainForTest(values []string, candidate string) bool {
	for _, value := range values {
		if value == candidate {
			return true
		}
	}

	return false
}

func storeTestCatalogVPNProfile(
	testingObject *testing.T,
	server *Server,
	providerID string,
	tunnel string,
	profileID string,
) string {
	testingObject.Helper()
	configuration := []byte("client\nproto udp\nremote 192.0.2.10 1194\n")
	nonce, ciphertext, err := security.EncryptSecret(
		server.installationKey,
		"vpn/profile/"+profileID,
		configuration,
	)
	clear(configuration)
	if err != nil {
		testingObject.Fatalf("encrypt test VPN profile: %v", err)
	}
	if err := server.store.ReplaceVPNCatalog(
		context.Background(),
		providerID,
		tunnel,
		"https://example.test/catalog",
		[]storage.EncryptedVPNProfile{{
			ID:          profileID,
			ProviderID:  providerID,
			Tunnel:      tunnel,
			DisplayName: profileID,
			Protocol:    "udp",
			RemoteHost:  "192.0.2.10",
			RemotePort:  1194,
			Fingerprint: "0123456789abcdef",
			Source:      "official-catalog",
			Nonce:       nonce,
			Ciphertext:  ciphertext,
		}},
	); err != nil {
		testingObject.Fatalf("store test VPN catalog profile: %v", err)
	}

	return profileID
}
