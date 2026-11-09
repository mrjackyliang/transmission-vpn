package api

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// fakeController answers controller commands over a real Unix socket.
//
// A held connect or restore stands in for a long pool test, and the last connecting
// action is recorded so a test can tell a restore from a connect.
type fakeController struct {
	mutex           sync.Mutex
	state           string
	connects        int
	lastConnect     string
	connectionID    string
	slot            int
	holdConnect     chan struct{}
	connectSeen     chan struct{}
	disconnectFails bool
	omitSession     bool
	statusesMissing bool
	statuses        map[string]controller.Status
	restoreRequests []controller.Request
}

// startFakeController serves a fake controller and points the server at it.
//
// Unix socket paths are short on macOS, so the socket skips the long test directory.
func startFakeController(t *testing.T, server *Server) *fakeController {
	t.Helper()

	directory, err := os.MkdirTemp("", "tvpn-")
	if err != nil {
		t.Fatalf("create socket directory: %v", err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(directory) })

	socketPath := filepath.Join(directory, "controller.sock")
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatalf("listen on fake controller socket: %v", err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	fake := &fakeController{
		state:       "blocked",
		connectSeen: make(chan struct{}, 16),
		statuses:    map[string]controller.Status{},
	}
	go func() {
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}

			go fake.serve(connection)
		}
	}()
	server.controller = controller.NewClient(socketPath, 5*time.Second)

	return fake
}

// serve answers one command the way the controller would.
func (fake *fakeController) serve(connection net.Conn) {
	defer connection.Close()

	var request controller.Request
	if err := json.NewDecoder(connection).Decode(&request); err != nil {
		return
	}

	switch request.Action {
	case "status":
		fake.mutex.Lock()
		statusesMissing := fake.statusesMissing
		statuses := make([]controller.Status, 0, len(fake.statuses))
		for _, status := range fake.statuses {
			statuses = append(statuses, status)
		}
		fake.mutex.Unlock()
		if statusesMissing {
			statuses = []controller.Status{}
		}
		_ = json.NewEncoder(connection).Encode(controller.Response{
			OK:       true,
			Statuses: statuses,
		})

		return
	case "connect", "restore":
		fake.mutex.Lock()
		fake.connects++
		fake.lastConnect = request.Action
		fake.connectionID = request.ConnectionID
		fake.slot = request.Slot
		fake.statusesMissing = false
		fake.statuses[request.ConnectionID] = controller.Status{
			ConnectionID: request.ConnectionID,
			Slot:         request.Slot,
			Default:      request.Default,
			State:        "connecting",
		}
		if request.Action == "restore" {
			fake.restoreRequests = append(fake.restoreRequests, request)
		}
		hold := fake.holdConnect
		fake.mutex.Unlock()
		fake.connectSeen <- struct{}{}
		if hold != nil {
			<-hold
		}
		fake.setConnectionState(request.ConnectionID, "protected", false)
	case "disconnect":
		if fake.failsDisconnects() {
			_ = json.NewEncoder(connection).Encode(controller.Response{Error: "the firewall could not be updated"})

			return
		}
		fake.setConnectionState(request.ConnectionID, "blocked", false)
	case "set-default":
		fake.mutex.Lock()
		for id, status := range fake.statuses {
			status.Default = id == request.ConnectionID
			fake.statuses[id] = status
		}
		status, found := fake.statuses[request.ConnectionID]
		if !found {
			status = controller.Status{
				ConnectionID: request.ConnectionID,
				State:        "blocked",
				DNSServers:   []string{},
			}
		}
		status.Default = true
		fake.statuses[request.ConnectionID] = status
		fake.connectionID = request.ConnectionID
		fake.slot = status.Slot
		fake.state = status.State
		fake.mutex.Unlock()
	}

	status := fake.status(request.ConnectionID, request.Slot, request.Default)
	_ = json.NewEncoder(connection).Encode(controller.Response{OK: true, Status: &status})
}

// status returns session fields unless a test deliberately simulates stale state.
func (fake *fakeController) status(connectionID string, slot int, isDefault bool) controller.Status {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	if status, found := fake.statuses[connectionID]; found {
		return status
	}
	status := controller.Status{
		ConnectionID: connectionID,
		Slot:         slot,
		Default:      isDefault,
		State:        fake.state,
	}
	if fake.state == "protected" && !fake.omitSession {
		status.Interface = "wg" + strconv.Itoa(slot)
		status.Address = "10.68.0.2"
	}

	return status
}

// hold makes every later connect wait until the returned channel closes.
func (fake *fakeController) hold() chan struct{} {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	fake.holdConnect = make(chan struct{})

	return fake.holdConnect
}

// failDisconnects makes every later disconnect fail without blocking.
func (fake *fakeController) failDisconnects() {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	fake.disconnectFails = true
}

func (fake *fakeController) failsDisconnects() bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return fake.disconnectFails
}

func (fake *fakeController) setState(state string) {
	fake.setConnectionState(fake.connectionID, state, false)
}

func (fake *fakeController) setConnectionState(connectionID string, state string, omitSession bool) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	fake.state = state
	fake.omitSession = omitSession
	status := fake.statuses[connectionID]
	status.ConnectionID = connectionID
	status.State = state
	if state == "protected" && !omitSession {
		status.Interface = "wg" + strconv.Itoa(status.Slot)
		status.Address = "10.68.0.2"
	} else {
		status.Interface = ""
		status.Address = ""
	}
	fake.statuses[connectionID] = status
}

// setProtectedWithoutSession simulates a stale status after failed teardown.
func (fake *fakeController) setProtectedWithoutSession() {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	fake.state = "protected"
	fake.omitSession = true
	status := fake.statuses[fake.connectionID]
	status.State = "protected"
	status.Interface = ""
	status.Address = ""
	fake.statuses[fake.connectionID] = status
}

// restart simulates a fresh controller that has no in-memory connection states.
func (fake *fakeController) restart() {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	fake.state = "blocked"
	fake.connectionID = ""
	fake.slot = 0
	fake.omitSession = false
	fake.statusesMissing = true
	fake.statuses = map[string]controller.Status{}
}

func (fake *fakeController) currentState() string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return fake.state
}

func (fake *fakeController) connectCount() int {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return fake.connects
}

func (fake *fakeController) lastConnectAction() string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return fake.lastConnect
}

// restoredRequests returns a stable copy of every restore command received.
func (fake *fakeController) restoredRequests() []controller.Request {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return append([]controller.Request(nil), fake.restoreRequests...)
}

// waitForConnect fails the test unless a connect reaches the fake controller soon.
func (fake *fakeController) waitForConnect(t *testing.T) {
	t.Helper()

	select {
	case <-fake.connectSeen:
	case <-time.After(10 * time.Second):
		t.Fatal("the connect did not reach the controller")
	}
}

// TestVPNCommandGateScopesCommandsByConnectionAndWaitsGlobally covers the E4 gate.
func TestVPNCommandGateScopesCommandsByConnectionAndWaitsGlobally(t *testing.T) {
	gate := &vpnCommandGate{}
	releaseFirst, claimed := gate.beginConnection("first")
	if !claimed {
		t.Fatal("first connection command was not claimed")
	}
	firstReleased := false
	defer func() {
		if !firstReleased {
			releaseFirst()
		}
	}()
	releaseSecond, claimed := gate.beginConnection("second")
	if !claimed {
		t.Fatal("an unrelated connection command was blocked")
	}
	secondReleased := false
	defer func() {
		if !secondReleased {
			releaseSecond()
		}
	}()
	if _, sameClaimed := gate.beginConnection("first"); sameClaimed {
		t.Fatal("a second command claimed the same connection")
	}

	type globalClaim struct {
		release func()
		claimed bool
	}
	globalResult := make(chan globalClaim, 1)
	go func() {
		release, globalClaimed := gate.beginGlobal()
		globalResult <- globalClaim{release: release, claimed: globalClaimed}
	}()
	deadline := time.Now().Add(time.Second)
	for !gate.globalRunning() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if !gate.globalRunning() {
		t.Fatal("the global command did not start waiting")
	}
	select {
	case <-globalResult:
		t.Fatal("the global command did not wait for connection commands")
	default:
	}
	if _, thirdClaimed := gate.beginConnection("third"); thirdClaimed {
		t.Fatal("a new connection command bypassed the waiting global command")
	}

	releaseFirst()
	firstReleased = true
	releaseSecond()
	secondReleased = true
	select {
	case result := <-globalResult:
		if !result.claimed || result.release == nil {
			t.Fatalf("global claim = %+v", result)
		}
		result.release()
	case <-time.After(time.Second):
		t.Fatal("the global command did not claim after connection commands finished")
	}
}

// uploadTestWireGuardProfile stores a custom WireGuard file and returns its ID.
func uploadTestWireGuardProfile(t *testing.T, server *Server, cookies []*http.Cookie, csrfToken string) string {
	t.Helper()

	body, _ := json.Marshal(map[string]string{
		"tunnel":      provider.TunnelWireGuard,
		"profileName": "home.conf",
		"profile": `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 10.0.0.2/32
DNS = 10.0.0.1

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = vpn.example.test:51820
AllowedIPs = 0.0.0.0/0
`,
	})
	upload := performRequest(t, server, http.MethodPost, "/api/v1/vpn/profiles/custom", string(body), cookies, csrfToken)
	if upload.Code != http.StatusCreated {
		t.Fatalf("upload status %d: %s", upload.Code, upload.Body.String())
	}

	var uploaded struct {
		ID string `json:"id"`
	}
	decodeBody(t, upload, &uploaded)

	return uploaded.ID
}

// testConnectBody tests one custom WireGuard profile against connection revision 0.
func testConnectBody(profileID string) string {
	return `{"expectedRevision":0,"providerId":"custom","tunnel":"wireguard","profileIds":["` + profileID + `"],"credentials":{},"dnsServers":[]}`
}

// TestVPNConnectCreatesTheDefaultConnection moves the singleton route onto row storage.
func TestVPNConnectCreatesTheDefaultConnection(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)
	if _, err := server.store.DefaultVPNConnection(context.Background()); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("default before connect error = %v", err)
	}

	body := `{"expectedRevision":0,"providerId":"custom","tunnel":"wireguard","profileIds":["` + profileID + `"],"credentials":{},"dnsServers":[],"peerPort":42370}`
	connected := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", body, cookies, csrfToken)
	if connected.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connected.Code, connected.Body.String())
	}
	var connectedBody struct {
		Revision int64 `json:"revision"`
	}
	decodeBody(t, connected, &connectedBody)
	if connectedBody.Revision != 1 {
		t.Fatalf("created revision = %d, want 1", connectedBody.Revision)
	}

	created, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil {
		t.Fatalf("read created default: %v", err)
	}
	if created.Slot != 0 || !created.IsDefault || created.Name != "Custom" ||
		created.PeerPort != 42370 || created.Revision != 1 {
		t.Fatalf("created default = %+v", created)
	}

	status := performRequest(t, server, http.MethodGet, "/api/v1/vpn/status", "", cookies, "")
	if status.Code != http.StatusOK {
		t.Fatalf("status code %d: %s", status.Code, status.Body.String())
	}
	var statusBody struct {
		Configuration struct {
			ConnectionID string `json:"connectionId"`
			Name         string `json:"name"`
			Slot         int    `json:"slot"`
			PeerPort     int    `json:"peerPort"`
			Revision     int64  `json:"revision"`
		} `json:"configuration"`
	}
	decodeBody(t, status, &statusBody)
	if statusBody.Configuration.ConnectionID != created.ID ||
		statusBody.Configuration.Name != created.Name ||
		statusBody.Configuration.Slot != 0 ||
		statusBody.Configuration.PeerPort != 42370 ||
		statusBody.Configuration.Revision != 1 {
		t.Fatalf("VPN status = %s", status.Body.String())
	}
}

// TestVPNConnectRejectsAStaleConnectionRevision protects the tested row update.
func TestVPNConnectRejectsAStaleConnectionRevision(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	first := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	if first.Code != http.StatusOK {
		t.Fatalf("first connect status %d: %s", first.Code, first.Body.String())
	}
	stale := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	expectError(
		t,
		stale,
		http.StatusConflict,
		"vpn_commit_conflict",
		"The VPN connection changed while the candidate was tested. The prior configuration was restored.",
	)
}

// TestVPNChangesRunOneAtATime refuses a second change while a test still runs.
//
// The controller lets the newest command win, so an overlapping disconnect or
// reconnect would cancel the test between its connect and its commit.
func TestVPNChangesRunOneAtATime(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	hold := fake.hold()
	connected := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		connected <- performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	}()
	fake.waitForConnect(t)

	for path, body := range map[string]string{
		"/api/v1/vpn/connect":    testConnectBody(profileID),
		"/api/v1/vpn/reconnect":  "",
		"/api/v1/vpn/disconnect": "",
	} {
		response := performRequest(t, server, http.MethodPost, path, body, cookies, csrfToken)
		expectError(t, response, http.StatusConflict, "vpn_change_running", "Another VPN change is still running. Try again when it finishes.")
	}

	close(hold)
	select {
	case response := <-connected:
		if response.Code != http.StatusOK {
			t.Fatalf("connect status %d: %s", response.Code, response.Body.String())
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the connect did not finish")
	}

	disconnect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/disconnect", "", cookies, csrfToken)
	if disconnect.Code != http.StatusOK {
		t.Fatalf("disconnect after the test status %d: %s", disconnect.Code, disconnect.Body.String())
	}
}

// TestVPNChangeRunningSurvivesStatusReload exposes the administrator command gate.
//
// Both status surfaces stay true for a held connect and false after it finishes or
// while only the background restore owns the controller.
func TestVPNChangeRunningSurvivesStatusReload(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	hold := fake.hold()
	connected := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		body := `{"expectedRevision":0,"providerId":"custom","tunnel":"wireguard","profileIds":["` + profileID + `"],"credentials":{},"dnsServers":[],"retryIntervalSeconds":37}`
		connected <- performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", body, cookies, csrfToken)
	}()
	fake.waitForConnect(t)

	status := performRequest(t, server, http.MethodGet, "/api/v1/vpn/status", "", cookies, "")
	if status.Code != http.StatusOK {
		t.Fatalf("status during connect = %d: %s", status.Code, status.Body.String())
	}
	var statusBody struct {
		ChangeRunning bool `json:"changeRunning"`
	}
	decodeBody(t, status, &statusBody)
	if !statusBody.ChangeRunning {
		t.Fatalf("status during connect = %s", status.Body.String())
	}
	live := server.buildLiveSnapshot(context.Background(), 1)
	if live.VPN == nil || !live.VPN.ChangeRunning {
		t.Fatalf("live VPN during connect = %+v", live.VPN)
	}

	close(hold)
	select {
	case response := <-connected:
		if response.Code != http.StatusOK {
			t.Fatalf("connect status %d: %s", response.Code, response.Body.String())
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the connect did not finish")
	}

	status = performRequest(t, server, http.MethodGet, "/api/v1/vpn/status", "", cookies, "")
	var finishedBody struct {
		ChangeRunning bool `json:"changeRunning"`
		Configuration struct {
			RetrySeconds int `json:"retrySeconds"`
		} `json:"configuration"`
	}
	decodeBody(t, status, &finishedBody)
	if finishedBody.ChangeRunning || finishedBody.Configuration.RetrySeconds != 37 {
		t.Fatalf("status after connect = %s", status.Body.String())
	}

	_, releaseRestore, claimed := server.vpnCommands.beginRestore(context.Background())
	if !claimed {
		t.Fatal("background restore could not claim an idle gate")
	}
	status = performRequest(t, server, http.MethodGet, "/api/v1/vpn/status", "", cookies, "")
	decodeBody(t, status, &statusBody)
	if statusBody.ChangeRunning {
		t.Fatalf("status during background restore = %s", status.Body.String())
	}
	live = server.buildLiveSnapshot(context.Background(), 2)
	if live.VPN == nil || live.VPN.ChangeRunning {
		t.Fatalf("live VPN during background restore = %+v", live.VPN)
	}
	releaseRestore()
}

// TestVPNConnectFinishesWhenTheBrowserLeaves saves a passed test without its browser.
//
// A closed tab or a reverse proxy timeout cancels the request, but the controller
// keeps the tunnel it verified, so the saved configuration must follow it.
func TestVPNConnectFinishesWhenTheBrowserLeaves(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	hold := fake.hold()
	requestContext, cancelRequest := context.WithCancel(context.Background())
	request := httptest.NewRequest(http.MethodPost, "/api/v1/vpn/connect", strings.NewReader(testConnectBody(profileID))).
		WithContext(requestContext)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-CSRF-Token", csrfToken)
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	finished := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		finished <- response
	}()
	fake.waitForConnect(t)
	cancelRequest()
	close(hold)

	select {
	case response := <-finished:
		if response.Code != http.StatusOK {
			t.Fatalf("connect status %d: %s", response.Code, response.Body.String())
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the connect did not finish")
	}

	active, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil || !active.Enabled || len(active.ProfileIDs) != 1 || active.ProfileIDs[0] != profileID {
		t.Fatalf("saved configuration = %+v, %v", active, err)
	}
}

// TestVPNConnectWithoutDNSServersUsesTheProviderDNS saves a test that names no resolvers.
//
// The console always sends an empty list, but an API client may leave the field out,
// and that must mean the provider's DNS instead of a failed save after a passed test.
func TestVPNConnectWithoutDNSServersUsesTheProviderDNS(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	body := `{"expectedRevision":0,"providerId":"custom","tunnel":"wireguard","profileIds":["` + profileID + `"],"credentials":{}}`
	connect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", body, cookies, csrfToken)
	if connect.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connect.Code, connect.Body.String())
	}

	active, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil || len(active.DNSServers) != 0 {
		t.Fatalf("saved DNS servers = %q, %v", active.DNSServers, err)
	}
}

// TestDisconnectTurnsReconnectsOffFirst keeps the background restore away from a disconnect.
//
// The API reconnects a blocked controller while automatic reconnects are on, so a
// disconnect turns them off before it blocks, even when the controller then fails.
func TestDisconnectTurnsReconnectsOffFirst(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	connect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	if connect.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connect.Code, connect.Body.String())
	}

	fake.failDisconnects()
	disconnect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/disconnect", "", cookies, csrfToken)
	expectError(t, disconnect, http.StatusServiceUnavailable, "vpn_disconnect_failed", "The VPN controller could not confirm the blocked state.")

	active, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil || active.Enabled {
		t.Fatalf("automatic reconnects after the failed disconnect = %v, %v, want off", active.Enabled, err)
	}
}

// TestRestoreReconnectsEveryEnabledConnectionAfterControllerRestart covers lost state.
//
// A restarted controller reports an empty status list because its connection map was
// in memory. Every enabled stored connection must be restored, not only the default.
func TestRestoreReconnectsEveryEnabledConnectionAfterControllerRestart(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	connect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	if connect.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connect.Code, connect.Body.String())
	}
	fake.waitForConnect(t)

	secondConnectionID, err := storage.NewVPNConnectionID()
	if err != nil {
		t.Fatalf("generate second connection identifier: %v", err)
	}
	credentialNonce, credentialCiphertext, err := security.EncryptSecret(
		server.installationKey,
		"vpn/connection/"+secondConnectionID,
		[]byte("{}"),
	)
	if err != nil {
		t.Fatalf("encrypt second connection credentials: %v", err)
	}
	secondConnection, err := server.store.CreateVPNConnection(
		context.Background(),
		storage.EncryptedVPNConnection{
			ID:                    secondConnectionID,
			Name:                  "Secondary",
			Enabled:               true,
			ProviderID:            "custom",
			Tunnel:                provider.TunnelWireGuard,
			ProfileIDs:            []string{profileID},
			EndpointStrategy:      "sticky",
			CredentialsNonce:      credentialNonce,
			CredentialsCiphertext: credentialCiphertext,
			DNSServers:            []string{},
			RetryIntervalSeconds:  10,
			PeerPort:              storage.DefaultVPNPeerPort,
		},
	)
	if err != nil {
		t.Fatalf("create second VPN connection: %v", err)
	}

	defaultConnection, err := server.store.DefaultVPNConnection(context.Background())
	if err != nil {
		t.Fatalf("read default VPN connection: %v", err)
	}
	fake.restart()

	if err := server.RestoreActiveVPN(context.Background()); err != nil {
		t.Fatalf("restore after controller restart: %v", err)
	}
	restoreRequests := fake.restoredRequests()
	if len(restoreRequests) != 2 {
		t.Fatalf("restore command count = %d, want 2", len(restoreRequests))
	}
	requestsByID := map[string]controller.Request{}
	for _, request := range restoreRequests {
		requestsByID[request.ConnectionID] = request
	}
	if request := requestsByID[defaultConnection.ID]; request.Slot != defaultConnection.Slot || !request.Default {
		t.Fatalf("default restore command = %+v", request)
	}
	if request := requestsByID[secondConnection.ID]; request.Slot != secondConnection.Slot || request.Default {
		t.Fatalf("secondary restore command = %+v", request)
	}
}

// TestRestoreRunsIndependentlyAndSkipsAChangedQueuedRow protects a long restore pass.
//
// Four dead endpoint pools may run at once, while a fifth row is re-read after it
// reaches the semaphore and is ignored when an administrator changed its revision.
func TestRestoreRunsIndependentlyAndSkipsAChangedQueuedRow(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)
	connect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	if connect.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connect.Code, connect.Body.String())
	}
	fake.waitForConnect(t)

	for index := 1; index < 5; index++ {
		connectionID, err := storage.NewVPNConnectionID()
		if err != nil {
			t.Fatalf("generate connection %d identifier: %v", index, err)
		}
		nonce, ciphertext, err := security.EncryptSecret(
			server.installationKey,
			"vpn/connection/"+connectionID,
			[]byte("{}"),
		)
		if err != nil {
			t.Fatalf("encrypt connection %d credentials: %v", index, err)
		}
		if _, err := server.store.CreateVPNConnection(context.Background(), storage.EncryptedVPNConnection{
			ID:                    connectionID,
			Name:                  "Restore " + strconv.Itoa(index),
			Enabled:               true,
			ProviderID:            "custom",
			Tunnel:                provider.TunnelWireGuard,
			ProfileIDs:            []string{profileID},
			EndpointStrategy:      "sticky",
			CredentialsNonce:      nonce,
			CredentialsCiphertext: ciphertext,
			DNSServers:            []string{},
			RetryIntervalSeconds:  10,
			PeerPort:              storage.DefaultVPNPeerPort + index,
		}); err != nil {
			t.Fatalf("create restore connection %d: %v", index, err)
		}
	}
	configurations, err := server.store.ListVPNConnections(context.Background())
	if err != nil {
		t.Fatalf("list restore connections: %v", err)
	}

	fake.restart()
	hold := fake.hold()
	finished := make(chan error, 1)
	go func() { finished <- server.RestoreActiveVPN(context.Background()) }()
	for range 4 {
		fake.waitForConnect(t)
	}
	select {
	case <-fake.connectSeen:
		t.Fatal("a fifth restore bypassed the four-connection limit")
	case <-time.After(100 * time.Millisecond):
	}

	restoredIDs := map[string]struct{}{}
	for _, request := range fake.restoredRequests() {
		restoredIDs[request.ConnectionID] = struct{}{}
	}
	var queued storage.EncryptedVPNConnection
	for _, configuration := range configurations {
		if _, restored := restoredIDs[configuration.ID]; !restored {
			queued = configuration
			break
		}
	}
	if queued.ID == "" {
		t.Fatal("no queued restore connection remained")
	}
	queued.Name += " changed"
	if _, err := server.store.UpdateVPNConnection(
		context.Background(),
		queued.ID,
		queued.Revision,
		queued,
	); err != nil {
		t.Fatalf("change queued restore connection: %v", err)
	}
	close(hold)
	select {
	case err := <-finished:
		if err != nil {
			t.Fatalf("restore pass error = %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("restore pass did not finish")
	}
	for _, request := range fake.restoredRequests() {
		if request.ConnectionID == queued.ID {
			t.Fatalf("changed queued connection was restored: %+v", request)
		}
	}
}

// TestRestoreStepsAsideAndLeavesAConnectionAlone keeps the background restore out of the way.
//
// The restore leaves complete protected sessions alone, and an administrator's change
// cancels a restore that is still waiting for its pool instead of waiting behind it.
func TestRestoreStepsAsideAndLeavesAConnectionAlone(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	fake := startFakeController(t, server)
	profileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)

	connect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/connect", testConnectBody(profileID), cookies, csrfToken)
	if connect.Code != http.StatusOK {
		t.Fatalf("connect status %d: %s", connect.Code, connect.Body.String())
	}
	fake.waitForConnect(t)

	if err := server.RestoreActiveVPN(context.Background()); err != nil || fake.connectCount() != 1 {
		t.Fatalf("restore of a protected controller = %v after %d connects", err, fake.connectCount())
	}

	fake.setProtectedWithoutSession()
	if err := server.RestoreActiveVPN(context.Background()); err != nil || fake.connectCount() != 2 {
		t.Fatalf("restore of protected state without a session = %v after %d connects", err, fake.connectCount())
	}
	if fake.lastConnectAction() != "restore" {
		t.Fatalf("sessionless restore sent %q, want restore", fake.lastConnectAction())
	}
	fake.waitForConnect(t)

	fake.setState("blocked")
	if err := server.RestoreActiveVPN(context.Background()); err != nil || fake.connectCount() != 3 {
		t.Fatalf("restore of a blocked controller = %v after %d connects", err, fake.connectCount())
	}
	if fake.lastConnectAction() != "restore" {
		t.Fatalf("the restore sent %q, want the restore command without a time limit", fake.lastConnectAction())
	}
	fake.waitForConnect(t)

	fake.setState("blocked")
	hold := fake.hold()
	defer close(hold)
	restored := make(chan error, 1)
	go func() {
		restored <- server.RestoreActiveVPN(context.Background())
	}()
	fake.waitForConnect(t)

	disconnect := performRequest(t, server, http.MethodPost, "/api/v1/vpn/disconnect", "", cookies, csrfToken)
	if disconnect.Code != http.StatusOK {
		t.Fatalf("disconnect during the restore status %d: %s", disconnect.Code, disconnect.Body.String())
	}
	select {
	case err := <-restored:
		if !errors.Is(err, ErrVPNRestoreDeferred) {
			t.Fatalf("the interrupted restore = %v, want ErrVPNRestoreDeferred", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the restore did not step aside")
	}

	if err := server.RestoreActiveVPN(context.Background()); err != nil || fake.connectCount() != 4 {
		t.Fatalf("restore after the disconnect = %v after %d connects", err, fake.connectCount())
	}
}
