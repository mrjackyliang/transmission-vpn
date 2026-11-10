package api

import (
	"context"
	"encoding/base64"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// moveTestDirectoryBrowser records metainfo reads while reusing the browser fake.
type moveTestDirectoryBrowser struct {
	testDirectoryBrowser
	content []byte
	err     error
	paths   []string
}

func (browser *moveTestDirectoryBrowser) ReadTorrent(
	_ context.Context,
	path string,
) ([]byte, error) {
	browser.paths = append(browser.paths, path)
	if browser.err != nil {
		return nil, browser.err
	}

	return append([]byte(nil), browser.content...), nil
}

// TestMoveTorrentRestoresMetainfoFilesAndOptions covers the complete daemon transfer.
func TestMoveTorrentRestoresMetainfoFilesAndOptions(testingObject *testing.T) {
	const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	sourceSnapshot := torrentMoveSnapshotResponse(hash, 1, 4)
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return sourceSnapshot
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 41, "hashString": hash, "name": "Moved torrent",
				}}
			}

			return map[string]any{}
		},
	)
	browser := &moveTestDirectoryBrowser{content: []byte("torrent metainfo bytes")}
	fixture.server.directoryBrowser = browser
	fixture.server.torrentHashSets = map[string]map[string]torrentLocation{
		fixture.first.ID: {
			hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Moved torrent"},
		},
		fixture.second.ID: {},
	}
	fixture.server.torrentHashIndex = map[string]torrentLocation{
		hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Moved torrent"},
	}

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	wantFacadeID, facadeError := transmissionrpc.FacadeID(fixture.second.Slot, 41)
	if err != nil || facadeError != nil || result.Result != "moved" ||
		result.Hash != hash || result.ID != wantFacadeID {
		testingObject.Fatalf("move result = %+v, %v", result, err)
	}
	wantPath := "/config/transmission/" + fixture.first.ID + "/torrents/" + hash + ".torrent"
	if !reflect.DeepEqual(browser.paths, []string{wantPath}) {
		testingObject.Fatalf("metainfo paths = %v, want %s", browser.paths, wantPath)
	}

	sourceCalls := fixture.firstFake.recordedCalls()
	if methods := transmissionMethods(sourceCalls); !reflect.DeepEqual(
		methods,
		[]string{"torrent-get", "torrent-get", "torrent-remove"},
	) {
		testingObject.Fatalf("source methods = %v", methods)
	}
	assertTransmissionArguments(
		testingObject,
		sourceCalls[2].Arguments,
		`{"delete-local-data":false,"ids":["`+hash+`"]}`,
	)

	targetCalls := fixture.secondFake.recordedCalls()
	if methods := transmissionMethods(targetCalls); !reflect.DeepEqual(
		methods,
		[]string{"torrent-get", "torrent-add", "torrent-set", "torrent-verify", "torrent-start"},
	) {
		testingObject.Fatalf("target methods = %v", methods)
	}
	assertTransmissionArguments(
		testingObject,
		targetCalls[1].Arguments,
		`{"download-dir":"/data/downloads","labels":["archive","linux"],"metainfo":"`+
			base64.StdEncoding.EncodeToString(browser.content)+`","paused":true}`,
	)
	assertTransmissionArguments(
		testingObject,
		targetCalls[2].Arguments,
		`{"ids":["`+hash+`"],"files-wanted":[0,2],"files-unwanted":[1],`+
			`"priority-high":[0],"priority-normal":[1],"priority-low":[2],`+
			`"downloadLimit":512,"downloadLimited":true,"uploadLimit":256,`+
			`"uploadLimited":true,"honorsSessionLimits":false,"bandwidthPriority":1,`+
			`"seedRatioLimit":2.5,"seedRatioMode":1,"seedIdleLimit":30,`+
			`"seedIdleMode":1,"peer-limit":75,"group":""}`,
	)
	// Snapshot ID 7 and target ID 41 deliberately differ. Every later mutation must
	// remain hash-addressed even if either daemon reloads and renumbers its torrents.
	for _, call := range targetCalls[2:] {
		assertTransmissionHashID(testingObject, call, hash)
	}
	location, found := fixture.server.torrentLocationByHash(hash)
	if !found || location.ConnectionID != fixture.second.ID || location.FacadeID == 7 {
		testingObject.Fatalf("moved hash location = %+v, found %t", location, found)
	}
}

// TestMoveTorrentRejectsDataRootSnapshot prevents daemon moves from replaying /data.
//
// A legacy torrent stays on its current connection until the user moves its data
// into a child folder, preserving the rule without moving files implicitly.
//
// Since: 2.0.0
func TestMoveTorrentRejectsDataRootSnapshot(testingObject *testing.T) {
	const hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	sourceSnapshot := torrentMoveSnapshotResponse(hash, 1, 4)
	torrents := sourceSnapshot["torrents"].([]map[string]any)
	torrents[0]["downloadDir"] = "/data"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return sourceSnapshot
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.server.torrentHashSets = map[string]map[string]torrentLocation{
		fixture.first.ID: {
			hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Legacy root torrent"},
		},
		fixture.second.ID: {},
	}
	fixture.server.torrentHashIndex = map[string]torrentLocation{
		hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Legacy root torrent"},
	}

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err == nil || err.Error() != "Choose a folder inside /data, not /data itself." ||
		result.Error != "Choose a folder inside /data, not /data itself." {
		testingObject.Fatalf("root move result = %+v, %v", result, err)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatal("root move reached the target Transmission daemon")
	}
}

// TestMoveTorrentRejectsIncompleteDirectorySnapshot protects cross-connection moves.
//
// A legacy torrent may already report a reserved location, but the move refuses it
// before adding or removing anything on either daemon.
//
// Since: 2.0.0
func TestMoveTorrentRejectsIncompleteDirectorySnapshot(testingObject *testing.T) {
	const hash = "cccccccccccccccccccccccccccccccccccccccc"
	sourceSnapshot := torrentMoveSnapshotResponse(hash, 1, 4)
	torrents := sourceSnapshot["torrents"].([]map[string]any)
	torrents[0]["downloadDir"] = "/data/incomplete/legacy"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return sourceSnapshot
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.server.torrentHashSets = map[string]map[string]torrentLocation{
		fixture.first.ID: {
			hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Legacy incomplete torrent"},
		},
		fixture.second.ID: {},
	}
	fixture.server.torrentHashIndex = map[string]torrentLocation{
		hash: {ConnectionID: fixture.first.ID, FacadeID: 7, Name: "Legacy incomplete torrent"},
	}

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	const message = "Choose a folder outside the incomplete folder, /data/incomplete."
	if err == nil || err.Error() != message || result.Error != message {
		testingObject.Fatalf("incomplete move result = %+v, %v", result, err)
	}
	for _, call := range append(
		fixture.firstFake.recordedCalls(),
		fixture.secondFake.recordedCalls()...,
	) {
		if call.Method == "torrent-add" || call.Method == "torrent-remove" {
			testingObject.Fatalf("reserved move changed Transmission: %#v", call)
		}
	}
}

// TestConcurrentMovesRediscoverTheTorrentUnderItsHashLock proves two moves with a
// stale source cannot leave copies on both targets or remove an unrelated daemon ID.
func TestConcurrentMovesRediscoverTheTorrentUnderItsHashLock(testingObject *testing.T) {
	const (
		hash              = "dddddddddddddddddddddddddddddddddddddddd"
		thirdConnectionID = "vpc-3333333333333333"
	)
	var stateMutex sync.Mutex
	present := map[string]bool{firstTestConnectionID: true}
	firstTargetAddStarted := make(chan struct{})
	releaseFirstTargetAdd := make(chan struct{})
	var blockFirstTargetAdd sync.Once

	responder := func(connectionID string, daemonID int64) func(recordedTransmissionCall) any {
		return func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				stateMutex.Lock()
				isPresent := present[connectionID]
				stateMutex.Unlock()
				if !isPresent {
					return map[string]any{"torrents": []map[string]any{}}
				}
				if isTorrentMoveSnapshotCall(call) {
					return torrentMoveSnapshotResponse(hash, 1, 0)
				}

				return map[string]any{"torrents": []map[string]any{{
					"id": daemonID, "hashString": hash, "name": "Concurrent move",
				}}}
			case "torrent-add":
				if connectionID == secondTestConnectionID {
					blockFirstTargetAdd.Do(func() {
						close(firstTargetAddStarted)
						<-releaseFirstTargetAdd
					})
				}
				stateMutex.Lock()
				present[connectionID] = true
				stateMutex.Unlock()

				return map[string]any{"torrent-added": map[string]any{
					"id": daemonID, "hashString": hash, "name": "Concurrent move",
				}}
			case "torrent-remove":
				assertTransmissionHashID(testingObject, call, hash)
				stateMutex.Lock()
				present[connectionID] = false
				stateMutex.Unlock()
			}

			return map[string]any{}
		}
	}

	fixture := newMultiTransmissionFixture(
		testingObject,
		responder(firstTestConnectionID, 101),
		responder(secondTestConnectionID, 102),
	)
	third := createVPNConnectionForMultiTest(
		testingObject,
		fixture.server,
		thirdConnectionID,
		"Tertiary",
		fixture.first.ProfileIDs[0],
		51415,
	)
	thirdFake, _ := newFakeTransmissionDaemon(
		testingObject,
		responder(thirdConnectionID, 103),
	)
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
			Endpoint:     fixture.secondFake.server.URL + "/transmission/rpc",
		},
		{
			ConnectionID: third.ID,
			Slot:         third.Slot,
			PeerPort:     third.PeerPort,
			Endpoint:     thirdFake.server.URL + "/transmission/rpc",
		},
	}); err != nil {
		testingObject.Fatalf("configure third Transmission daemon: %v", err)
	}
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("metainfo")}

	type moveAnswer struct {
		result torrentMoveResult
		err    error
	}
	firstAnswer := make(chan moveAnswer, 1)
	secondAnswer := make(chan moveAnswer, 1)
	go func() {
		result, err := fixture.server.moveTorrent(
			context.Background(),
			hash,
			fixture.first.ID,
			fixture.second.ID,
		)
		firstAnswer <- moveAnswer{result: result, err: err}
	}()
	<-firstTargetAddStarted
	go func() {
		result, err := fixture.server.moveTorrent(
			context.Background(),
			hash,
			fixture.first.ID,
			third.ID,
		)
		secondAnswer <- moveAnswer{result: result, err: err}
	}()
	select {
	case answer := <-secondAnswer:
		testingObject.Fatalf("competing move bypassed the hash lock: %+v", answer)
	case <-time.After(50 * time.Millisecond):
	}
	close(releaseFirstTargetAdd)

	for index, answerChannel := range []<-chan moveAnswer{firstAnswer, secondAnswer} {
		answer := <-answerChannel
		if answer.err != nil || answer.result.Result != "moved" {
			testingObject.Fatalf("move %d = %+v, %v", index, answer.result, answer.err)
		}
	}
	stateMutex.Lock()
	defer stateMutex.Unlock()
	if present[fixture.first.ID] || present[fixture.second.ID] || !present[third.ID] {
		testingObject.Fatalf("final daemon placement = %+v", present)
	}
}

// TestMoveTorrentResolvesAmbiguousSourceRemoval distinguishes a timeout after a
// successful removal from a timeout that left the source copy in place.
func TestMoveTorrentResolvesAmbiguousSourceRemoval(testingObject *testing.T) {
	for _, scenario := range []struct {
		name                string
		removeSource        bool
		wantResult          string
		wantTargetRollback  bool
		wantWarningFragment string
	}{
		{
			name:                "source is gone",
			removeSource:        true,
			wantResult:          "moved",
			wantWarningFragment: "absence was confirmed",
		},
		{
			name:               "source remains",
			wantResult:         "failed",
			wantTargetRollback: true,
		},
	} {
		testingObject.Run(scenario.name, func(testingObject *testing.T) {
			const hash = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
			var stateMutex sync.Mutex
			sourcePresent := true
			targetPresent := false
			fixture := newMultiTransmissionFixture(
				testingObject,
				func(call recordedTransmissionCall) any {
					switch call.Method {
					case "torrent-get":
						stateMutex.Lock()
						present := sourcePresent
						stateMutex.Unlock()
						if !present {
							return map[string]any{"torrents": []map[string]any{}}
						}
						if isTorrentMoveSnapshotCall(call) {
							return torrentMoveSnapshotResponse(hash, 0, 0)
						}

						return map[string]any{"torrents": []map[string]any{{
							"id": 7, "hashString": hash, "name": "Ambiguous removal",
						}}}
					case "torrent-remove":
						stateMutex.Lock()
						if scenario.removeSource {
							sourcePresent = false
						}
						stateMutex.Unlock()

						return fakeTransmissionResponse{Status: 500}
					}

					return map[string]any{}
				},
				func(call recordedTransmissionCall) any {
					switch call.Method {
					case "torrent-get":
						stateMutex.Lock()
						present := targetPresent
						stateMutex.Unlock()
						if present {
							return map[string]any{"torrents": []map[string]any{{
								"id": 81, "hashString": hash, "name": "Ambiguous removal",
							}}}
						}

						return map[string]any{"torrents": []map[string]any{}}
					case "torrent-add":
						stateMutex.Lock()
						targetPresent = true
						stateMutex.Unlock()

						return map[string]any{"torrent-added": map[string]any{
							"id": 81, "hashString": hash, "name": "Ambiguous removal",
						}}
					case "torrent-remove":
						stateMutex.Lock()
						targetPresent = false
						stateMutex.Unlock()
					}

					return map[string]any{}
				},
			)

			result, err := fixture.server.moveTorrent(
				context.Background(),
				hash,
				fixture.first.ID,
				fixture.second.ID,
			)
			if result.Result != scenario.wantResult || (err == nil) == (scenario.wantResult == "failed") {
				testingObject.Fatalf("ambiguous remove result = %+v, %v", result, err)
			}
			if scenario.wantWarningFragment != "" &&
				!strings.Contains(strings.Join(result.Warnings, " "), scenario.wantWarningFragment) {
				testingObject.Fatalf("ambiguous remove warnings = %v", result.Warnings)
			}
			stateMutex.Lock()
			defer stateMutex.Unlock()
			if targetPresent == scenario.wantTargetRollback {
				testingObject.Fatalf("target present = %t, rollback wanted %t", targetPresent, scenario.wantTargetRollback)
			}
		})
	}
}

// TestMoveTorrentPostRemovalFailuresAreWarnings keeps the completed placement when
// display-ID refresh, verification, and restart fail after source removal.
func TestMoveTorrentPostRemovalFailuresAreWarnings(testingObject *testing.T) {
	const hash = "abababababababababababababababababababab"
	var sourcePresent = true
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				if !sourcePresent {
					return map[string]any{"torrents": []map[string]any{}}
				}
				if isTorrentMoveSnapshotCall(call) {
					return torrentMoveSnapshotResponse(hash, 0, 4)
				}

				return map[string]any{"torrents": []map[string]any{{
					"id": 7, "hashString": hash, "name": "Warning move",
				}}}
			}
			if call.Method == "torrent-remove" {
				sourcePresent = false
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": int64(1 << 24), "hashString": hash, "name": "Warning move",
				}}
			case "torrent-verify", "torrent-start":
				return fakeTransmissionResponse{Status: 500}
			}

			return map[string]any{}
		},
	)

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err != nil || result.Result != "moved" || len(result.Warnings) != 3 {
		testingObject.Fatalf("warning-only move = %+v, %v", result, err)
	}
	if sourcePresent {
		testingObject.Fatal("source copy remained after warning-only move")
	}
}

// TestMoveTorrentReportsFailedRollback leaves duplicate recovery visible when the
// target copy cannot be removed after a pre-removal failure.
func TestMoveTorrentReportsFailedRollback(testingObject *testing.T) {
	const hash = "acacacacacacacacacacacacacacacacacacacac"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return torrentMoveSnapshotResponse(hash, 0, 0)
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 91, "hashString": hash, "name": "Rollback failure",
				}}
			case "torrent-set":
				return fakeTransmissionResponse{Result: "invalid arguments"}
			case "torrent-remove":
				return fakeTransmissionResponse{Result: "still busy"}
			}

			return map[string]any{}
		},
	)

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err == nil || result.Result != "failed" ||
		!strings.Contains(result.Error, "A paused copy is still on Secondary") {
		testingObject.Fatalf("failed rollback result = %+v, %v", result, err)
	}
}

// TestTorrentMoveSelectionArgumentsNeverSendEmptyLists covers Transmission's
// all-files meaning for empty selection and priority arrays.
func TestTorrentMoveSelectionArgumentsNeverSendEmptyLists(testingObject *testing.T) {
	for _, scenario := range []struct {
		name      string
		fileStats []torrentMoveFileState
		present   []string
		absent    []string
	}{
		{
			name: "all files high",
			fileStats: []torrentMoveFileState{
				{Wanted: true, Priority: 1}, {Wanted: true, Priority: 1},
			},
			present: []string{"files-wanted", "priority-high"},
			absent:  []string{"files-unwanted", "priority-low", "priority-normal"},
		},
		{
			name: "high with normal but no low",
			fileStats: []torrentMoveFileState{
				{Wanted: true, Priority: 1}, {Wanted: true, Priority: 0},
			},
			present: []string{"files-wanted", "priority-high", "priority-normal"},
			absent:  []string{"files-unwanted", "priority-low"},
		},
		{
			name: "every file unwanted",
			fileStats: []torrentMoveFileState{
				{Wanted: false, Priority: 0}, {Wanted: false, Priority: 0},
			},
			present: []string{"files-unwanted", "priority-normal"},
			absent:  []string{"files-wanted", "priority-high", "priority-low"},
		},
		{
			name: "mixed",
			fileStats: []torrentMoveFileState{
				{Wanted: true, Priority: 1},
				{Wanted: false, Priority: -1},
				{Wanted: true, Priority: 0},
			},
			present: []string{
				"files-wanted", "files-unwanted", "priority-high", "priority-low", "priority-normal",
			},
		},
	} {
		testingObject.Run(scenario.name, func(testingObject *testing.T) {
			arguments := torrentMoveSetArguments(torrentMoveSnapshot{
				FileStats: scenario.fileStats,
			}, "adadadadadadadadadadadadadadadadadadadad")
			for _, key := range scenario.present {
				value, found := arguments[key]
				if !found || reflect.ValueOf(value).Len() == 0 {
					testingObject.Fatalf("%s = %#v, found %t", key, value, found)
				}
			}
			for _, key := range scenario.absent {
				if value, found := arguments[key]; found {
					testingObject.Fatalf("unexpected %s = %#v", key, value)
				}
			}
		})
	}
}

// TestMoveTorrentRestoresRenamedFolderFileAndGroup reapplies resume-only path and
// bandwidth-group state before source removal.
func TestMoveTorrentRestoresRenamedFolderFileAndGroup(testingObject *testing.T) {
	const hash = "aeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeae"
	metainfo := []byte(
		"d4:infod5:filesl" +
			"d6:lengthi1e4:pathl6:folder8:file.txtee" +
			"d6:lengthi1e4:pathl6:folder9:other.txtee" +
			"e4:name4:Rootee",
	)
	snapshot := torrentMoveSnapshotResponse(hash, 1, 0)
	torrent := snapshot["torrents"].([]map[string]any)[0]
	torrent["files"] = []map[string]any{
		{"name": "Archive/Linux/renamed.txt"},
		{"name": "Archive/Linux/other.txt"},
	}
	torrent["fileStats"] = []map[string]any{
		{"wanted": true, "priority": 1},
		{"wanted": false, "priority": 0},
	}
	torrent["group"] = "limited"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return snapshot
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 92, "hashString": hash, "name": "Archive",
				}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: metainfo}

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err != nil || result.Result != "moved" {
		testingObject.Fatalf("renamed move = %+v, %v", result, err)
	}
	targetCalls := fixture.secondFake.recordedCalls()
	setCall := findTransmissionCall(testingObject, targetCalls, "torrent-set")
	if setCall.Arguments["group"] != "limited" {
		testingObject.Fatalf("restored group = %#v", setCall.Arguments["group"])
	}
	renames := []recordedTransmissionCall{}
	for _, call := range targetCalls {
		if call.Method == "torrent-rename-path" {
			renames = append(renames, call)
		}
	}
	if len(renames) != 3 {
		testingObject.Fatalf("rename calls = %+v", renames)
	}
	for index, expected := range []struct {
		path string
		name string
	}{
		{path: "Root", name: "Archive"},
		{path: "Archive/folder", name: "Linux"},
		{path: "Archive/Linux/file.txt", name: "renamed.txt"},
	} {
		assertTransmissionHashID(testingObject, renames[index], hash)
		if renames[index].Arguments["path"] != expected.path ||
			renames[index].Arguments["name"] != expected.name {
			testingObject.Fatalf("rename %d = %#v", index, renames[index].Arguments)
		}
	}
}

func assertTransmissionHashID(
	testingObject *testing.T,
	call recordedTransmissionCall,
	hash string,
) {
	testingObject.Helper()
	ids, found := call.Arguments["ids"].([]any)
	if !found || len(ids) != 1 || ids[0] != hash {
		testingObject.Fatalf("%s ids = %#v, want hash %s", call.Method, call.Arguments["ids"], hash)
	}
}

// TestMoveTorrentUsesMagnetWithoutMetadata avoids a metainfo read for partial magnets.
func TestMoveTorrentUsesMagnetWithoutMetadata(testingObject *testing.T) {
	const hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return torrentMoveSnapshotResponse(hash, 0, 0)
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-added": map[string]any{
					"id": 42, "hashString": hash, "name": "Magnet torrent",
				}}
			}

			return map[string]any{}
		},
	)
	browser := &moveTestDirectoryBrowser{err: errors.New("metainfo should not be read")}
	fixture.server.directoryBrowser = browser

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err != nil || result.Result != "moved" {
		testingObject.Fatalf("magnet move result = %+v, %v", result, err)
	}
	if len(browser.paths) != 0 {
		testingObject.Fatalf("magnet move read metainfo paths %v", browser.paths)
	}
	addCall := findTransmissionCall(testingObject, fixture.secondFake.recordedCalls(), "torrent-add")
	if addCall.Arguments["filename"] != "magnet:?xt=urn:btih:"+hash ||
		addCall.Arguments["metainfo"] != nil {
		testingObject.Fatalf("magnet add arguments = %#v", addCall.Arguments)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-start") {
		testingObject.Fatal("stopped magnet restarted after its move")
	}
	methods := transmissionMethods(fixture.secondFake.recordedCalls())
	if methods[len(methods)-1] != "torrent-stop" {
		testingObject.Fatalf("stopped magnet final target method = %v", methods)
	}
}

// TestMoveTorrentToProfilePreservesIncompleteDataAndRunState covers every storage
// policy and daemon-placement combination used by profile move paths.
func TestMoveTorrentToProfilePreservesIncompleteDataAndRunState(testingObject *testing.T) {
	for _, scenario := range []struct {
		name              string
		complete          bool
		incompleteEnabled bool
		differentDaemon   bool
		wantMoveFiles     bool
	}{
		{name: "incomplete enabled same daemon", incompleteEnabled: true},
		{name: "incomplete enabled different daemon", incompleteEnabled: true, differentDaemon: true},
		{name: "incomplete disabled same daemon", wantMoveFiles: true},
		{name: "incomplete disabled different daemon", differentDaemon: true, wantMoveFiles: true},
		{name: "complete enabled same daemon", complete: true, incompleteEnabled: true, wantMoveFiles: true},
		{name: "complete enabled different daemon", complete: true, incompleteEnabled: true, differentDaemon: true, wantMoveFiles: true},
		{name: "complete disabled same daemon", complete: true, wantMoveFiles: true},
		{name: "complete disabled different daemon", complete: true, differentDaemon: true, wantMoveFiles: true},
	} {
		testingObject.Run(scenario.name, func(testingObject *testing.T) {
			const hash = "bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc"
			percentDone := 0.99
			status := 4
			if scenario.complete {
				percentDone = 1
				status = 6
			}
			snapshot := torrentMoveSnapshotResponse(hash, 1, status)
			snapshot["torrents"].([]map[string]any)[0]["percentDone"] = percentDone
			fixture := newMultiTransmissionFixture(
				testingObject,
				func(call recordedTransmissionCall) any {
					if call.Method == "torrent-get" {
						if isTorrentMoveSnapshotCall(call) {
							return snapshot
						}

						return map[string]any{"torrents": []map[string]any{{
							"downloadDir": "/data/downloads", "hashString": hash,
							"id": 7, "name": "Profile move",
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
							"id": 41, "hashString": hash, "name": "Profile move",
						}}
					}

					return map[string]any{}
				},
			)
			fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("metainfo")}
			if !scenario.incompleteEnabled {
				if _, err := fixture.server.store.UpdateSettings(
					context.Background(),
					fixture.server.registry,
					0,
					storage.SettingChanges{
						"transmission.incompleteDirectoryEnabled": []byte("false"),
					},
					"test",
				); err != nil {
					testingObject.Fatalf("disable incomplete folder: %v", err)
				}
			}
			targetConnectionID := fixture.first.ID
			if scenario.differentDaemon {
				targetConnectionID = fixture.second.ID
			}
			result, err := fixture.server.moveTorrentToProfile(
				context.Background(),
				torrentMoveCandidate{
					Hash:              hash,
					FacadeID:          7,
					Name:              "Profile move",
					ConnectionID:      fixture.first.ID,
					DownloadDirectory: "/data/downloads",
					Status:            int64(status),
					PercentDone:       percentDone,
				},
				targetConnectionID,
				"/data/downloads/profile",
			)
			if err != nil || result.Result != "moved" {
				testingObject.Fatalf("profile move = %+v, %v", result, err)
			}
			targetFake := fixture.firstFake
			if scenario.differentDaemon {
				targetFake = fixture.secondFake
			}
			targetCalls := targetFake.recordedCalls()
			locationCall := findTransmissionCall(testingObject, targetCalls, "torrent-set-location")
			if locationCall.Arguments["move"] != scenario.wantMoveFiles {
				testingObject.Fatalf(
					"torrent-set-location move = %#v, want %t",
					locationCall.Arguments["move"],
					scenario.wantMoveFiles,
				)
			}
			methods := transmissionMethods(targetCalls)
			lastMethods := methods[len(methods)-3:]
			if !reflect.DeepEqual(lastMethods, []string{
				"torrent-set-location", "torrent-verify", "torrent-start",
			}) {
				testingObject.Fatalf("final target methods = %v", methods)
			}
		})
	}
}

// TestMoveTorrentFailedAddLeavesSourceUntouched enforces the pre-removal boundary.
func TestMoveTorrentFailedAddLeavesSourceUntouched(testingObject *testing.T) {
	const hash = "cccccccccccccccccccccccccccccccccccccccc"
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return torrentMoveSnapshotResponse(hash, 1, 4)
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-add" {
				return map[string]any{"torrent-duplicate": map[string]any{
					"id": 43, "hashString": hash, "name": "Existing target",
				}}
			}

			return map[string]any{}
		},
	)
	fixture.server.directoryBrowser = &moveTestDirectoryBrowser{content: []byte("metainfo")}

	result, err := fixture.server.moveTorrent(
		context.Background(),
		hash,
		fixture.first.ID,
		fixture.second.ID,
	)
	if err == nil || result.Result != "failed" {
		testingObject.Fatalf("failed add result = %+v, %v", result, err)
	}
	if methods := transmissionMethods(fixture.firstFake.recordedCalls()); !reflect.DeepEqual(
		methods,
		[]string{"torrent-get", "torrent-get"},
	) {
		testingObject.Fatalf("failed-add source methods = %v", methods)
	}
	if methods := transmissionMethods(fixture.secondFake.recordedCalls()); !reflect.DeepEqual(
		methods,
		[]string{"torrent-get", "torrent-add"},
	) {
		testingObject.Fatalf("failed-add target methods = %v", methods)
	}
}

func torrentMoveSnapshotResponse(
	hash string,
	metadataPercentComplete float64,
	status int,
) map[string]any {
	percentDone := 0.5
	if status == 6 {
		percentDone = 1
	}

	return map[string]any{"torrents": []map[string]any{{
		"id":                      7,
		"name":                    "Moved torrent",
		"hashString":              hash,
		"downloadDir":             "/data/downloads",
		"labels":                  []string{"archive", "linux"},
		"fileStats":               []map[string]any{{"wanted": true, "priority": 1}, {"wanted": false, "priority": 0}, {"wanted": true, "priority": -1}},
		"downloadLimit":           512,
		"downloadLimited":         true,
		"uploadLimit":             256,
		"uploadLimited":           true,
		"honorsSessionLimits":     false,
		"bandwidthPriority":       1,
		"seedRatioLimit":          2.5,
		"seedRatioMode":           1,
		"seedIdleLimit":           30,
		"seedIdleMode":            1,
		"peer-limit":              75,
		"status":                  status,
		"percentDone":             percentDone,
		"magnetLink":              "magnet:?xt=urn:btih:" + hash,
		"metadataPercentComplete": metadataPercentComplete,
	}}}
}
