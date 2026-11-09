package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// recordedTransmissionCall is one decoded request received by the fake daemon.
type recordedTransmissionCall struct {
	Method    string
	Arguments map[string]any
}

// fakeTransmissionResponse customizes transport and Transmission result failures.
type fakeTransmissionResponse struct {
	Arguments any
	Result    string
	Status    int
}

// fakeTransmissionDaemon records RPC order and delegates response arguments to a test.
type fakeTransmissionDaemon struct {
	testingObject *testing.T
	server        *httptest.Server
	mutex         sync.Mutex
	calls         []recordedTransmissionCall
	respond       func(recordedTransmissionCall) any
}

func newFakeTransmissionDaemon(
	t *testing.T,
	respond func(recordedTransmissionCall) any,
) (*fakeTransmissionDaemon, *transmissionrpc.Client) {
	t.Helper()

	fake := &fakeTransmissionDaemon{testingObject: t, respond: respond}
	fake.server = httptest.NewServer(http.HandlerFunc(fake.serveHTTP))
	t.Cleanup(fake.server.Close)

	client, err := transmissionrpc.NewClient(fake.server.URL+"/transmission/rpc", time.Second)
	if err != nil {
		t.Fatalf("create Transmission client: %v", err)
	}

	return fake, client
}

func (fake *fakeTransmissionDaemon) serveHTTP(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if request.Header.Get("X-Transmission-Session-Id") != "torrent-profile-test" {
		responseWriter.Header().Set("X-Transmission-Session-Id", "torrent-profile-test")
		responseWriter.WriteHeader(http.StatusConflict)

		return
	}

	var input recordedTransmissionCall
	if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
		fake.testingObject.Errorf("decode fake Transmission request: %v", err)
		responseWriter.WriteHeader(http.StatusBadRequest)

		return
	}
	if input.Arguments == nil {
		input.Arguments = map[string]any{}
	}

	fake.mutex.Lock()
	fake.calls = append(fake.calls, input)
	respond := fake.respond
	fake.mutex.Unlock()

	arguments := any(map[string]any{})
	if respond != nil {
		arguments = respond(input)
	}
	result := "success"
	status := http.StatusOK
	if custom, ok := arguments.(fakeTransmissionResponse); ok {
		arguments = custom.Arguments
		if custom.Result != "" {
			result = custom.Result
		}
		if custom.Status != 0 {
			status = custom.Status
		}
	}
	if arguments == nil {
		arguments = map[string]any{}
	}
	if status != http.StatusOK {
		writeJSON(responseWriter, status, map[string]any{
			"arguments": arguments,
			"result":    result,
		})

		return
	}
	writeJSON(responseWriter, status, map[string]any{
		"arguments": arguments,
		"result":    result,
	})
}

func (fake *fakeTransmissionDaemon) recordedCalls() []recordedTransmissionCall {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()

	return append([]recordedTransmissionCall(nil), fake.calls...)
}

func (fake *fakeTransmissionDaemon) clearCalls() {
	fake.mutex.Lock()
	fake.calls = nil
	fake.mutex.Unlock()
}

// TestTorrentProfileRoutesAndValidation covers the CRUD and complete-order HTTP contract.
func TestTorrentProfileRoutesAndValidation(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)

	empty := performRequest(t, server, http.MethodGet, "/api/v1/torrent-profiles", "", cookies, "")
	if empty.Code != http.StatusOK || !strings.Contains(empty.Body.String(), `"profiles":[]`) {
		t.Fatalf("empty profiles status %d: %s", empty.Code, empty.Body.String())
	}

	withoutCSRF := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Movies", "/data/movies", "normal"),
		cookies,
		"",
	)
	if withoutCSRF.Code != http.StatusForbidden {
		t.Fatalf("create without CSRF status = %d, want 403", withoutCSRF.Code)
	}

	created := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Movies", "/data/movies", "normal"),
		cookies,
		csrfToken,
	)
	if created.Code != http.StatusCreated {
		t.Fatalf("create profile status %d: %s", created.Code, created.Body.String())
	}
	var first storage.TorrentProfile
	decodeBody(t, created, &first)
	if !validTorrentProfileID(first.ID) || first.Options.PeerLimit != 60 {
		t.Fatalf("created profile = %+v", first)
	}

	duplicate := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("MOVIES", "/data/other", "normal"),
		cookies,
		csrfToken,
	)
	expectError(t, duplicate, http.StatusConflict, "torrent_profile_exists", "A torrent profile with this name already exists.")

	badDirectory := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Bad path", "/config/downloads", "normal"),
		cookies,
		csrfToken,
	)
	if badDirectory.Code != http.StatusUnprocessableEntity || !strings.Contains(badDirectory.Body.String(), `"field":"downloadDirectory"`) {
		t.Fatalf("bad directory status %d: %s", badDirectory.Code, badDirectory.Body.String())
	}

	commaLabelBody := strings.Replace(
		testTorrentProfileRequest("Comma label", "/data/comma-label", "normal"),
		"Saved label",
		"tv,hd",
		1,
	)
	commaLabel := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		commaLabelBody,
		cookies,
		csrfToken,
	)
	if commaLabel.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(commaLabel.Body.String(), "Labels can't contain commas.") {
		t.Fatalf("comma profile label status %d: %s", commaLabel.Code, commaLabel.Body.String())
	}

	limitWithoutValue := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		`{"name":"No limit","downloadDirectory":"/data/no-limit","options":{"seeding":{"mode":"limit"}}}`,
		cookies,
		csrfToken,
	)
	if limitWithoutValue.Code != http.StatusUnprocessableEntity || !strings.Contains(limitWithoutValue.Body.String(), `"field":"options.seeding"`) {
		t.Fatalf("limit without value status %d: %s", limitWithoutValue.Code, limitWithoutValue.Body.String())
	}

	patterns := make([]string, 65)
	for index := range patterns {
		patterns[index] = "pattern-*"
	}
	tooManyPatternsBody, _ := json.Marshal(map[string]any{
		"name":              "Too many patterns",
		"downloadDirectory": "/data/patterns",
		"matchPatterns":     patterns,
	})
	tooManyPatterns := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		string(tooManyPatternsBody),
		cookies,
		csrfToken,
	)
	if tooManyPatterns.Code != http.StatusUnprocessableEntity || !strings.Contains(tooManyPatterns.Body.String(), `"field":"matchPatterns"`) {
		t.Fatalf("too many patterns status %d: %s", tooManyPatterns.Code, tooManyPatterns.Body.String())
	}

	secondResponse := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Series", "/data/series", "top"),
		cookies,
		csrfToken,
	)
	if secondResponse.Code != http.StatusCreated {
		t.Fatalf("create second profile status %d: %s", secondResponse.Code, secondResponse.Body.String())
	}
	if !strings.Contains(secondResponse.Body.String(), `"profileId":"`+first.ID+`"`) ||
		!strings.Contains(secondResponse.Body.String(), `"profileName":"Movies"`) ||
		!strings.Contains(secondResponse.Body.String(), `"pattern":"*2160p?*"`) ||
		!strings.Contains(secondResponse.Body.String(), `"ownPattern":"*2160p?*"`) {
		t.Fatalf("overlapping profile response = %s", secondResponse.Body.String())
	}
	var second storage.TorrentProfile
	decodeBody(t, secondResponse, &second)

	updated := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+first.ID,
		testTorrentProfileRequest("Feature films", "/data/films", "normal"),
		cookies,
		csrfToken,
	)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"name":"Feature films"`) {
		t.Fatalf("update profile status %d: %s", updated.Code, updated.Body.String())
	}

	removedOrderRoute := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/torrent-profiles/order",
		`{"ids":["`+second.ID+`"]}`,
		cookies,
		csrfToken,
	)
	if removedOrderRoute.Code != http.StatusNotFound {
		t.Fatalf("removed order route status %d: %s", removedOrderRoute.Code, removedOrderRoute.Body.String())
	}

	listedProfiles := performRequest(
		t,
		server,
		http.MethodGet,
		"/api/v1/torrent-profiles",
		"",
		cookies,
		"",
	)
	if listedProfiles.Code != http.StatusOK {
		t.Fatalf("list profiles status %d: %s", listedProfiles.Code, listedProfiles.Body.String())
	}
	var listedBody struct {
		Profiles []storage.TorrentProfile `json:"profiles"`
	}
	decodeBody(t, listedProfiles, &listedBody)
	if len(listedBody.Profiles) != 2 || listedBody.Profiles[0].ID != first.ID || listedBody.Profiles[1].ID != second.ID {
		t.Fatalf("alphabetical profiles = %+v", listedBody.Profiles)
	}

	deleted := performRequest(
		t,
		server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+first.ID,
		"",
		cookies,
		csrfToken,
	)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete status %d: %s", deleted.Code, deleted.Body.String())
	}
}

// TestDeleteTorrentProfileRequiresMoveConfirmation keeps the profile intact first.
func TestDeleteTorrentProfileRequiresMoveConfirmation(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  firstTestHash,
					"name":        "Profile torrent",
					"downloadDir": "/data/profile",
					"percentDone": 1,
					"status":      6,
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
	assignTorrentProfileForDeleteTest(
		testingObject,
		fixture.server,
		profile.ID,
		firstTestHash,
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+profile.ID,
		"",
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusConflict ||
		!strings.Contains(response.Body.String(), `"code":"torrents_must_move"`) ||
		!strings.Contains(response.Body.String(), `"torrents":1`) ||
		!strings.Contains(response.Body.String(), `"connectionId":"`+fixture.first.ID+`"`) ||
		!strings.Contains(response.Body.String(), `"downloadDirectory":"/data/downloads"`) {
		testingObject.Fatalf(
			"unconfirmed profile deletion = %d %s",
			response.Code,
			response.Body.String(),
		)
	}
	if _, err := fixture.server.store.FindTorrentProfile(context.Background(), profile.ID); err != nil {
		testingObject.Fatalf("profile deleted before confirmation: %v", err)
	}
	assignments, err := fixture.server.store.ListTorrentProfileAssignments(
		context.Background(),
	)
	if err != nil || assignments[firstTestHash] != profile.ID {
		testingObject.Fatalf("assignments before confirmation = %+v, %v", assignments, err)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-set-location") {
		testingObject.Fatalf(
			"unconfirmed move calls = %v",
			transmissionMethods(fixture.firstFake.recordedCalls()),
		)
	}
}

// TestDeleteTorrentProfileMovesFilesOnTheDefaultConnection covers folder ownership.
func TestDeleteTorrentProfileMovesFilesOnTheDefaultConnection(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  firstTestHash,
					"name":        "Profile torrent",
					"downloadDir": "/data/profile",
					"percentDone": 1,
					"status":      6,
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
	assignTorrentProfileForDeleteTest(
		testingObject,
		fixture.server,
		profile.ID,
		firstTestHash,
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+profile.ID,
		`{"moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) ||
		!strings.Contains(response.Body.String(), `"hash":"`+firstTestHash+`"`) {
		testingObject.Fatalf(
			"confirmed same-connection profile deletion = %d %s",
			response.Code,
			response.Body.String(),
		)
	}
	moveCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-set-location",
	)
	if moveCall.Arguments["location"] != "/data/downloads" ||
		moveCall.Arguments["move"] != true ||
		containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") {
		testingObject.Fatalf(
			"same-connection profile deletion calls = %#v",
			fixture.firstFake.recordedCalls(),
		)
	}
	assertDeletedTorrentProfileIsDefault(
		testingObject,
		fixture.server,
		profile.ID,
		firstTestHash,
	)
}

// TestDeleteTorrentProfileMovesTorrentToTheDefaultConnection covers daemon ownership.
func TestDeleteTorrentProfileMovesTorrentToTheDefaultConnection(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 51, "hashString": secondTestHash, "name": "Profile torrent",
				}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(secondTestHash, 1, 4)
			}
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  secondTestHash,
					"name":        "Profile torrent",
					"downloadDir": "/data/profile",
				}}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{
		content: []byte("profile deletion metainfo"),
	}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	assignTorrentProfileForDeleteTest(
		testingObject,
		fixture.server,
		profile.ID,
		secondTestHash,
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+profile.ID,
		`{"moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) ||
		!strings.Contains(response.Body.String(), `"hash":"`+secondTestHash+`"`) {
		testingObject.Fatalf(
			"confirmed cross-connection profile deletion = %d %s",
			response.Code,
			response.Body.String(),
		)
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") ||
		!containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-set-location") ||
		!containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-remove") {
		testingObject.Fatalf(
			"cross-connection profile deletion calls = target %v source %v",
			transmissionMethods(fixture.firstFake.recordedCalls()),
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}
	assertDeletedTorrentProfileIsDefault(
		testingObject,
		fixture.server,
		profile.ID,
		secondTestHash,
	)
}

// TestDeleteTorrentProfileReportsFailedMove keeps the torrent on its source daemon.
func TestDeleteTorrentProfileReportsFailedMove(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				return fakeTransmissionResponse{
					Arguments: map[string]any{},
					Result:    "mock move failed",
				}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(secondTestHash, 1, 4)
			}
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  secondTestHash,
					"name":        "Profile torrent",
					"downloadDir": "/data/profile",
				}}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{
		content: []byte("failed profile deletion metainfo"),
	}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	assignTorrentProfileForDeleteTest(
		testingObject,
		fixture.server,
		profile.ID,
		secondTestHash,
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+profile.ID,
		`{"moveTorrents":true}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"failed"`) ||
		!strings.Contains(response.Body.String(), "add torrent to target connection") {
		testingObject.Fatalf(
			"failed profile deletion move = %d %s",
			response.Code,
			response.Body.String(),
		)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-remove") {
		testingObject.Fatalf(
			"failed profile deletion removed source: %v",
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}
	assertDeletedTorrentProfileIsDefault(
		testingObject,
		fixture.server,
		profile.ID,
		secondTestHash,
	)
}

// TestDeleteTorrentProfileWithoutTorrentsPreservesNoContentResponse covers empty profiles.
func TestDeleteTorrentProfileWithoutTorrentsPreservesNoContentResponse(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profile, err := server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Empty profile",
			DownloadDirectory: "/data/empty-profile",
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
		testingObject.Fatalf("create empty torrent profile: %v", err)
	}

	response := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/torrent-profiles/"+profile.ID,
		"",
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusNoContent || response.Body.Len() != 0 {
		testingObject.Fatalf(
			"empty profile deletion = %d %s",
			response.Code,
			response.Body.String(),
		)
	}
	if _, err := server.store.FindTorrentProfile(
		context.Background(),
		profile.ID,
	); !errors.Is(err, storage.ErrNotFound) {
		testingObject.Fatalf("empty torrent profile remains after deletion: %v", err)
	}
}

// TestProfileFolderOwnershipConflictsAcrossAPIs enforces one profile per folder.
func TestProfileFolderOwnershipConflictsAcrossAPIs(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	defaultConflict := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Default collision", "/data/DOWNLOADS", "normal"),
		cookies,
		csrfToken,
	)
	if defaultConflict.Code != http.StatusConflict ||
		!strings.Contains(defaultConflict.Body.String(), `"code":"profile_folder_taken"`) ||
		!strings.Contains(defaultConflict.Body.String(), "“downloads” is already the Default profile's folder.") {
		testingObject.Fatalf("Default folder collision = %d: %s", defaultConflict.Code, defaultConflict.Body.String())
	}

	created := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Movies", "/data/Movies", "normal"),
		cookies,
		csrfToken,
	)
	if created.Code != http.StatusCreated {
		testingObject.Fatalf("create Movies profile = %d: %s", created.Code, created.Body.String())
	}
	namedConflict := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest("Archive", "/data/movies", "normal"),
		cookies,
		csrfToken,
	)
	if namedConflict.Code != http.StatusConflict ||
		!strings.Contains(namedConflict.Body.String(), "“Movies” is already the Movies profile's folder.") {
		testingObject.Fatalf("named folder collision = %d: %s", namedConflict.Code, namedConflict.Body.String())
	}

	settingsConflict := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.downloadDirectory":"/data/MOVIES"}}`,
		cookies,
		csrfToken,
	)
	if settingsConflict.Code != http.StatusConflict ||
		!strings.Contains(settingsConflict.Body.String(), `"code":"profile_folder_taken"`) ||
		!strings.Contains(settingsConflict.Body.String(), `"field":"changes.transmission.downloadDirectory"`) {
		testingObject.Fatalf("settings folder collision = %d: %s", settingsConflict.Code, settingsConflict.Body.String())
	}
}

// TestTorrentProfilesResponseIncludesEffectiveDefault supplies the Torrents page.
//
// The read contract carries the setting-backed Default profile folder beside the
// named profiles, avoiding a second Settings request for Add torrent.
//
// Since: UNRELEASED
func TestTorrentProfilesResponseIncludesEffectiveDefault(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	if _, err := server.store.UpdateSettings(
		context.Background(),
		server.registry,
		0,
		storage.SettingChanges{
			"transmission.downloadDirectory": []byte(`"/data/default-profile"`),
		},
		"test",
	); err != nil {
		testingObject.Fatalf("set Default profile folder: %v", err)
	}
	defaultProfile, err := server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Name = "Home"
	defaultProfile.Labels = []string{"Inbox"}
	defaultProfile.StartPaused = true
	defaultProfile.Options.PeerLimit = 80
	if _, err := server.store.UpdateDefaultTorrentProfile(
		context.Background(),
		defaultProfile,
	); err != nil {
		testingObject.Fatalf("update Default profile: %v", err)
	}

	response := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/torrent-profiles",
		"",
		cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
	}
	var body torrentProfilesResponse
	decodeBody(testingObject, response, &body)
	if body.DefaultProfile.Name != "Home" ||
		body.DefaultProfile.DownloadDirectory != "/data/default-profile" ||
		body.DefaultProfile.DownloadDirectoryLocked ||
		!reflect.DeepEqual(body.DefaultProfile.Labels, []string{"Inbox"}) ||
		!body.DefaultProfile.StartPaused ||
		body.DefaultProfile.Options.PeerLimit != 80 ||
		len(body.Profiles) != 0 {
		testingObject.Fatalf("torrent profiles response = %+v", body)
	}
}

// TestTorrentProfileConnectionValidation accepts existing connections and rejects others.
func TestTorrentProfileConnectionValidation(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	validBody := torrentProfileRequestWithConnection(
		testingObject,
		"Connected profile",
		fixture.second.ID,
		false,
	)
	created := performRequest(
		testingObject,
		fixture.server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		validBody,
		fixture.cookies,
		fixture.csrfToken,
	)
	if created.Code != http.StatusCreated ||
		!strings.Contains(created.Body.String(), `"connectionId":"`+fixture.second.ID+`"`) {
		testingObject.Fatalf("connected profile create = %d %s", created.Code, created.Body.String())
	}
	var profile storage.TorrentProfile
	decodeBody(testingObject, created, &profile)

	invalidBody := torrentProfileRequestWithConnection(
		testingObject,
		"Connected profile",
		"vpc-ffffffffffffffff",
		false,
	)
	updated := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+profile.ID,
		invalidBody,
		fixture.cookies,
		fixture.csrfToken,
	)
	if updated.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(updated.Body.String(), `"field":"connectionId"`) {
		testingObject.Fatalf("missing profile connection = %d %s", updated.Code, updated.Body.String())
	}
}

// TestUpdateDefaultTorrentProfileMovesDefaultTorrentsAfterConfirmation covers PUT.
func TestUpdateDefaultTorrentProfileMovesDefaultTorrentsAfterConfirmation(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  firstTestHash,
					"name":        "Default torrent",
					"downloadDir": "/data/downloads",
					"percentDone": 1,
					"status":      6,
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

	unconfirmed := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/default",
		defaultTorrentProfileRequest(testingObject, "/data/new-default", false),
		fixture.cookies,
		fixture.csrfToken,
	)
	if unconfirmed.Code != http.StatusConflict ||
		!strings.Contains(unconfirmed.Body.String(), `"code":"torrents_must_move"`) ||
		!strings.Contains(unconfirmed.Body.String(), `"torrents":1`) {
		testingObject.Fatalf("unconfirmed Default move = %d: %s", unconfirmed.Code, unconfirmed.Body.String())
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	confirmed := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/default",
		defaultTorrentProfileRequest(testingObject, "/data/new-default", true),
		fixture.cookies,
		fixture.csrfToken,
	)
	if confirmed.Code != http.StatusOK ||
		!strings.Contains(confirmed.Body.String(), `"downloadDirectory":"/data/new-default"`) ||
		!strings.Contains(confirmed.Body.String(), `"result":"moved"`) {
		testingObject.Fatalf("confirmed Default move = %d: %s", confirmed.Code, confirmed.Body.String())
	}
	for connectionName, calls := range map[string][]recordedTransmissionCall{
		"first":  fixture.firstFake.recordedCalls(),
		"second": fixture.secondFake.recordedCalls(),
	} {
		sessionCall := findTransmissionCall(testingObject, calls, "session-set")
		if sessionCall.Arguments["download-dir"] != "/data/new-default" {
			testingObject.Fatalf("%s Default folder session arguments = %#v", connectionName, sessionCall.Arguments)
		}
	}
	if pendingKeys := fixture.server.transmissionRestartKeys(context.Background()); len(pendingKeys) != 0 {
		testingObject.Fatalf("Default folder pending restart keys = %#v, want []", pendingKeys)
	}
	moveCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-set-location",
	)
	if moveCall.Arguments["location"] != "/data/new-default" ||
		moveCall.Arguments["move"] != true ||
		!reflect.DeepEqual(moveCall.Arguments["ids"], []any{firstTestHash}) {
		testingObject.Fatalf("Default profile move arguments = %#v", moveCall.Arguments)
	}
	updated, err := fixture.server.defaultTorrentProfile(context.Background())
	if err != nil || updated.DownloadDirectory != "/data/new-default" ||
		!reflect.DeepEqual(updated.Labels, []string{"Default label"}) ||
		!updated.StartPaused || updated.Options.PeerLimit != 70 {
		testingObject.Fatalf("updated Default profile = %+v, %v", updated, err)
	}
}

// TestUpdateDefaultTorrentProfileLabelsDoNotTouchExistingTorrents keeps tags free.
func TestUpdateDefaultTorrentProfileLabelsDoNotTouchExistingTorrents(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	fake, client := newFakeTransmissionDaemon(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	server.transmission = client

	response := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrent-profiles/default",
		defaultTorrentProfileRequest(testingObject, "/data/downloads", false),
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("Default labels update = %d: %s", response.Code, response.Body.String())
	}
	if calls := fake.recordedCalls(); len(calls) != 0 {
		testingObject.Fatalf("Default labels update reached Transmission: %#v", calls)
	}
}

// TestUpdateDefaultTorrentProfileValidatesFolderOwnershipAndManagedLock covers errors.
func TestUpdateDefaultTorrentProfileValidatesFolderOwnershipAndManagedLock(testingObject *testing.T) {
	testingObject.Run("folder validation", func(testingObject *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(testingObject)
		response := performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/torrent-profiles/default",
			defaultTorrentProfileRequest(testingObject, "/data/incomplete/default", false),
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusUnprocessableEntity ||
			!strings.Contains(response.Body.String(), `"field":"downloadDirectory"`) {
			testingObject.Fatalf("Default folder validation = %d: %s", response.Code, response.Body.String())
		}
	})

	testingObject.Run("named profile owns folder", func(testingObject *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(testingObject)
		if _, err := server.store.CreateTorrentProfile(
			context.Background(),
			storage.TorrentProfile{
				ID:                newTorrentProfileID(),
				Name:              "Movies",
				DownloadDirectory: "/data/Movies",
				Labels:            []string{},
				Options: storage.TorrentProfileOptions{
					Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
					PeerLimit: 50,
					Queue:     "normal",
				},
				MatchPatterns: []string{},
			},
		); err != nil {
			testingObject.Fatalf("create named profile: %v", err)
		}
		response := performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/torrent-profiles/default",
			defaultTorrentProfileRequest(testingObject, "/data/movies", false),
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusConflict ||
			!strings.Contains(response.Body.String(), `"code":"profile_folder_taken"`) ||
			!strings.Contains(response.Body.String(), "“Movies” is already the Movies profile's folder.") {
			testingObject.Fatalf("Default folder conflict = %d: %s", response.Code, response.Body.String())
		}
	})

	testingObject.Run("named profile owns name", func(testingObject *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(testingObject)
		if _, err := server.store.CreateTorrentProfile(
			context.Background(),
			storage.TorrentProfile{
				ID:                newTorrentProfileID(),
				Name:              "Movies",
				DownloadDirectory: "/data/movies",
				Labels:            []string{},
				Options: storage.TorrentProfileOptions{
					Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
					PeerLimit: 50,
					Queue:     "normal",
				},
				MatchPatterns: []string{},
			},
		); err != nil {
			testingObject.Fatalf("create named profile: %v", err)
		}
		response := performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/torrent-profiles/default",
			defaultTorrentProfileRequestWithName(testingObject, "movies", "/data/downloads", false),
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusConflict ||
			!strings.Contains(response.Body.String(), `"code":"torrent_profile_exists"`) ||
			!strings.Contains(response.Body.String(), `"field":"name"`) {
			testingObject.Fatalf("Default name conflict = %d: %s", response.Code, response.Body.String())
		}
	})

	testingObject.Run("managed lock", func(testingObject *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(testingObject)
		if _, err := server.store.ApplyManagedConfiguration(
			context.Background(),
			server.registry,
			&settings.ManagedDocument{
				Version: 1,
				Settings: map[string]settings.ManagedValue{
					"transmission.downloadDirectory": {
						Mode:  settings.ManagedModeLock,
						Value: json.RawMessage(`"/data/downloads"`),
					},
				},
			},
		); err != nil {
			testingObject.Fatalf("lock Download directory: %v", err)
		}
		getResponse := performRequest(
			testingObject,
			server,
			http.MethodGet,
			"/api/v1/torrent-profiles",
			"",
			cookies,
			"",
		)
		if getResponse.Code != http.StatusOK ||
			!strings.Contains(getResponse.Body.String(), `"downloadDirectoryLocked":true`) {
			testingObject.Fatalf("locked Default GET = %d: %s", getResponse.Code, getResponse.Body.String())
		}
		response := performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/torrent-profiles/default",
			defaultTorrentProfileRequest(testingObject, "/data/other", false),
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusConflict ||
			!strings.Contains(response.Body.String(), `"code":"setting_locked"`) {
			testingObject.Fatalf("locked Default PUT = %d: %s", response.Code, response.Body.String())
		}
	})
}

// TestTorrentProfileConnectionChangeRequiresAndPerformsMoves covers confirmation.
func TestTorrentProfileConnectionChangeRequiresAndPerformsMoves(testingObject *testing.T) {
	const hash = "dddddddddddddddddddddddddddddddddddddddd"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(hash, 1, 4)
			}
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  hash,
					"name":        "Profile torrent",
					"downloadDir": "/data/profile",
				}}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 51, "hashString": hash, "name": "Profile torrent",
				}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("profile metainfo")}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.first.ID)
	if err := fixture.server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{hash},
		&profile.ID,
	); err != nil {
		testingObject.Fatalf("assign profile torrent: %v", err)
	}
	if err := fixture.server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh profile assignments: %v", err)
	}

	withoutConfirmation := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+profile.ID,
		torrentProfileRequestWithConnection(
			testingObject,
			profile.Name,
			fixture.second.ID,
			false,
		),
		fixture.cookies,
		fixture.csrfToken,
	)
	if withoutConfirmation.Code != http.StatusConflict ||
		!strings.Contains(withoutConfirmation.Body.String(), `"torrents":1`) {
		testingObject.Fatalf(
			"unconfirmed profile move = %d %s",
			withoutConfirmation.Code,
			withoutConfirmation.Body.String(),
		)
	}
	storedBefore, err := fixture.server.store.FindTorrentProfile(context.Background(), profile.ID)
	if err != nil || storedBefore.ConnectionID == nil || *storedBefore.ConnectionID != fixture.first.ID {
		testingObject.Fatalf("profile changed before confirmation = %+v, %v", storedBefore, err)
	}

	withConfirmation := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+profile.ID,
		torrentProfileRequestWithConnection(
			testingObject,
			profile.Name,
			fixture.second.ID,
			true,
		),
		fixture.cookies,
		fixture.csrfToken,
	)
	if withConfirmation.Code != http.StatusOK ||
		!strings.Contains(withConfirmation.Body.String(), `"result":"moved"`) ||
		!strings.Contains(withConfirmation.Body.String(), `"hash":"`+hash+`"`) {
		testingObject.Fatalf(
			"confirmed profile move = %d %s",
			withConfirmation.Code,
			withConfirmation.Body.String(),
		)
	}
	storedAfter, err := fixture.server.store.FindTorrentProfile(context.Background(), profile.ID)
	if err != nil || storedAfter.ConnectionID == nil || *storedAfter.ConnectionID != fixture.second.ID {
		testingObject.Fatalf("profile connection after move = %+v, %v", storedAfter, err)
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") ||
		!containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatalf(
			"profile move calls = source %v target %v",
			transmissionMethods(fixture.firstFake.recordedCalls()),
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}
}

// TestTorrentProfileFolderChangeRequiresAndMovesFiles keeps daemon ownership stable.
func TestTorrentProfileFolderChangeRequiresAndMovesFiles(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  firstTestHash,
					"name":        "Folder move",
					"downloadDir": "/data/profile",
					"percentDone": 1,
					"status":      6,
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
		[]string{firstTestHash},
		&profile.ID,
	); err != nil {
		testingObject.Fatalf("assign torrent: %v", err)
	}
	if err := fixture.server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh assignments: %v", err)
	}

	requestBody := func(moveTorrents bool) string {
		var body map[string]any
		if err := json.Unmarshal(
			[]byte(torrentProfileRequestWithConnection(
				testingObject,
				profile.Name,
				fixture.first.ID,
				moveTorrents,
			)),
			&body,
		); err != nil {
			testingObject.Fatalf("decode profile body: %v", err)
		}
		body["downloadDirectory"] = "/data/new-profile"
		encoded, err := json.Marshal(body)
		if err != nil {
			testingObject.Fatalf("encode profile body: %v", err)
		}

		return string(encoded)
	}
	unconfirmed := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+profile.ID,
		requestBody(false),
		fixture.cookies,
		fixture.csrfToken,
	)
	if unconfirmed.Code != http.StatusConflict ||
		!strings.Contains(unconfirmed.Body.String(), `"code":"torrents_must_move"`) {
		testingObject.Fatalf("unconfirmed folder move = %d: %s", unconfirmed.Code, unconfirmed.Body.String())
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	confirmed := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-profiles/"+profile.ID,
		requestBody(true),
		fixture.cookies,
		fixture.csrfToken,
	)
	if confirmed.Code != http.StatusOK ||
		!strings.Contains(confirmed.Body.String(), `"result":"moved"`) {
		testingObject.Fatalf("confirmed folder move = %d: %s", confirmed.Code, confirmed.Body.String())
	}
	moveCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-set-location",
	)
	if moveCall.Arguments["location"] != "/data/new-profile" ||
		moveCall.Arguments["move"] != true ||
		containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") ||
		containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") {
		testingObject.Fatalf("folder move calls = %#v", fixture.firstFake.recordedCalls())
	}
}

// TestAddTorrentWithoutProfile covers the plain add route's normalized response.
func TestAddTorrentWithoutProfile(t *testing.T) {
	const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	server, cookies, csrfToken := newClaimedTestServer(t)
	if err := server.store.ReplaceTorrentNeedsProfile(
		context.Background(),
		hash,
		[]string{"tpr-0000000000000001", "tpr-0000000000000002"},
	); err != nil {
		t.Fatalf("store stale web-add profile choice: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		t.Fatalf("refresh stale web-add profile choice: %v", err)
	}
	fake, client := newFakeTransmissionDaemon(t, func(call recordedTransmissionCall) any {
		if call.Method != "torrent-add" && call.Method != "torrent-set" {
			t.Fatalf("unexpected RPC method %q", call.Method)
		}
		if call.Method == "torrent-set" {
			return map[string]any{}
		}

		return map[string]any{
			"torrent-added": map[string]any{
				"id":         7,
				"hashString": hash,
				"name":       "Plain download",
			},
		}
	})
	server.transmission = client

	response := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","labels":["Plain"],"paused":true}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated || response.Body.String() != "{\"id\":7,\"hash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"name\":\"Plain download\",\"duplicate\":false,\"profileName\":\"Default profile\",\"connectionName\":\"\"}\n" {
		t.Fatalf("plain add status %d: %s", response.Code, response.Body.String())
	}

	calls := fake.recordedCalls()
	if methods := transmissionMethods(calls); !reflect.DeepEqual(
		methods,
		[]string{"torrent-add", "torrent-set"},
	) {
		t.Fatalf("plain add calls = %+v", calls)
	}
	assertTransmissionArguments(t, calls[0].Arguments, `{"filename":"magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","download-dir":"/data/downloads","labels":["Plain"],"paused":true}`)
	assertTransmissionArguments(t, calls[1].Arguments, `{"ids":[7],"seedRatioMode":2,"seedIdleMode":2,"downloadLimited":false,"uploadLimited":false,"bandwidthPriority":0,"peer-limit":50}`)
	needs, err := server.store.ListTorrentNeedsProfiles(context.Background())
	if err != nil || len(needs) != 0 {
		t.Fatalf("web add retained pending profile choice = %#v, %v", needs, err)
	}
}

// TestAddTorrentRejectsARequestFolderOutsideItsProfile enforces folder ownership.
func TestAddTorrentRejectsARequestFolderOutsideItsProfile(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","downloadDirectory":"/data/other"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(response.Body.String(), `"field":"downloadDirectory"`) ||
		!strings.Contains(response.Body.String(), "The download folder comes from the profile.") {
		testingObject.Fatalf("mismatched add folder = %d: %s", response.Code, response.Body.String())
	}
}

// TestAddTorrentUsesDefaultProfileDefaults applies every omitted add value.
func TestAddTorrentUsesDefaultProfileDefaults(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profile, err := server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	profile.Labels = []string{"Default label"}
	profile.StartPaused = true
	profile.Options.PeerLimit = 77
	profile.Options.Queue = "top"
	if _, err := server.store.UpdateDefaultTorrentProfile(context.Background(), profile); err != nil {
		testingObject.Fatalf("update Default profile: %v", err)
	}

	fake, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-add" {
			return map[string]any{"torrent-added": map[string]any{
				"id": 15, "hashString": firstTestHash, "name": "Defaulted",
			}}
		}

		return map[string]any{}
	})
	server.transmission = client
	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:`+firstTestHash+`"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("Default profile add = %d: %s", response.Code, response.Body.String())
	}
	calls := fake.recordedCalls()
	if methods := transmissionMethods(calls); !reflect.DeepEqual(
		methods,
		[]string{"torrent-add", "torrent-set", "queue-move-top"},
	) {
		testingObject.Fatalf("Default profile add methods = %v", methods)
	}
	assertTransmissionArguments(
		testingObject,
		calls[0].Arguments,
		`{"filename":"magnet:?xt=urn:btih:`+firstTestHash+`","download-dir":"/data/downloads","labels":["Default label"],"paused":true}`,
	)
	if peerLimit, valid := integerValue(calls[1].Arguments["peer-limit"]); !valid || peerLimit != 77 {
		testingObject.Fatalf("Default profile options = %#v", calls[1].Arguments)
	}
}

// TestAddTorrentExplicitEmptyLabelsAndPausedOverrideDefaultProfile keeps free inputs.
func TestAddTorrentExplicitEmptyLabelsAndPausedOverrideDefaultProfile(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profile, err := server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	profile.Labels = []string{"Inherited only when omitted"}
	profile.StartPaused = true
	if _, err := server.store.UpdateDefaultTorrentProfile(context.Background(), profile); err != nil {
		testingObject.Fatalf("update Default profile: %v", err)
	}

	fake, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-add" {
			return map[string]any{"torrent-added": map[string]any{
				"id": 16, "hashString": secondTestHash, "name": "Explicit",
			}}
		}

		return map[string]any{}
	})
	server.transmission = client
	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:`+secondTestHash+`","labels":[],"paused":false}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated {
		testingObject.Fatalf("explicit add = %d: %s", response.Code, response.Body.String())
	}
	addCall := findTransmissionCall(testingObject, fake.recordedCalls(), "torrent-add")
	if !reflect.DeepEqual(addCall.Arguments["labels"], []any{}) ||
		addCall.Arguments["paused"] != false {
		testingObject.Fatalf("explicit add arguments = %#v", addCall.Arguments)
	}
}

// TestAddTorrentRejectsCommaLabels keeps Transmission-invalid labels at the boundary.
func TestAddTorrentRejectsCommaLabels(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","labels":["tv,hd"]}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(response.Body.String(), "Labels can't contain commas.") {
		testingObject.Fatalf("comma torrent label status %d: %s", response.Code, response.Body.String())
	}
}

// TestAddTorrentWithProfileAppliesOptionsAndAssigns verifies the required RPC sequence.
func TestAddTorrentWithProfileAppliesOptionsAndAssigns(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	profileID := createTorrentProfileForTest(t, server, cookies, csrfToken, "Movies", "top")

	fake, client := newFakeTransmissionDaemon(t, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-add" {
			return map[string]any{
				"torrent-added": map[string]any{
					"id":         9,
					"hashString": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					"name":       "Profiled download",
				},
			}
		}

		return map[string]any{}
	})
	server.transmission = client

	response := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/file.torrent","labels":["Form label"],"paused":false,"profileId":"`+profileID+`"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated || !strings.Contains(response.Body.String(), `"duplicate":false`) {
		t.Fatalf("profile add status %d: %s", response.Code, response.Body.String())
	}

	calls := fake.recordedCalls()
	wantMethods := []string{"torrent-add", "torrent-set", "queue-move-top", "torrent-start"}
	if methods := transmissionMethods(calls); !reflect.DeepEqual(methods, wantMethods) {
		t.Fatalf("RPC methods = %v, want %v", methods, wantMethods)
	}
	assertTransmissionArguments(t, calls[0].Arguments, `{"filename":"https://example.test/file.torrent","download-dir":"/data/movies","labels":["Form label"],"paused":true}`)
	assertTransmissionArguments(t, calls[1].Arguments, `{"ids":[9],"seedRatioMode":1,"seedRatioLimit":1.5,"seedIdleMode":2,"downloadLimited":true,"downloadLimit":1024,"uploadLimited":false,"bandwidthPriority":1,"peer-limit":60}`)
	assertTransmissionArguments(t, calls[2].Arguments, `{"ids":[9]}`)
	assertTransmissionArguments(t, calls[3].Arguments, `{"ids":[9]}`)

	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || assignments["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] != profileID {
		t.Fatalf("assignments = %+v, %v", assignments, err)
	}
}

// TestTorrentProfileNeverSeedingDisablesLimits covers the default option mapping.
func TestTorrentProfileNeverSeedingDisablesLimits(t *testing.T) {
	arguments := torrentProfileSetArguments(storage.TorrentProfile{
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
	}, []int64{10}, false)

	assertTransmissionArguments(t, arguments, `{"ids":[10],"seedRatioMode":2,"seedIdleMode":2,"downloadLimited":false,"uploadLimited":false,"bandwidthPriority":0,"peer-limit":50}`)
}

// TestDuplicateAddWithProfileChangesNothing leaves options and assignments untouched.
func TestDuplicateAddWithProfileChangesNothing(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	profileID := createTorrentProfileForTest(t, server, cookies, csrfToken, "Duplicates", "top")
	const hash = "cccccccccccccccccccccccccccccccccccccccc"
	if err := server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{hash},
		&profileID,
	); err != nil {
		t.Fatalf("store existing assignment: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		t.Fatalf("refresh existing assignment: %v", err)
	}

	fake, client := newFakeTransmissionDaemon(t, func(call recordedTransmissionCall) any {
		return map[string]any{
			"torrent-duplicate": map[string]any{
				"id":         11,
				"hashString": hash,
				"name":       "Existing download",
			},
		}
	})
	server.transmission = client

	response := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"https://example.test/duplicate.torrent","paused":false,"profileId":"`+profileID+`"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated ||
		!strings.Contains(response.Body.String(), `"duplicate":true`) ||
		!strings.Contains(response.Body.String(), `"profileName":"Duplicates"`) ||
		!strings.Contains(response.Body.String(), `"connectionName":`) {
		t.Fatalf("duplicate add status %d: %s", response.Code, response.Body.String())
	}
	if calls := fake.recordedCalls(); len(calls) != 1 || calls[0].Method != "torrent-add" ||
		calls[0].Arguments["paused"] != true {
		t.Fatalf("duplicate calls = %+v", calls)
	}
	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || len(assignments) != 1 || assignments[hash] != profileID {
		t.Fatalf("duplicate assignments = %+v, %v", assignments, err)
	}
}

// TestDuplicateAddWithUnassignedProfileFinishesProfile recovers a partial first add.
//
// A duplicate without an assignment receives the requested options, queue move, and
// durable assignment, while assigned duplicates remain unchanged in the prior test.
func TestDuplicateAddWithUnassignedProfileFinishesProfile(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profileID := createTorrentProfileForTest(
		testingObject,
		server,
		cookies,
		csrfToken,
		"Retry duplicate",
		"top",
	)
	const hash = "abababababababababababababababababababab"
	fake, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-add" {
			return map[string]any{
				"torrent-duplicate": map[string]any{
					"id":         12,
					"hashString": hash,
					"name":       "Partially added download",
				},
			}
		}

		return map[string]any{}
	})
	server.transmission = client

	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents",
		`{"filename":"magnet:?xt=urn:btih:abababababababababababababababababababab","profileId":"`+profileID+`"}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated || !strings.Contains(response.Body.String(), `"duplicate":true`) {
		testingObject.Fatalf("duplicate retry status %d: %s", response.Code, response.Body.String())
	}
	wantMethods := []string{"torrent-add", "torrent-set", "queue-move-top"}
	if methods := transmissionMethods(fake.recordedCalls()); !reflect.DeepEqual(methods, wantMethods) {
		testingObject.Fatalf("duplicate retry methods = %v, want %v", methods, wantMethods)
	}
	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || assignments[hash] != profileID {
		testingObject.Fatalf("duplicate retry assignments = %+v, %v", assignments, err)
	}
}

// TestDetachedTorrentProfileContextSurvivesCancellation bounds independent follow-up work.
func TestDetachedTorrentProfileContextSurvivesCancellation(testingObject *testing.T) {
	requestContext, cancelRequest := context.WithCancel(context.Background())
	cancelRequest()

	profileContext, cancelProfile := detachedTorrentProfileContext(requestContext)
	defer cancelProfile()
	if profileContext.Err() != nil {
		testingObject.Fatalf("detached profile context error = %v", profileContext.Err())
	}
	deadline, found := profileContext.Deadline()
	if !found || time.Until(deadline) <= 0 || time.Until(deadline) > torrentProfileApplyTimeout {
		testingObject.Fatalf("detached profile deadline = %v, found %v", deadline, found)
	}
}

// TestTorrentProfileReassignment optionally applies labels and options without queue work.
func TestTorrentProfileReassignment(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	vpnProfileID := uploadTestWireGuardProfile(t, server, cookies, csrfToken)
	createVPNConnectionForMultiTest(
		t,
		server,
		firstTestConnectionID,
		"Reassignment default",
		vpnProfileID,
		storage.DefaultVPNPeerPort,
	)
	profileID := createTorrentProfileForTest(t, server, cookies, csrfToken, "Reassign", "top")

	directories := map[string]string{
		"dddddddddddddddddddddddddddddddddddddddd": "/data/downloads",
		"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "/data/downloads",
	}
	fake, client := newFakeTransmissionDaemon(t, func(call recordedTransmissionCall) any {
		if call.Method == "torrent-get" {
			return map[string]any{"torrents": []map[string]any{
				{"id": 21, "hashString": "dddddddddddddddddddddddddddddddddddddddd", "name": "First", "downloadDir": directories["dddddddddddddddddddddddddddddddddddddddd"], "percentDone": 1, "status": 6},
				{"id": 22, "hashString": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "name": "Second", "downloadDir": directories["eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"], "percentDone": 1, "status": 6},
			}}
		}
		if call.Method == "torrent-set-location" {
			hashes, _ := rpcStringList(call.Arguments["ids"])
			location, _ := call.Arguments["location"].(string)
			for _, hash := range hashes {
				directories[hash] = location
			}
		}

		return map[string]any{}
	})
	server.transmission = client

	withoutApply := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"ids":[21,22],"profileId":"`+profileID+`","applyOptions":false}`,
		cookies,
		csrfToken,
	)
	if withoutApply.Code != http.StatusOK {
		t.Fatalf("reassign without apply status %d: %s", withoutApply.Code, withoutApply.Body.String())
	}
	if methods := transmissionMethods(fake.recordedCalls()); !reflect.DeepEqual(
		methods,
		[]string{
			"torrent-get", "torrent-get",
			"torrent-set-location", "torrent-verify", "torrent-start",
			"torrent-set-location", "torrent-verify", "torrent-start",
		},
	) {
		t.Fatalf("without-apply methods = %v", methods)
	}
	if !strings.Contains(withoutApply.Body.String(), `"result":"moved"`) {
		t.Fatalf("without-apply results = %s", withoutApply.Body.String())
	}
	assignments, _ := server.store.ListTorrentProfileAssignments(context.Background())
	if assignments["dddddddddddddddddddddddddddddddddddddddd"] != profileID ||
		assignments["eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"] != profileID {
		t.Fatalf("assignments without apply = %+v", assignments)
	}

	fake.clearCalls()
	withApply := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"ids":[21,22],"profileId":"`+profileID+`","applyOptions":true}`,
		cookies,
		csrfToken,
	)
	if withApply.Code != http.StatusOK {
		t.Fatalf("reassign with apply status %d: %s", withApply.Code, withApply.Body.String())
	}
	calls := fake.recordedCalls()
	if methods := transmissionMethods(calls); !reflect.DeepEqual(
		methods,
		[]string{"torrent-get", "torrent-get", "torrent-set", "queue-move-top"},
	) {
		t.Fatalf("with-apply methods = %v", methods)
	}
	assertTransmissionArguments(t, calls[2].Arguments, `{"ids":[21,22],"labels":["Saved label"],"seedRatioMode":1,"seedRatioLimit":1.5,"seedIdleMode":2,"downloadLimited":true,"downloadLimit":1024,"uploadLimited":false,"bandwidthPriority":1,"peer-limit":60}`)
	if !strings.Contains(withApply.Body.String(), `"result":"already-there"`) {
		t.Fatalf("with-apply results = %s", withApply.Body.String())
	}

	fake.clearCalls()
	cleared := performRequest(
		t,
		server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"ids":[21,22],"profileId":null,"applyOptions":true}`,
		cookies,
		csrfToken,
	)
	if cleared.Code != http.StatusOK {
		t.Fatalf("clear profile status %d: %s", cleared.Code, cleared.Body.String())
	}
	if methods := transmissionMethods(fake.recordedCalls()); !reflect.DeepEqual(
		methods,
		[]string{
			"torrent-get", "torrent-get", "torrent-set",
			"torrent-set-location", "torrent-verify", "torrent-start",
			"torrent-set-location", "torrent-verify", "torrent-start",
		},
	) {
		t.Fatalf("clear methods = %v", methods)
	}
	clearCalls := fake.recordedCalls()
	if !reflect.DeepEqual(clearCalls[2].Arguments["labels"], []any{}) {
		t.Fatalf("Default profile labels = %#v", clearCalls[2].Arguments)
	}
	if peerLimit, valid := integerValue(clearCalls[2].Arguments["peer-limit"]); !valid || peerLimit != 50 {
		t.Fatalf("Default profile options = %#v", clearCalls[2].Arguments)
	}
	assignments, _ = server.store.ListTorrentProfileAssignments(context.Background())
	if len(assignments) != 0 {
		t.Fatalf("assignments after clear = %+v", assignments)
	}
}

// TestTorrentProfileResolution applies a selected profile, clears the durable choice,
// moves the torrent, and resumes it even when the caller leaves applyOptions false.
//
// Since: UNRELEASED
func TestTorrentProfileResolution(testingObject *testing.T) {
	const hash = "cccccccccccccccccccccccccccccccccccccccc"
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	vpnProfileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Resolution default",
		vpnProfileID,
		storage.DefaultVPNPeerPort,
	)
	profileID := createTorrentProfileForTest(
		testingObject,
		server,
		cookies,
		csrfToken,
		"Resolved",
		"normal",
	)
	downloadDirectory := "/data/downloads"
	hideNextHashLookup := false
	fake, client := newFakeTransmissionDaemon(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				fields, _ := rpcStringList(call.Arguments["fields"])
				if hideNextHashLookup && reflect.DeepEqual(fields, []string{"hashString", "id"}) {
					hideNextHashLookup = false

					return map[string]any{"torrents": []map[string]any{}}
				}

				return map[string]any{"torrents": []map[string]any{{
					"id":          21,
					"hashString":  hash,
					"name":        "Ambiguous release",
					"downloadDir": downloadDirectory,
					"labels":      []string{"remote-test"},
					"percentDone": 0.99,
					"status":      0,
				}}}
			}
			if call.Method == "torrent-set-location" {
				downloadDirectory, _ = call.Arguments["location"].(string)
				hideNextHashLookup = true
			}

			return map[string]any{}
		},
	)
	server.transmission = client
	if err := server.store.ReplaceTorrentNeedsProfile(
		context.Background(),
		hash,
		[]string{profileID, "tpr-0000000000000999"},
	); err != nil {
		testingObject.Fatalf("store pending profile choice: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh pending profile choice: %v", err)
	}

	response := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"hashes":["`+hash+`"],"profileId":"`+profileID+`","applyOptions":false}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"applyOptions":true`) ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) {
		testingObject.Fatalf("resolve profile = %d %s", response.Code, response.Body.String())
	}
	calls := fake.recordedCalls()
	for _, method := range []string{"torrent-set", "torrent-set-location", "torrent-start"} {
		if !containsTransmissionMethod(calls, method) {
			testingObject.Fatalf("resolve methods = %v, missing %s", transmissionMethods(calls), method)
		}
	}
	var labelCall *recordedTransmissionCall
	for index := range calls {
		if calls[index].Method == "torrent-set" && calls[index].Arguments["labels"] != nil {
			labelCall = &calls[index]
			break
		}
	}
	if labelCall == nil || !reflect.DeepEqual(
		labelCall.Arguments["labels"],
		[]any{"remote-test", "Saved label"},
	) {
		testingObject.Fatalf("resolved profile labels = %#v", labelCall)
	}
	if downloadDirectory != "/data/resolved" {
		testingObject.Fatalf("resolved download directory = %q", downloadDirectory)
	}
	methods := transmissionMethods(calls)
	mutationMethods := []string{}
	for _, method := range methods {
		if method != "torrent-get" {
			mutationMethods = append(mutationMethods, method)
		}
	}
	if len(mutationMethods) < 3 || !reflect.DeepEqual(
		mutationMethods[len(mutationMethods)-3:],
		[]string{"torrent-set-location", "torrent-verify", "torrent-start"},
	) {
		testingObject.Fatalf("resolved final methods = %v", methods)
	}
	if containsTransmissionMethod(calls, "torrent-stop") {
		testingObject.Fatalf("resolved torrent was re-paused before start: %v", methods)
	}
	if !hideNextHashLookup {
		testingObject.Fatal("resolved state was routed through a post-move torrent lookup")
	}

	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || assignments[hash] != profileID {
		testingObject.Fatalf("resolved assignment = %#v, %v", assignments, err)
	}
	needs, err := server.store.ListTorrentNeedsProfiles(context.Background())
	if err != nil || len(needs) != 0 {
		testingObject.Fatalf("resolved pending choice = %#v, %v", needs, err)
	}
	pausedProfile, err := server.store.FindTorrentProfile(context.Background(), profileID)
	if err != nil {
		testingObject.Fatalf("read resolved profile: %v", err)
	}
	pausedProfile.StartPaused = true
	if _, err := server.store.UpdateTorrentProfile(
		context.Background(),
		profileID,
		pausedProfile,
	); err != nil {
		testingObject.Fatalf("pause resolved profile: %v", err)
	}
	if err := server.store.ReplaceTorrentNeedsProfile(
		context.Background(),
		hash,
		[]string{profileID},
	); err != nil {
		testingObject.Fatalf("restore pending profile choice: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh restored profile choice: %v", err)
	}
	hideNextHashLookup = false
	fake.clearCalls()
	response = performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"hashes":["`+hash+`"],"profileId":"`+profileID+`","applyOptions":false}`,
		cookies,
		csrfToken,
	)
	pausedMethods := transmissionMethods(fake.recordedCalls())
	if response.Code != http.StatusOK || len(pausedMethods) == 0 ||
		pausedMethods[len(pausedMethods)-1] != "torrent-stop" {
		testingObject.Fatalf(
			"paused profile resolution = %d %s, methods %v",
			response.Code,
			response.Body.String(),
			pausedMethods,
		)
	}
}

// TestTorrentProfileResolutionMovesAcrossConnectionsBeforeStarting covers a paused
// waiting torrent whose selected profile owns another daemon and download folder.
//
// Since: UNRELEASED
func TestTorrentProfileResolutionMovesAcrossConnectionsBeforeStarting(testingObject *testing.T) {
	const hash = "abcdefabcdefabcdefabcdefabcdefabcdefabcd"
	upperHash := strings.ToUpper(hash)
	sourcePresent := true
	targetPresent := false
	downloadDirectory := "/data/downloads"
	labels := []string{"remote-test"}
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				if !sourcePresent {
					return map[string]any{"torrents": []map[string]any{}}
				}
				if isTorrentMoveSnapshotCall(call) {
					snapshot := torrentMoveSnapshotResponse(upperHash, 1, 0)
					torrent := snapshot["torrents"].([]map[string]any)[0]
					torrent["downloadDir"] = downloadDirectory
					torrent["labels"] = labels
					torrent["name"] = "Debian netinst"

					return snapshot
				}

				return map[string]any{"torrents": []map[string]any{{
					"downloadDir": downloadDirectory,
					"hashString":  upperHash,
					"id":          7,
					"labels":      labels,
					"name":        "Debian netinst",
					"percentDone": 0.5,
					"status":      0,
				}}}
			case "torrent-remove":
				sourcePresent = false
			case "torrent-set":
				if nextLabels, valid := rpcStringList(call.Arguments["labels"]); valid {
					labels = nextLabels
				}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-add":
				targetPresent = true

				return map[string]any{"torrent-added": map[string]any{
					"hashString": upperHash,
					"id":         52,
					"name":       "Debian netinst",
				}}
			case "torrent-get":
				if !targetPresent {
					return map[string]any{"torrents": []map[string]any{}}
				}

				return map[string]any{"torrents": []map[string]any{{
					"downloadDir": downloadDirectory,
					"hashString":  upperHash,
					"id":          52,
					"labels":      labels,
					"name":        "Debian netinst",
					"percentDone": 0.5,
					"status":      0,
				}}}
			case "torrent-set-location":
				downloadDirectory, _ = call.Arguments["location"].(string)
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("resolution metainfo")}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)
	if err := fixture.server.store.ReplaceTorrentNeedsProfile(
		context.Background(),
		hash,
		[]string{profile.ID, "tpr-0000000000000999"},
	); err != nil {
		testingObject.Fatalf("store cross-connection pending profile choice: %v", err)
	}
	if err := fixture.server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh cross-connection pending profile choice: %v", err)
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"hashes":["`+upperHash+`"],"profileId":"`+profile.ID+`","applyOptions":false}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) {
		testingObject.Fatalf("cross-connection resolution = %d %s", response.Code, response.Body.String())
	}
	targetCalls := fixture.secondFake.recordedCalls()
	targetMutationMethods := []string{}
	for _, method := range transmissionMethods(targetCalls) {
		if method != "torrent-get" {
			targetMutationMethods = append(targetMutationMethods, method)
		}
	}
	if !reflect.DeepEqual(targetMutationMethods, []string{
		"torrent-add",
		"torrent-set",
		"torrent-set-location",
		"torrent-verify",
		"torrent-start",
	}) {
		testingObject.Fatalf("cross-connection target methods = %v", transmissionMethods(targetCalls))
	}
	if containsTransmissionMethod(targetCalls, "torrent-stop") {
		testingObject.Fatalf("cross-connection resolution re-paused target: %v", transmissionMethods(targetCalls))
	}
	addCall := findTransmissionCall(testingObject, targetCalls, "torrent-add")
	if addCall.Arguments["paused"] != true {
		testingObject.Fatalf("cross-connection target add = %#v", addCall.Arguments)
	}
	if downloadDirectory != profile.DownloadDirectory {
		testingObject.Fatalf("cross-connection resolution directory = %q", downloadDirectory)
	}
	if !reflect.DeepEqual(labels, []string{"remote-test", "profile"}) {
		testingObject.Fatalf("cross-connection resolution labels = %#v", labels)
	}
}

// TestTorrentProfileReassignmentMovesToTheProfilesConnection covers direct reassignment.
func TestTorrentProfileReassignmentMovesToTheProfilesConnection(testingObject *testing.T) {
	const hash = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" && isTorrentMoveSnapshotCall(call) {
				return torrentMoveSnapshotResponse(hash, 1, 4)
			}
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id":          7,
					"hashString":  hash,
					"name":        "Reassigned torrent",
					"downloadDir": "/data/downloads",
				}}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 52, "hashString": hash, "name": "Reassigned torrent",
				}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("reassignment metainfo")}
	profile := createMultiVPNProfile(testingObject, fixture.server, fixture.second.ID)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrents/profile",
		`{"hashes":["`+hash+`"],"profileId":"`+profile.ID+`","applyOptions":false}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"result":"moved"`) {
		testingObject.Fatalf("reassignment move = %d %s", response.Code, response.Body.String())
	}
	var moveResponse struct {
		Moved []torrentMoveResult `json:"moved"`
	}
	decodeBody(testingObject, response, &moveResponse)
	wantFacadeID, facadeError := transmissionrpc.FacadeID(fixture.second.Slot, 52)
	if facadeError != nil || len(moveResponse.Moved) != 1 || moveResponse.Moved[0].ID != wantFacadeID {
		testingObject.Fatalf("reassignment facade handoff = %+v, %v", moveResponse.Moved, facadeError)
	}
	assignments, err := fixture.server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || assignments[hash] != profile.ID {
		testingObject.Fatalf("reassignment records = %+v, %v", assignments, err)
	}
	if !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") ||
		!containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatalf(
			"reassignment calls = source %v target %v",
			transmissionMethods(fixture.firstFake.recordedCalls()),
			transmissionMethods(fixture.secondFake.recordedCalls()),
		)
	}

}

// TestTorrentPayloadsIncludeProfileID covers list, detail, and live snapshots.
func TestTorrentPayloadsIncludeProfileID(t *testing.T) {
	server, cookies, _ := newClaimedTestServer(t)
	profile, err := server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
		ID:                "tpr-0000000000000099",
		Name:              "Payloads",
		DownloadDirectory: "/data/payloads",
		Labels:            []string{},
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
		MatchPatterns: []string{},
	})
	if err != nil {
		t.Fatalf("create payload profile: %v", err)
	}
	const hash = "ffffffffffffffffffffffffffffffffffffffff"
	const staleHash = "0000000000000000000000000000000000000000"
	if err := server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{hash, staleHash},
		&profile.ID,
	); err != nil {
		t.Fatalf("assign payload torrent: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		t.Fatalf("refresh assignments: %v", err)
	}

	_, client := newFakeTransmissionDaemon(t, func(call recordedTransmissionCall) any {
		switch call.Method {
		case "session-stats":
			return map[string]any{"activeTorrentCount": 1}
		case "torrent-get":
			return map[string]any{"torrents": []map[string]any{{
				"id":         31,
				"hashString": hash,
				"name":       "Assigned download",
			}}}
		default:
			t.Fatalf("unexpected RPC method %q", call.Method)
			return nil
		}
	})
	server.transmission = client

	list := performRequest(t, server, http.MethodGet, "/api/v1/torrents", "", cookies, "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"profileId":"`+profile.ID+`"`) {
		t.Fatalf("list payload status %d: %s", list.Code, list.Body.String())
	}
	assignments, err := server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || len(assignments) != 1 || assignments[hash] != profile.ID {
		t.Fatalf("assignments after complete list = %+v, %v", assignments, err)
	}
	detail := performRequest(t, server, http.MethodGet, "/api/v1/torrents/31", "", cookies, "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"profileId":"`+profile.ID+`"`) {
		t.Fatalf("detail payload status %d: %s", detail.Code, detail.Body.String())
	}

	snapshot := server.buildLiveSnapshot(context.Background(), 1)
	if len(snapshot.Torrents) != 1 || snapshot.Torrents[0]["profileId"] != profile.ID {
		t.Fatalf("live torrent payload = %+v", snapshot.Torrents)
	}
}

// TestTorrentPayloadsIncludeNeedsProfile covers list, detail, and live snapshots for
// an unresolved remote-app pattern tie.
func TestTorrentPayloadsIncludeNeedsProfile(testingObject *testing.T) {
	const hash = "abababababababababababababababababababab"
	profileIDs := []string{
		"tpr-0000000000000001",
		"tpr-0000000000000002",
	}
	server, cookies, _ := newClaimedTestServer(testingObject)
	if err := server.store.ReplaceTorrentNeedsProfile(
		context.Background(),
		hash,
		profileIDs,
	); err != nil {
		testingObject.Fatalf("store payload profile choice: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh payload profile choice: %v", err)
	}

	_, client := newFakeTransmissionDaemon(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "session-stats":
				return map[string]any{"activeTorrentCount": 1}
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{{
					"id":         32,
					"hashString": hash,
					"name":       "Ambiguous payload",
				}}}
			default:
				testingObject.Fatalf("unexpected RPC method %q", call.Method)

				return nil
			}
		},
	)
	server.transmission = client
	wantJSON := `"needsProfile":{"profileIds":["` + profileIDs[0] + `","` + profileIDs[1] + `"]}`

	list := performRequest(testingObject, server, http.MethodGet, "/api/v1/torrents", "", cookies, "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), wantJSON) {
		testingObject.Fatalf("list pending profile payload = %d: %s", list.Code, list.Body.String())
	}
	detail := performRequest(testingObject, server, http.MethodGet, "/api/v1/torrents/32", "", cookies, "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), wantJSON) {
		testingObject.Fatalf("detail pending profile payload = %d: %s", detail.Code, detail.Body.String())
	}

	snapshot := server.buildLiveSnapshot(context.Background(), 1)
	wantNeedsProfile := map[string]any{"profileIds": profileIDs}
	if len(snapshot.Torrents) != 1 ||
		!reflect.DeepEqual(snapshot.Torrents[0]["needsProfile"], wantNeedsProfile) {
		testingObject.Fatalf("live pending profile payload = %+v", snapshot.Torrents)
	}
}

func testTorrentProfileRequest(name string, directory string, queue string) string {
	body, _ := json.Marshal(map[string]any{
		"name":              name,
		"downloadDirectory": directory,
		"labels":            []string{"Saved label"},
		"startPaused":       false,
		"matchPatterns":     []string{"*2160p?*"},
		"connectionId":      nil,
		"options": map[string]any{
			"seeding": map[string]any{
				"mode":  "limit",
				"ratio": 1.5,
			},
			"downloadLimitKBps": 1024,
			"uploadLimitKBps":   nil,
			"bandwidthPriority": 1,
			"peerLimit":         60,
			"queue":             queue,
		},
	})

	return string(body)
}

func defaultTorrentProfileRequest(
	testingObject *testing.T,
	directory string,
	moveTorrents bool,
) string {
	return defaultTorrentProfileRequestWithName(
		testingObject,
		"Default profile",
		directory,
		moveTorrents,
	)
}

func defaultTorrentProfileRequestWithName(
	testingObject *testing.T,
	name string,
	directory string,
	moveTorrents bool,
) string {
	testingObject.Helper()
	body, err := json.Marshal(map[string]any{
		"downloadDirectory": directory,
		"labels":            []string{"Default label"},
		"name":              name,
		"startPaused":       true,
		"moveTorrents":      moveTorrents,
		"options": map[string]any{
			"seeding": map[string]any{
				"mode": "never",
			},
			"downloadLimitKBps": nil,
			"uploadLimitKBps":   nil,
			"bandwidthPriority": 0,
			"peerLimit":         70,
			"queue":             "normal",
		},
	})
	if err != nil {
		testingObject.Fatalf("encode Default profile request: %v", err)
	}

	return string(body)
}

func torrentProfileRequestWithConnection(
	testingObject *testing.T,
	name string,
	connectionID string,
	moveTorrents bool,
) string {
	testingObject.Helper()
	var body map[string]any
	if err := json.Unmarshal(
		[]byte(testTorrentProfileRequest(name, "/data/connected-profile", "normal")),
		&body,
	); err != nil {
		testingObject.Fatalf("decode profile request fixture: %v", err)
	}
	body["connectionId"] = connectionID
	body["moveTorrents"] = moveTorrents
	content, err := json.Marshal(body)
	if err != nil {
		testingObject.Fatalf("encode connected profile request: %v", err)
	}

	return string(content)
}

// assignTorrentProfileForDeleteTest creates and publishes one durable assignment.
func assignTorrentProfileForDeleteTest(
	testingObject *testing.T,
	server *Server,
	profileID string,
	hash string,
) {
	testingObject.Helper()
	if err := server.store.ReplaceTorrentProfileAssignments(
		context.Background(),
		[]string{hash},
		&profileID,
	); err != nil {
		testingObject.Fatalf("assign deleted profile torrent: %v", err)
	}
	if err := server.refreshTorrentProfileAssignments(context.Background()); err != nil {
		testingObject.Fatalf("refresh deleted profile assignments: %v", err)
	}
}

// assertDeletedTorrentProfileIsDefault checks the post-delete durable owner state.
func assertDeletedTorrentProfileIsDefault(
	testingObject *testing.T,
	server *Server,
	profileID string,
	hash string,
) {
	testingObject.Helper()
	if _, err := server.store.FindTorrentProfile(
		context.Background(),
		profileID,
	); !errors.Is(err, storage.ErrNotFound) {
		testingObject.Fatalf("deleted torrent profile lookup error = %v", err)
	}
	assignments, err := server.store.ListTorrentProfileAssignments(
		context.Background(),
	)
	if err != nil {
		testingObject.Fatalf("list assignments after profile deletion: %v", err)
	}
	if _, assigned := assignments[hash]; assigned {
		testingObject.Fatalf("torrent %s still has a named profile: %+v", hash, assignments)
	}
}

func isTorrentMoveSnapshotCall(call recordedTransmissionCall) bool {
	fields, found := call.Arguments["fields"].([]any)

	return found && len(fields) == len(torrentMoveFields)
}

func createTorrentProfileForTest(
	t *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	name string,
	queue string,
) string {
	t.Helper()

	response := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/torrent-profiles",
		testTorrentProfileRequest(name, "/data/"+strings.ToLower(name), queue),
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusCreated {
		t.Fatalf("create %s profile status %d: %s", name, response.Code, response.Body.String())
	}
	var profile storage.TorrentProfile
	decodeBody(t, response, &profile)

	return profile.ID
}

func transmissionMethods(calls []recordedTransmissionCall) []string {
	methods := make([]string, 0, len(calls))
	for _, call := range calls {
		methods = append(methods, call.Method)
	}

	return methods
}

func assertTransmissionArguments(t *testing.T, actual map[string]any, expectedJSON string) {
	t.Helper()

	actualJSON, err := json.Marshal(actual)
	if err != nil {
		t.Fatalf("encode actual RPC arguments: %v", err)
	}
	var canonicalActual map[string]any
	if err := json.Unmarshal(actualJSON, &canonicalActual); err != nil {
		t.Fatalf("decode actual RPC arguments: %v", err)
	}

	var expected map[string]any
	if err := json.Unmarshal([]byte(expectedJSON), &expected); err != nil {
		t.Fatalf("decode expected RPC arguments: %v", err)
	}
	if !reflect.DeepEqual(canonicalActual, expected) {
		t.Fatalf("RPC arguments = %#v, want %#v", canonicalActual, expected)
	}
}
