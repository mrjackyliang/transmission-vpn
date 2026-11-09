package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const (
	firstTestConnectionID  = "vpc-1000000000000001"
	secondTestConnectionID = "vpc-2000000000000002"
	firstTestHash          = "1111111111111111111111111111111111111111"
	secondTestHash         = "2222222222222222222222222222222222222222"
)

type multiTransmissionFixture struct {
	server     *Server
	cookies    []*http.Cookie
	csrfToken  string
	first      storage.EncryptedVPNConnection
	second     storage.EncryptedVPNConnection
	firstFake  *fakeTransmissionDaemon
	secondFake *fakeTransmissionDaemon
	clients    *transmissionrpc.ClientSet
}

// TestMergedTorrentsReturnsPartialResults verifies facade IDs and connection errors.
func TestMergedTorrentsReturnsPartialResults(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method != "torrent-get" {
				return map[string]any{}
			}

			return map[string]any{"torrents": []map[string]any{{
				"hashString": firstTestHash,
				"id":         7,
				"name":       "First connection torrent",
			}}}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.secondFake.server.Close()

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		fixture.cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("list torrents status %d: %s", response.Code, response.Body.String())
	}
	var body torrentListResponse
	decodeBody(testingObject, response, &body)
	if len(body.Items) != 1 || body.Items[0]["id"] != float64(7) ||
		body.Items[0]["connectionId"] != fixture.first.ID {
		testingObject.Fatalf("merged torrent items = %#v", body.Items)
	}
	wantErrors := []string{"torrents-unavailable:" + fixture.second.ID}
	if !reflect.DeepEqual(body.Errors, wantErrors) {
		testingObject.Fatalf("merged torrent errors = %#v, want %#v", body.Errors, wantErrors)
	}
}

// TestTorrentActionsSplitFacadeIDs verifies each daemon receives only local IDs.
func TestTorrentActionsSplitFacadeIDs(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	secondFacadeID, err := transmissionrpc.FacadeID(fixture.second.Slot, 9)
	if err != nil {
		testingObject.Fatalf("build second facade ID: %v", err)
	}
	body, _ := json.Marshal(map[string]any{
		"action": "start",
		"ids":    []int64{7, secondFacadeID},
	})
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/actions",
		string(body),
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("torrent action status %d: %s", response.Code, response.Body.String())
	}
	assertSingleLocalID(testingObject, fixture.firstFake.recordedCalls(), "torrent-start", 7)
	assertSingleLocalID(testingObject, fixture.secondFake.recordedCalls(), "torrent-start", 9)
}

// TestTorrentActionHashesOverrideStaleFacadeIDs protects against daemon ID reuse.
func TestTorrentActionHashesOverrideStaleFacadeIDs(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": firstTestHash,
					"id":         9,
					"name":       "Current torrent",
				}}}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	body, _ := json.Marshal(map[string]any{
		"action": "start",
		"hashes": []string{firstTestHash},
		"ids":    []int64{7},
	})
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents/actions",
		string(body),
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("hash torrent action status %d: %s", response.Code, response.Body.String())
	}
	call := findTransmissionCall(testingObject, fixture.firstFake.recordedCalls(), "torrent-start")
	if !reflect.DeepEqual(call.Arguments["ids"], []any{firstTestHash}) {
		testingObject.Fatalf("hash action identifiers = %#v", call.Arguments["ids"])
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-start") {
		testingObject.Fatal("hash action reached the wrong daemon")
	}
}

// TestTorrentActionMissingTargetsReturnNotFound covers every stable 404 case.
func TestTorrentActionMissingTargetsReturnNotFound(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
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
	missingSlotID, err := transmissionrpc.FacadeID(63, 1)
	if err != nil {
		testingObject.Fatalf("build missing-slot facade ID: %v", err)
	}
	tests := []struct {
		name string
		body map[string]any
	}{
		{"missing hash", map[string]any{"action": "stop", "hashes": []string{firstTestHash}}},
		{"malformed facade", map[string]any{"action": "stop", "ids": []int64{int64(64) << 24}}},
		{"missing slot", map[string]any{"action": "stop", "ids": []int64{missingSlotID}}},
	}
	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			body, _ := json.Marshal(test.body)
			response := performRequest(
				testingObject,
				fixture.server,
				http.MethodPost,
				"/api/v1/torrents/actions",
				string(body),
				fixture.cookies,
				fixture.csrfToken,
			)
			if response.Code != http.StatusNotFound ||
				!strings.Contains(response.Body.String(), `"code":"torrent_not_found"`) {
				testingObject.Fatalf("missing target status %d: %s", response.Code, response.Body.String())
			}
		})
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-stop") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-stop") {
		testingObject.Fatal("a missing target reached a mutating RPC")
	}
}

// TestEveryTorrentMutationAcceptsHashes exercises the complete hash contract.
func TestEveryTorrentMutationAcceptsHashes(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString":  firstTestHash,
					"id":          9,
					"name":        "Hash target",
					"downloadDir": "/data/downloads",
				}}}
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
	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
		wantRPC    string
	}{
		{
			name:       "update",
			method:     http.MethodPatch,
			path:       "/api/v1/torrents",
			body:       `{"ids":[7],"hashes":["` + firstTestHash + `"],"changes":{"labels":["hash"]}}`,
			wantStatus: http.StatusOK,
			wantRPC:    "torrent-set",
		},
		{
			name:       "remove",
			method:     http.MethodPost,
			path:       "/api/v1/torrents/remove",
			body:       `{"ids":[7],"hashes":["` + firstTestHash + `"],"deleteLocalData":false}`,
			wantStatus: http.StatusNoContent,
			wantRPC:    "torrent-remove",
		},
		{
			name:       "rename",
			method:     http.MethodPost,
			path:       "/api/v1/torrents/rename",
			body:       `{"id":7,"hashes":["` + firstTestHash + `"],"path":"Hash target","name":"Renamed"}`,
			wantStatus: http.StatusOK,
			wantRPC:    "torrent-rename-path",
		},
		{
			name:       "profile reassignment",
			method:     http.MethodPut,
			path:       "/api/v1/torrents/profile",
			body:       `{"ids":[7],"hashes":["` + firstTestHash + `"],"profileId":null,"applyOptions":false}`,
			wantStatus: http.StatusOK,
		},
	}
	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			fixture.firstFake.clearCalls()
			fixture.secondFake.clearCalls()
			response := performRequest(
				testingObject,
				fixture.server,
				test.method,
				test.path,
				test.body,
				fixture.cookies,
				fixture.csrfToken,
			)
			if response.Code != test.wantStatus {
				testingObject.Fatalf("hash mutation status %d: %s", response.Code, response.Body.String())
			}
			if test.wantRPC == "" {
				return
			}
			call := findTransmissionCall(testingObject, fixture.firstFake.recordedCalls(), test.wantRPC)
			if !reflect.DeepEqual(call.Arguments["ids"], []any{firstTestHash}) {
				testingObject.Fatalf("%s hash identifiers = %#v", test.wantRPC, call.Arguments["ids"])
			}
		})
	}
}

// TestAddTorrentRoutesToProfileConnection verifies profile-owned daemon selection.
func TestAddTorrentRoutesToProfileConnection(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": secondTestHash,
					"id":         6,
					"name":       "Default routed",
				}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": firstTestHash,
					"id":         5,
					"name":       "Profile routed",
				}}
			default:
				return map[string]any{}
			}
		},
	)
	if _, err := fixture.server.store.UpdateSettings(
		context.Background(),
		fixture.server.registry,
		0,
		storage.SettingChanges{
			"transmission.downloadDirectory": []byte(`"/data/default-profile"`),
		},
		"test",
	); err != nil {
		testingObject.Fatalf("set Default profile folder: %v", err)
	}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	body, _ := json.Marshal(map[string]any{
		"filename":  "magnet:?xt=urn:btih:" + firstTestHash,
		"profileId": profile.ID,
	})
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		string(body),
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("add torrent status %d: %s", response.Code, response.Body.String())
	}
	var result torrentAddResponse
	decodeBody(testingObject, response, &result)
	wantID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 5)
	if result.ID != wantID || result.Duplicate || result.Hash != firstTestHash {
		testingObject.Fatalf("profile-routed add = %#v", result)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") {
		testingObject.Fatal("the default daemon received the profile-routed add")
	}
	if !containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") ||
		!containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-set") {
		testingObject.Fatalf("second daemon calls = %#v", fixture.secondFake.recordedCalls())
	}
	addCall := findTransmissionCall(testingObject, fixture.secondFake.recordedCalls(), "torrent-add")
	if addCall.Arguments["download-dir"] != "/data/profile" {
		testingObject.Fatalf("normalized console download directory = %#v", addCall.Arguments)
	}
	if addCall.Arguments["paused"] != false {
		testingObject.Fatalf("profile magnet paused default = %#v", addCall.Arguments)
	}

	defaultBody, _ := json.Marshal(map[string]any{
		"filename": "magnet:?xt=urn:btih:" + secondTestHash,
	})
	defaultResponse := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		string(defaultBody),
		fixture.cookies,
		fixture.csrfToken,
	)
	if defaultResponse.Code != http.StatusCreated {
		testingObject.Fatalf(
			"default add status %d: %s",
			defaultResponse.Code,
			defaultResponse.Body.String(),
		)
	}
	var defaultResult torrentAddResponse
	decodeBody(testingObject, defaultResponse, &defaultResult)
	if defaultResult.ID != 6 || defaultResult.Hash != secondTestHash || defaultResult.Duplicate {
		testingObject.Fatalf("default-routed add = %#v", defaultResult)
	}
	defaultAddCall := findTransmissionCall(testingObject, fixture.firstFake.recordedCalls(), "torrent-add")
	if defaultAddCall.Arguments["download-dir"] != "/data/default-profile" {
		testingObject.Fatalf("Default profile add arguments = %#v", defaultAddCall.Arguments)
	}
	if defaultAddCall.Arguments["paused"] != false {
		testingObject.Fatalf("Default profile magnet paused default = %#v", defaultAddCall.Arguments)
	}
	for _, fake := range []*fakeTransmissionDaemon{fixture.firstFake, fixture.secondFake} {
		calls := fake.recordedCalls()
		if containsTransmissionMethod(calls, "session-get") ||
			containsTransmissionMethod(calls, "torrent-start") {
			testingObject.Fatalf("magnet add follow-up calls = %#v", calls)
		}
	}
}

// TestAddTorrentURLStartPreference verifies every web URL start decision.
//
// Unknown hashes are always added paused, while an explicit paused value or the
// selected profile's start preference decides whether the torrent starts afterward.
func TestAddTorrentURLStartPreference(testingObject *testing.T) {
	tests := []struct {
		name          string
		body          string
		sessionStarts bool
		wantSession   bool
		wantStart     bool
	}{
		{
			name:      "paused false",
			body:      `{"filename":"https://example.test/start.torrent","paused":false}`,
			wantStart: true,
		},
		{
			name: "paused true",
			body: `{"filename":"https://example.test/stay-paused.torrent","paused":true}`,
		},
		{
			name:      "Default profile starts added torrents",
			body:      `{"filename":"https://example.test/session-start.torrent"}`,
			wantStart: true,
		},
		{
			name:      "Default profile ignores session pause",
			body:      `{"filename":"https://example.test/session-pause.torrent"}`,
			wantStart: true,
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			server, cookies, csrfToken := newClaimedTestServer(testingObject)
			fake, client := newFakeTransmissionDaemon(
				testingObject,
				func(call recordedTransmissionCall) any {
					switch call.Method {
					case "session-get":
						return map[string]any{"start-added-torrents": test.sessionStarts}
					case "torrent-add":
						return map[string]any{"torrent-added": map[string]any{
							"hashString": firstTestHash,
							"id":         31,
							"name":       "URL preference",
						}}
					default:
						return map[string]any{}
					}
				},
			)
			server.transmission = client

			response := performRequest(
				testingObject,
				server,
				http.MethodPost,
				"/api/v1/torrents",
				test.body,
				cookies,
				csrfToken,
			)
			if response.Code != http.StatusCreated {
				testingObject.Fatalf("URL add status %d: %s", response.Code, response.Body.String())
			}

			calls := fake.recordedCalls()
			addCall := findTransmissionCall(testingObject, calls, "torrent-add")
			if addCall.Arguments["paused"] != true {
				testingObject.Fatalf("URL add arguments = %#v", addCall.Arguments)
			}
			if test.wantSession {
				sessionCall := findTransmissionCall(testingObject, calls, "session-get")
				if !reflect.DeepEqual(
					sessionCall.Arguments["fields"],
					[]any{"start-added-torrents"},
				) {
					testingObject.Fatalf("session-get arguments = %#v", sessionCall.Arguments)
				}
			} else if containsTransmissionMethod(calls, "session-get") {
				testingObject.Fatalf("explicit paused add queried the session: %#v", calls)
			}
			if test.wantStart {
				assertSingleLocalID(testingObject, calls, "torrent-start", 31)
			} else if containsTransmissionMethod(calls, "torrent-start") {
				testingObject.Fatalf("paused URL add was started: %#v", calls)
			}
		})
	}
}

// TestAddTorrentURLStartFailureUsesProfileErrorContract covers the web failure path.
//
// A rejected deferred start returns the same application error used when a daemon
// rejects profile options after accepting the torrent.
func TestAddTorrentURLStartFailureUsesProfileErrorContract(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	_, client := newFakeTransmissionDaemon(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": firstTestHash,
					"id":         32,
					"name":       "Rejected start",
				}}
			case "torrent-start":
				return fakeTransmissionResponse{Result: "start rejected"}
			default:
				return map[string]any{}
			}
		},
	)
	server.transmission = client

	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/rejected-start.torrent","paused":false}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(response.Body.String(), `"code":"transmission_rejected"`) {
		testingObject.Fatalf("rejected start status %d: %s", response.Code, response.Body.String())
	}
}

// TestAddTorrentRemovesCrossDaemonURLDuplicate verifies the post-add hash check.
func TestAddTorrentRemovesCrossDaemonURLDuplicate(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": secondTestHash,
					"id":         12,
					"name":       "Already present",
				}}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": secondTestHash,
					"id":         21,
					"name":       "Downloaded duplicate metadata",
				}}
			default:
				return map[string]any{}
			}
		},
	)
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	body, _ := json.Marshal(map[string]any{
		"filename":  "https://example.test/already-present.torrent",
		"profileId": profile.ID,
	})
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		string(body),
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("duplicate add status %d: %s", response.Code, response.Body.String())
	}
	var result torrentAddResponse
	decodeBody(testingObject, response, &result)
	if !result.Duplicate || result.ID != 12 || result.Name != "Already present" ||
		result.ProfileName != "Default profile" || result.ConnectionName != "Primary" {
		testingObject.Fatalf("duplicate result = %#v", result)
	}
	removeCall := findTransmissionCall(
		testingObject,
		fixture.secondFake.recordedCalls(),
		"torrent-remove",
	)
	if !reflect.DeepEqual(removeCall.Arguments["ids"], []any{float64(21)}) ||
		removeCall.Arguments["delete-local-data"] != false {
		testingObject.Fatalf("duplicate cleanup arguments = %#v", removeCall.Arguments)
	}
	addCall := findTransmissionCall(testingObject, fixture.secondFake.recordedCalls(), "torrent-add")
	if addCall.Arguments["paused"] != true {
		testingObject.Fatalf("duplicate add arguments = %#v", addCall.Arguments)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "session-get") {
		testingObject.Fatalf("profile default queried session start state: %#v", fixture.secondFake.recordedCalls())
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-start") {
		testingObject.Fatal("cross-daemon duplicate was started")
	}
}

// TestAddTorrentUsesLastKnownHashesForUnavailableDaemon keeps healthy adds working.
func TestAddTorrentUsesLastKnownHashesForUnavailableDaemon(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": secondTestHash,
					"id":         21,
					"name":       "Downloaded duplicate metadata",
				}}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": secondTestHash,
					"id":         12,
					"name":       "Last known torrent",
				}}}
			}

			return map[string]any{}
		},
	)
	seed := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		fixture.cookies,
		"",
	)
	if seed.Code != http.StatusOK {
		testingObject.Fatalf("seed torrent hashes status %d: %s", seed.Code, seed.Body.String())
	}
	fixture.secondFake.server.Close()
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/unknown.torrent"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("add with unavailable known daemon status %d: %s", response.Code, response.Body.String())
	}
	var result torrentAddResponse
	decodeBody(testingObject, response, &result)
	wantID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 12)
	if !result.Duplicate || result.ID != wantID || result.Name != "Last known torrent" {
		testingObject.Fatalf("last-known duplicate result = %#v", result)
	}
	remove := findTransmissionCall(testingObject, fixture.firstFake.recordedCalls(), "torrent-remove")
	if !reflect.DeepEqual(remove.Arguments["ids"], []any{float64(21)}) {
		testingObject.Fatalf("last-known duplicate cleanup = %#v", remove.Arguments)
	}
}

// TestAddTorrentBlocksEverySourceBeforeEveryEnabledDaemonAnswers protects readiness.
func TestAddTorrentBlocksEverySourceBeforeEveryEnabledDaemonAnswers(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": firstTestHash,
					"id":         4,
					"name":       "Known magnet",
				}}
			default:
				return map[string]any{}
			}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.secondFake.server.Close()
	unknown := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/unknown.torrent"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if unknown.Code != http.StatusServiceUnavailable {
		testingObject.Fatalf("unknown add status %d: %s", unknown.Code, unknown.Body.String())
	}
	if !strings.Contains(unknown.Body.String(), "Transmission for Secondary is still starting") {
		testingObject.Fatalf("unknown add message: %s", unknown.Body.String())
	}
	known := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:`+firstTestHash+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if known.Code != http.StatusServiceUnavailable ||
		!strings.Contains(known.Body.String(), "Transmission for Secondary is still starting") {
		testingObject.Fatalf("known add status %d: %s", known.Code, known.Body.String())
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") {
		testingObject.Fatal("known add reached Transmission before every daemon answered")
	}
}

// TestAddTorrentPostCheckUsesItsOwnRefresh prevents a concurrent list from replacing it.
func TestAddTorrentPostCheckUsesItsOwnRefresh(testingObject *testing.T) {
	var fixture multiTransmissionFixture
	var duplicateVisible atomic.Bool
	duplicateVisible.Store(true)
	fixture = newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				duplicateVisible.Store(false)
				fixture.server.mergedTorrents(context.Background(), []string{"hashString", "id", "name"}, nil)

				return map[string]any{"torrent-added": map[string]any{
					"hashString": secondTestHash,
					"id":         21,
					"name":       "Downloaded duplicate metadata",
				}}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && duplicateVisible.Load() {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": secondTestHash,
					"id":         12,
					"name":       "Concurrent-list duplicate",
				}}}
			}

			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/concurrent.torrent"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("concurrent duplicate add status %d: %s", response.Code, response.Body.String())
	}
	var result torrentAddResponse
	decodeBody(testingObject, response, &result)
	if !result.Duplicate || result.Name != "Concurrent-list duplicate" {
		testingObject.Fatalf("concurrent duplicate result = %#v", result)
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") {
		testingObject.Fatal("concurrent duplicate was not removed")
	}
}

// TestTransmissionStatisticsAreSummed verifies current and cumulative numeric fields.
func TestTransmissionStatisticsAreSummed(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "session-stats" {
				return map[string]any{
					"activeTorrentCount": 2,
					"cumulative-stats": map[string]any{
						"downloadedBytes": 100,
						"secondsActive":   120,
						"sessionCount":    7,
					},
				}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "session-stats" {
				return map[string]any{
					"activeTorrentCount": 3,
					"cumulative-stats": map[string]any{
						"downloadedBytes": 250,
						"secondsActive":   80,
						"sessionCount":    9,
					},
				}
			}

			return map[string]any{}
		},
	)
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/transmission/statistics",
		"",
		fixture.cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("statistics status %d: %s", response.Code, response.Body.String())
	}
	var statistics map[string]any
	decodeBody(testingObject, response, &statistics)
	cumulative, _ := statistics["cumulative-stats"].(map[string]any)
	if statistics["activeTorrentCount"] != float64(5) ||
		cumulative["downloadedBytes"] != float64(350) ||
		cumulative["secondsActive"] != float64(120) ||
		cumulative["sessionCount"] != float64(9) {
		testingObject.Fatalf("summed statistics = %#v", statistics)
	}
}

// TestTransmissionStatisticsReportUnavailableConnection exposes short totals.
func TestTransmissionStatisticsReportUnavailableConnection(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "session-stats" {
				return map[string]any{"activeTorrentCount": 2}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.secondFake.server.Close()
	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/transmission/statistics",
		"",
		fixture.cookies,
		"",
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), "transmission-statistics-unavailable:"+fixture.second.ID) {
		testingObject.Fatalf("partial statistics status %d: %s", response.Code, response.Body.String())
	}
}

// TestDuplicateHashesAreReportedWithBothConnections covers lists and live events.
func TestDuplicateHashesAreReportedWithBothConnections(testingObject *testing.T) {
	respond := func(call recordedTransmissionCall) any {
		switch call.Method {
		case "torrent-get":
			return map[string]any{"torrents": []map[string]any{{
				"hashString": firstTestHash,
				"id":         3,
				"name":       "Duplicate",
			}}}
		case "session-stats":
			return map[string]any{}
		default:
			return map[string]any{}
		}
	}
	fixture := newMultiTransmissionFixture(testingObject, respond, respond)
	want := "duplicate-torrent:" + firstTestHash
	listed := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		fixture.cookies,
		"",
	)
	var list torrentListResponse
	decodeBody(testingObject, listed, &list)
	connections := map[string]bool{}
	for _, torrent := range list.Items {
		connectionID, _ := torrent["connectionId"].(string)
		connections[connectionID] = true
	}
	if listed.Code != http.StatusOK || !containsString(list.Errors, want) ||
		!connections[fixture.first.ID] || !connections[fixture.second.ID] {
		testingObject.Fatalf("duplicate list status %d: %s", listed.Code, listed.Body.String())
	}
	snapshot := fixture.server.buildLiveSnapshot(context.Background(), 1)
	eventConnections := map[string]bool{}
	for _, torrent := range snapshot.Torrents {
		connectionID, _ := torrent["connectionId"].(string)
		eventConnections[connectionID] = true
	}
	if !containsString(snapshot.Errors, want) ||
		!eventConnections[fixture.first.ID] || !eventConnections[fixture.second.ID] {
		testingObject.Fatalf("duplicate event errors = %#v, want %q", snapshot.Errors, want)
	}
}

// TestSettingsAndRestartReachEveryDaemon verifies session-wide fan-out and republish.
func TestSettingsAndRestartReachEveryDaemon(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	snapshot, err := fixture.server.store.EffectiveConfiguration(
		context.Background(),
		fixture.server.registry,
	)
	if err != nil {
		testingObject.Fatalf("read settings revision: %v", err)
	}
	updateBody, _ := json.Marshal(map[string]any{
		"expectedRevision": snapshot.Revision,
		"changes": map[string]any{
			"transmission.downloadQueueSize": 7,
		},
	})
	updated := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/settings",
		string(updateBody),
		fixture.cookies,
		fixture.csrfToken,
	)
	if updated.Code != http.StatusOK {
		testingObject.Fatalf("update settings status %d: %s", updated.Code, updated.Body.String())
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "session-set") ||
		!containsTransmissionMethod(fixture.secondFake.recordedCalls(), "session-set") {
		testingObject.Fatal("live settings did not reach every daemon")
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	restarted := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/transmission/restart",
		`{"confirm":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if restarted.Code != http.StatusAccepted {
		testingObject.Fatalf("restart status %d: %s", restarted.Code, restarted.Body.String())
	}
	for name, calls := range map[string][]recordedTransmissionCall{
		"first":  fixture.firstFake.recordedCalls(),
		"second": fixture.secondFake.recordedCalls(),
	} {
		if got := transmissionMethods(calls); !reflect.DeepEqual(got, []string{"session-set", "session-close"}) {
			testingObject.Fatalf("%s daemon restart methods = %#v", name, got)
		}
	}
	if _, err := os.Stat(filepath.Join(
		fixture.server.runtimeDirectory,
		"transmission-config",
		"settings-base.json",
	)); err != nil {
		testingObject.Fatalf("republished base settings: %v", err)
	}
}

// TestPartialSettingsAndRestartKeepKeysPending isolates an unavailable daemon.
func TestPartialSettingsAndRestartKeepKeysPending(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.secondFake.server.Close()
	snapshot, err := fixture.server.store.EffectiveConfiguration(
		context.Background(),
		fixture.server.registry,
	)
	if err != nil {
		testingObject.Fatalf("read settings revision: %v", err)
	}
	updateBody, _ := json.Marshal(map[string]any{
		"expectedRevision": snapshot.Revision,
		"changes": map[string]any{
			"transmission.downloadQueueSize": 7,
		},
	})
	updated := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/settings",
		string(updateBody),
		fixture.cookies,
		fixture.csrfToken,
	)
	if updated.Code != http.StatusOK {
		testingObject.Fatalf("partial settings status %d: %s", updated.Code, updated.Body.String())
	}
	var updateResult struct {
		RuntimeApply settingsRuntimeApply `json:"runtimeApply"`
	}
	decodeBody(testingObject, updated, &updateResult)
	if updateResult.RuntimeApply.Status != "partial" ||
		len(updateResult.RuntimeApply.Connections) != 2 {
		testingObject.Fatalf("partial runtime apply = %#v", updateResult.RuntimeApply)
	}
	wantPending := []string{"transmission.downloadQueueSize"}
	if !reflect.DeepEqual(fixture.server.transmissionRestartKeys(context.Background()), wantPending) {
		testingObject.Fatalf("pending live keys = %#v", fixture.server.transmissionRestartKeys(context.Background()))
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "session-set") {
		testingObject.Fatal("reachable daemon missed the partial live setting")
	}

	fixture.firstFake.clearCalls()
	restarted := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/transmission/restart",
		`{"confirm":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if restarted.Code != http.StatusAccepted ||
		!strings.Contains(restarted.Body.String(), `"status":"partial"`) {
		testingObject.Fatalf("partial restart status %d: %s", restarted.Code, restarted.Body.String())
	}
	if !reflect.DeepEqual(fixture.server.transmissionRestartKeys(context.Background()), wantPending) {
		testingObject.Fatalf("partial restart cleared keys = %#v", fixture.server.transmissionRestartKeys(context.Background()))
	}
	if got := transmissionMethods(fixture.firstFake.recordedCalls()); !reflect.DeepEqual(got, []string{"session-set", "session-close"}) {
		testingObject.Fatalf("reachable restart calls = %#v", got)
	}
	setCall := findTransmissionCall(testingObject, fixture.firstFake.recordedCalls(), "session-set")
	for _, forbidden := range []string{
		"peer-port",
		"peer-port-random-on-start",
		"peer-port-random-low",
		"peer-port-random-high",
	} {
		if _, found := setCall.Arguments[forbidden]; found {
			testingObject.Fatalf("restart session-set contains runner-owned %s", forbidden)
		}
	}
}

// TestAssignmentPruningRequiresEveryDaemon verifies a partial list cannot delete rows.
func TestAssignmentPruningRequiresEveryDaemon(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": firstTestHash,
					"id":         1,
					"name":       "Still here",
				}}}
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
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.first.ID)
	if err := fixture.server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{firstTestHash, secondTestHash},
		&profile.ID,
	); err != nil {
		testingObject.Fatalf("create assignments: %v", err)
	}
	if err := fixture.server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh assignments: %v", err)
	}

	fixture.secondFake.server.Close()
	partial := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		fixture.cookies,
		"",
	)
	if partial.Code != http.StatusOK {
		testingObject.Fatalf("partial list status %d: %s", partial.Code, partial.Body.String())
	}
	assertAssignmentCount(testingObject, fixture.server, 2)

	replacementFake, _ := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-get" {
			return map[string]any{"torrents": []map[string]any{}}
		}

		return map[string]any{}
	})
	if err := fixture.clients.Replace([]transmissionrpc.DaemonConfig{
		{
			ConnectionID: fixture.first.ID,
			Slot:         fixture.first.Slot,
			PeerPort:     fixture.first.PeerPort,
			Default:      true,
			Endpoint:     fixture.firstFake.server.URL + "/transmission/rpc",
		},
		{
			ConnectionID: fixture.second.ID,
			Slot:         fixture.second.Slot,
			PeerPort:     fixture.second.PeerPort,
			Endpoint:     replacementFake.server.URL + "/transmission/rpc",
		},
	}); err != nil {
		testingObject.Fatalf("replace restored daemon client: %v", err)
	}
	complete := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/torrents",
		"",
		fixture.cookies,
		"",
	)
	if complete.Code != http.StatusOK {
		testingObject.Fatalf("complete list status %d: %s", complete.Code, complete.Body.String())
	}
	assignments, err := fixture.server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil {
		testingObject.Fatalf("list pruned assignments: %v", err)
	}
	if !reflect.DeepEqual(assignments, map[string]string{firstTestHash: profile.ID}) {
		testingObject.Fatalf("pruned assignments = %#v", assignments)
	}
}

// TestHealthReportsPartialProtection verifies enabled connections are counted together.
func TestHealthReportsPartialProtection(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	writeConnectionRuntimeForTest(
		testingObject,
		fixture.server.runtimeDirectory,
		fixture.first,
		"protected",
		"10.70.0.2",
		"ready",
	)
	writeConnectionRuntimeForTest(
		testingObject,
		fixture.server.runtimeDirectory,
		fixture.second,
		"reconnecting",
		"",
		"ready",
	)
	status, err := fixture.server.buildStatus(context.Background())
	if err != nil {
		testingObject.Fatalf("build partial status: %v", err)
	}
	if status.Protection.State != "partial" || status.Protection.ProtectedCount != 1 ||
		status.Protection.EnabledCount != 2 || len(status.Connections) != 2 {
		testingObject.Fatalf("partial appliance status = %#v", status)
	}
	readiness := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/health/ready",
		"",
		nil,
		"",
	)
	if readiness.Code != http.StatusOK {
		testingObject.Fatalf("default readiness status %d: %s", readiness.Code, readiness.Body.String())
	}
}

// TestTransmissionRuntimePublicationWritesCompleteSharedFiles verifies the API handoff.
func TestTransmissionRuntimePublicationWritesCompleteSharedFiles(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	if err := fixture.server.publishTransmissionConfiguration(context.Background()); err != nil {
		testingObject.Fatalf("publish Transmission runtime configuration: %v", err)
	}
	configurationDirectory := filepath.Join(
		fixture.server.runtimeDirectory,
		"transmission-config",
	)
	var daemons []transmissionDaemonConfiguration
	readJSONFileForTest(
		testingObject,
		filepath.Join(configurationDirectory, "daemons.json"),
		&daemons,
	)
	wantDaemons := []transmissionDaemonConfiguration{
		{
			ConnectionID: fixture.first.ID,
			Slot:         fixture.first.Slot,
			PeerPort:     fixture.first.PeerPort,
			Default:      true,
		},
		{
			ConnectionID: fixture.second.ID,
			Slot:         fixture.second.Slot,
			PeerPort:     fixture.second.PeerPort,
		},
	}
	if !reflect.DeepEqual(daemons, wantDaemons) {
		testingObject.Fatalf("published daemons = %#v, want %#v", daemons, wantDaemons)
	}
	baseSettings := map[string]any{}
	basePath := filepath.Join(configurationDirectory, "settings-base.json")
	readJSONFileForTest(testingObject, basePath, &baseSettings)
	for _, forbiddenKey := range []string{
		"bind-address-ipv4",
		"peer-port",
		"rpc-bind-address",
		"rpc-port",
	} {
		if _, found := baseSettings[forbiddenKey]; found {
			testingObject.Fatalf("base settings include per-daemon key %s", forbiddenKey)
		}
	}
	for _, path := range []string{filepath.Join(configurationDirectory, "daemons.json"), basePath} {
		information, err := os.Stat(path)
		if err != nil {
			testingObject.Fatalf("stat %s: %v", path, err)
		}
		if information.Mode().Perm() != 0o640 {
			testingObject.Fatalf("mode for %s = %04o, want 0640", path, information.Mode().Perm())
		}
	}
}

// TestTorrentMetainfoHashUsesExactInfoDictionary verifies local duplicate detection.
func TestTorrentMetainfoHashUsesExactInfoDictionary(testingObject *testing.T) {
	metainfo := []byte("d8:announce14:https://x.test4:infod4:name4:test6:lengthi1eee")
	hash, known, err := torrentSourceHash("", metainfo)
	if err != nil || !known || len(hash) != 40 {
		testingObject.Fatalf("metainfo hash = %q, known %t, error %v", hash, known, err)
	}
	encoded := base64.StdEncoding.EncodeToString(metainfo)
	if encoded == "" {
		testingObject.Fatal("metainfo fixture did not encode")
	}
}

func newMultiTransmissionFixture(
	testingObject *testing.T,
	firstRespond func(recordedTransmissionCall) any,
	secondRespond func(recordedTransmissionCall) any,
) multiTransmissionFixture {
	testingObject.Helper()
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	first := createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Primary",
		profileID,
		51413,
	)
	second := createVPNConnectionForMultiTest(
		testingObject,
		server,
		secondTestConnectionID,
		"Secondary",
		profileID,
		51414,
	)
	firstFake, _ := newFakeTransmissionDaemon(testingObject, firstRespond)
	secondFake, _ := newFakeTransmissionDaemon(testingObject, secondRespond)
	clients := transmissionrpc.NewClientSet(time.Second)
	if err := clients.Replace([]transmissionrpc.DaemonConfig{
		{
			ConnectionID: first.ID,
			Slot:         first.Slot,
			PeerPort:     first.PeerPort,
			Default:      true,
			Endpoint:     firstFake.server.URL + "/transmission/rpc",
		},
		{
			ConnectionID: second.ID,
			Slot:         second.Slot,
			PeerPort:     second.PeerPort,
			Endpoint:     secondFake.server.URL + "/transmission/rpc",
		},
	}); err != nil {
		testingObject.Fatalf("configure multi-daemon clients: %v", err)
	}
	server.transmissionClients = clients
	server.transmission = clients

	return multiTransmissionFixture{
		server:     server,
		cookies:    cookies,
		csrfToken:  csrfToken,
		first:      first,
		second:     second,
		firstFake:  firstFake,
		secondFake: secondFake,
		clients:    clients,
	}
}

func createVPNConnectionForMultiTest(
	testingObject *testing.T,
	server *Server,
	connectionID string,
	name string,
	profileID string,
	peerPort int,
) storage.EncryptedVPNConnection {
	testingObject.Helper()
	credentialNonce, credentialCiphertext, err := server.sealVPNConnectionCredentials(
		connectionID,
		map[string]string{},
	)
	if err != nil {
		testingObject.Fatalf("seal %s VPN credentials: %v", name, err)
	}
	connection, err := server.store.CreateVPNConnection(
		context.Background(),
		storage.EncryptedVPNConnection{
			ID:                    connectionID,
			Name:                  name,
			Enabled:               true,
			ProviderID:            "custom",
			Tunnel:                "wireguard",
			ProfileIDs:            []string{profileID},
			EndpointStrategy:      "sticky",
			CredentialsNonce:      credentialNonce,
			CredentialsCiphertext: credentialCiphertext,
			DNSServers:            []string{"9.9.9.9"},
			RetryIntervalSeconds:  10,
			PeerPort:              peerPort,
		},
	)
	if err != nil {
		testingObject.Fatalf("create %s VPN connection: %v", name, err)
	}

	return connection
}

func createMultiVPNProfile(
	testingObject *testing.T,
	server *Server,
	connectionID string,
) storage.TorrentProfile {
	testingObject.Helper()
	profile, err := server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Connection profile " + connectionID,
			DownloadDirectory: "/data/profile",
			Labels:            []string{"profile"},
			Options: storage.TorrentProfileOptions{
				Seeding:           storage.TorrentProfileSeeding{Mode: "never"},
				BandwidthPriority: 0,
				PeerLimit:         60,
				Queue:             "normal",
			},
			MatchPatterns: []string{},
			ConnectionID:  &connectionID,
		},
	)
	if err != nil {
		testingObject.Fatalf("create connected torrent profile: %v", err)
	}

	return profile
}

func assertSingleLocalID(
	testingObject *testing.T,
	calls []recordedTransmissionCall,
	method string,
	wantID int64,
) {
	testingObject.Helper()
	call := findTransmissionCall(testingObject, calls, method)
	if !reflect.DeepEqual(call.Arguments["ids"], []any{float64(wantID)}) {
		testingObject.Fatalf("%s local IDs = %#v, want %d", method, call.Arguments["ids"], wantID)
	}
}

func findTransmissionCall(
	testingObject *testing.T,
	calls []recordedTransmissionCall,
	method string,
) recordedTransmissionCall {
	testingObject.Helper()
	for _, call := range calls {
		if call.Method == method {
			return call
		}
	}
	testingObject.Fatalf("Transmission method %s was not called; calls = %#v", method, calls)

	return recordedTransmissionCall{}
}

func containsTransmissionMethod(calls []recordedTransmissionCall, method string) bool {
	for _, call := range calls {
		if call.Method == method {
			return true
		}
	}

	return false
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}

	return false
}

func assertAssignmentCount(testingObject *testing.T, server *Server, want int) {
	testingObject.Helper()
	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil {
		testingObject.Fatalf("list torrent profile assignments: %v", err)
	}
	if len(assignments) != want {
		testingObject.Fatalf("assignment count = %d, want %d: %#v", len(assignments), want, assignments)
	}
}

func writeConnectionRuntimeForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	connection storage.EncryptedVPNConnection,
	state string,
	address string,
	daemonState string,
) {
	testingObject.Helper()
	status := controller.Status{
		ConnectionID:   connection.ID,
		Slot:           connection.Slot,
		Default:        connection.IsDefault,
		State:          state,
		Address:        address,
		DNSServers:     []string{},
		TransitionedAt: time.Now().UTC(),
	}
	writeJSONForTest(
		testingObject,
		filepath.Join(runtimeDirectory, "vpn.status.d", connection.ID+".json"),
		status,
	)
	writeJSONForTest(
		testingObject,
		filepath.Join(runtimeDirectory, "transmission-state", connection.ID+".json"),
		map[string]any{
			"connectionId": connection.ID,
			"state":        daemonState,
			"rpcPort":      9092 + connection.Slot,
			"bindAddress":  address,
			"peerPort":     connection.PeerPort,
			"version":      "4.0.6",
			"rpcVersion":   18,
			"updatedAt":    time.Now().UTC(),
		},
	)
}

func writeJSONForTest(testingObject *testing.T, path string, value any) {
	testingObject.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		testingObject.Fatalf("create test runtime directory: %v", err)
	}
	content, err := json.Marshal(value)
	if err != nil {
		testingObject.Fatalf("encode test runtime file: %v", err)
	}
	if err := os.WriteFile(path, content, 0o640); err != nil {
		testingObject.Fatalf("write test runtime file: %v", err)
	}
}

func readJSONFileForTest(testingObject *testing.T, path string, target any) {
	testingObject.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read %s: %v", path, err)
	}
	if err := json.Unmarshal(content, target); err != nil {
		testingObject.Fatalf("decode %s: %v", path, err)
	}
}
