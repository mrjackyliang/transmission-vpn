package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strconv"
	"testing"
	"time"
)

// TestSettingsOmitConnectionOwnedKeys keeps retired values out of the public schema.
func TestSettingsOmitConnectionOwnedKeys(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	response := performRequest(testingObject, server, http.MethodGet, "/api/v1/settings", "", cookies, "")
	if response.Code != http.StatusOK {
		testingObject.Fatalf("settings status %d: %s", response.Code, response.Body.String())
	}

	var body struct {
		Settings []struct {
			Key string `json:"key"`
		} `json:"settings"`
	}
	decodeBody(testingObject, response, &body)
	retired := []string{
		"transmission.peerPort",
		"vpn.customDNSServers",
		"vpn.dnsMode",
		"vpn.endpointIdentifiers",
		"vpn.endpointStrategy",
		"vpn.provider",
		"vpn.retryIntervalSeconds",
		"vpn.tunnel",
	}
	for _, setting := range body.Settings {
		if slices.Contains(retired, setting.Key) {
			testingObject.Fatalf("retired setting %s is still public", setting.Key)
		}
	}
}

// TestSettingsRuntimeApplyListsAreArrays answers every save with two key lists.
//
// The console's schema rejects null, so a save that Transmission takes only after a
// restart, or one that can't reach Transmission yet, still lists its keys as arrays.
func TestSettingsRuntimeApplyListsAreArrays(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	for revision, changes := range []string{
		`{"transmission.downloadDirectory":"/data/new-downloads"}`,
		`{"transmission.downloadQueueSize":7}`,
	} {
		response := performRequest(t, server, http.MethodPut, "/api/v1/settings",
			`{"expectedRevision":`+strconv.Itoa(revision)+`,"changes":`+changes+`}`, cookies, csrfToken)
		if response.Code != http.StatusOK {
			t.Fatalf("save %s status %d: %s", changes, response.Code, response.Body.String())
		}

		var saved struct {
			RuntimeApply map[string]json.RawMessage `json:"runtimeApply"`
		}
		decodeBody(t, response, &saved)
		for _, list := range []string{"appliedKeys", "pendingKeys"} {
			if value := string(saved.RuntimeApply[list]); value == "" || value == "null" {
				t.Fatalf("save %s answered %s = %q, want an array", changes, list, value)
			}
		}
	}
}

// TestSettingsSaveRefreshesCompatibleRPCState updates the request-time memory gate.
//
// Compatible RPC authentication must not query settings on each request, so a
// successful settings transaction publishes its managed-aware value in memory.
//
// Since: UNRELEASED
func TestSettingsSaveRefreshesCompatibleRPCState(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	if server.rpcCompatibilityAllowed.Load() {
		testingObject.Fatal("compatible RPC started enabled")
	}

	rejected := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"rpc.compatibilityEnabled":true}}`,
		cookies,
		csrfToken,
	)
	expectError(
		testingObject,
		rejected,
		http.StatusConflict,
		"vpn_connection_required",
		"Add a VPN connection before turning on the RPC proxy.",
	)
	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Settings RPC VPN",
		profileID,
		51_413,
	)
	response := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"rpc.compatibilityEnabled":true}}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("enable compatible RPC status %d: %s", response.Code, response.Body.String())
	}
	if !server.rpcCompatibilityAllowed.Load() {
		testingObject.Fatal("settings save did not refresh compatible RPC state")
	}
}

// TestPendingRestartKeysClearWithoutTransmission omits impossible restart work.
//
// Saving with no daemon returns an empty pending list, settings reads remove stale
// process-local keys, and the restart route explains that the next start applies them.
//
// Since: UNRELEASED
func TestPendingRestartKeysClearWithoutTransmission(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)

	saved := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.incompleteDirectory":"/data/new-incomplete"}}`,
		cookies,
		csrfToken,
	)
	if saved.Code != http.StatusOK {
		testingObject.Fatalf("settings save status %d: %s", saved.Code, saved.Body.String())
	}
	var savedBody struct {
		PendingRestartKeys []string `json:"pendingRestartKeys"`
	}
	decodeBody(testingObject, saved, &savedBody)
	if savedBody.PendingRestartKeys == nil || len(savedBody.PendingRestartKeys) != 0 {
		testingObject.Fatalf("saved pending restart keys = %#v, want []", savedBody.PendingRestartKeys)
	}

	server.pendingRestartMutex.Lock()
	server.pendingRestartKeys["transmission.incompleteDirectory"] = struct{}{}
	server.pendingRestartMutex.Unlock()
	settingsResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/settings",
		"",
		cookies,
		"",
	)
	var settingsBody struct {
		PendingRestartKeys []string `json:"pendingRestartKeys"`
	}
	decodeBody(testingObject, settingsResponse, &settingsBody)
	if settingsResponse.Code != http.StatusOK ||
		settingsBody.PendingRestartKeys == nil || len(settingsBody.PendingRestartKeys) != 0 {
		testingObject.Fatalf("settings pending restart keys = %#v", settingsBody.PendingRestartKeys)
	}

	server.pendingRestartMutex.Lock()
	server.pendingRestartKeys["transmission.incompleteDirectory"] = struct{}{}
	server.pendingRestartMutex.Unlock()
	expectError(
		testingObject,
		performRequest(
			testingObject,
			server,
			http.MethodPost,
			"/api/v1/transmission/restart",
			`{"confirm":true}`,
			cookies,
			csrfToken,
		),
		http.StatusConflict,
		"transmission_not_running",
		"Transmission isn't running. Saved settings apply when it starts.",
	)
	server.pendingRestartMutex.RLock()
	remainingKeys := len(server.pendingRestartKeys)
	server.pendingRestartMutex.RUnlock()
	if remainingKeys != 0 {
		testingObject.Fatalf("restart retained %d pending keys", remainingKeys)
	}
}

// TestPendingRestartKeysFollowSavesAndRestart tracks only restart-impact settings.
//
// Live saves leave earlier pending keys intact, and the keys clear only after both
// Transmission restart RPC calls succeed.
func TestPendingRestartKeysFollowSavesAndRestart(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	_, client := newFakeTransmissionDaemon(t, func(recordedTransmissionCall) any {
		return map[string]any{}
	})
	server.transmission = client

	readKeys := func() []string {
		t.Helper()

		response := performRequest(t, server, http.MethodGet, "/api/v1/settings", "", cookies, "")
		if response.Code != http.StatusOK {
			t.Fatalf("get settings status %d: %s", response.Code, response.Body.String())
		}
		var body struct {
			PendingRestartKeys []string `json:"pendingRestartKeys"`
		}
		decodeBody(t, response, &body)

		return body.PendingRestartKeys
	}

	if keys := readKeys(); keys == nil || len(keys) != 0 {
		t.Fatalf("initial pending restart keys = %#v, want []", keys)
	}

	restartSave := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.incompleteDirectory":"/data/new-incomplete"}}`,
		cookies,
		csrfToken,
	)
	if restartSave.Code != http.StatusOK {
		t.Fatalf("restart-impact save status %d: %s", restartSave.Code, restartSave.Body.String())
	}
	wantPending := []string{"transmission.incompleteDirectory"}
	if keys := readKeys(); !reflect.DeepEqual(keys, wantPending) {
		t.Fatalf("pending restart keys = %v, want %v", keys, wantPending)
	}

	liveSave := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":1,"changes":{"transmission.downloadQueueSize":7}}`,
		cookies,
		csrfToken,
	)
	if liveSave.Code != http.StatusOK {
		t.Fatalf("live save status %d: %s", liveSave.Code, liveSave.Body.String())
	}
	if keys := readKeys(); !reflect.DeepEqual(keys, wantPending) {
		t.Fatalf("pending keys after live save = %v, want %v", keys, wantPending)
	}

	restart := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/transmission/restart",
		`{"confirm":true}`,
		cookies,
		csrfToken,
	)
	if restart.Code != http.StatusAccepted {
		t.Fatalf("restart status %d: %s", restart.Code, restart.Body.String())
	}
	if keys := readKeys(); keys == nil || len(keys) != 0 {
		t.Fatalf("pending keys after restart = %#v, want []", keys)
	}
}

// TestSettingsSaveWaitsForRestartSnapshot preserves changes racing a restart.
//
// The restart clears only keys from its own snapshot, then a waiting settings save can
// commit and leave its newly pending restart key visible.
func TestSettingsSaveWaitsForRestartSnapshot(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	restartReachedDaemon := make(chan struct{})
	releaseRestart := make(chan struct{})
	_, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "session-set" {
			close(restartReachedDaemon)
			<-releaseRestart
		}

		return map[string]any{}
	})
	server.transmission = client

	firstSave := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.peerPortRandomOnStart":true}}`,
		cookies,
		csrfToken,
	)
	if firstSave.Code != http.StatusOK {
		testingObject.Fatalf("first settings save status %d: %s", firstSave.Code, firstSave.Body.String())
	}

	restartResponses := make(chan int, 1)
	go func() {
		response := performRequest(
			testingObject,
			server,
			http.MethodPost,
			"/api/v1/transmission/restart",
			`{"confirm":true}`,
			cookies,
			csrfToken,
		)
		restartResponses <- response.Code
	}()
	<-restartReachedDaemon

	saveResponses := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		saveResponses <- performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/settings",
			`{"expectedRevision":1,"changes":{"transmission.incompleteDirectory":"/data/second"}}`,
			cookies,
			csrfToken,
		)
	}()

	select {
	case response := <-saveResponses:
		testingObject.Fatalf("settings save completed during restart with status %d", response.Code)
	case <-time.After(50 * time.Millisecond):
	}
	close(releaseRestart)
	if status := <-restartResponses; status != http.StatusAccepted {
		testingObject.Fatalf("restart status = %d", status)
	}
	saveResponse := <-saveResponses
	if saveResponse.Code != http.StatusOK {
		testingObject.Fatalf("racing settings save status %d: %s", saveResponse.Code, saveResponse.Body.String())
	}

	wantPending := []string{"transmission.incompleteDirectory"}
	if pending := server.transmissionRestartKeys(context.Background()); !reflect.DeepEqual(pending, wantPending) {
		testingObject.Fatalf("pending keys after racing save = %v, want %v", pending, wantPending)
	}
}
