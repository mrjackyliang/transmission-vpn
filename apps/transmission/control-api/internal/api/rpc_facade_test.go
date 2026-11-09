package api

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// TestRPCFacadeTorrentAddRequiresVPNConnection gives compatible clients setup guidance.
func TestRPCFacadeTorrentAddRequiresVPNConnection(t *testing.T) {
	server, _, _ := newClaimedTestServer(t)

	_, result := server.callRPCFacade(context.Background(), "torrent-add", map[string]any{
		"filename": "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	})
	if result != "Add a VPN connection before adding torrents." {
		t.Fatalf("torrent-add result = %q", result)
	}
}

// TestRPCFacadeTorrentGetMergesDaemons covers object/table output and removed IDs.
func TestRPCFacadeTorrentGetMergesDaemons(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "session-get":
				return map[string]any{"rpc-version": 17}
			case "torrent-get":
				return map[string]any{
					"torrents": []map[string]any{{"id": 7, "name": "First"}},
					"removed":  []int64{8},
				}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "session-get":
				return map[string]any{"rpc-version": 17}
			case "torrent-get":
				return map[string]any{
					"torrents": []map[string]any{{"id": 9, "name": "Second"}},
					"removed":  []int64{10},
				}
			}

			return map[string]any{}
		},
	)
	secondID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 9)
	secondRemoved, _ := transmissionrpc.FacadeID(fixture.second.Slot, 10)

	arguments, result := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    "recently-active",
	})
	if result != "success" {
		t.Fatalf("torrent-get result = %q", result)
	}
	response := arguments.(map[string]any)
	torrents := response["torrents"].([]map[string]any)
	if len(torrents) != 2 || torrents[0]["id"] != int64(7) || torrents[1]["id"] != secondID {
		t.Fatalf("merged torrents = %#v", torrents)
	}
	if !reflect.DeepEqual(response["removed"], []int64{8, secondRemoved}) {
		t.Fatalf("merged removed = %#v", response["removed"])
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	_, selectedResult := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    []any{float64(7), float64(secondID)},
	})
	if selectedResult != "success" {
		t.Fatalf("selected torrent-get result = %q", selectedResult)
	}
	firstSelection := findTransmissionCall(t, fixture.firstFake.recordedCalls(), "torrent-get")
	secondSelection := findTransmissionCall(t, fixture.secondFake.recordedCalls(), "torrent-get")
	if !reflect.DeepEqual(firstSelection.Arguments["ids"], []any{float64(7)}) ||
		!reflect.DeepEqual(secondSelection.Arguments["ids"], []any{float64(9)}) {
		t.Fatalf(
			"torrent-get routed IDs = %#v / %#v",
			firstSelection.Arguments["ids"],
			secondSelection.Arguments["ids"],
		)
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	_, bareIDResult := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    float64(7),
	})
	if bareIDResult != "success" {
		t.Fatalf("bare integer torrent-get result = %q", bareIDResult)
	}
	bareIDCall := findTransmissionCall(t, fixture.firstFake.recordedCalls(), "torrent-get")
	if !reflect.DeepEqual(bareIDCall.Arguments["ids"], []any{float64(7)}) {
		t.Fatalf("bare integer routed IDs = %#v", bareIDCall.Arguments["ids"])
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	_, hashResult := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    []any{firstTestHash},
	})
	if hashResult != "success" {
		t.Fatalf("hash torrent-get result = %q", hashResult)
	}
	for _, fake := range []*fakeTransmissionDaemon{fixture.firstFake, fixture.secondFake} {
		selection := findTransmissionCall(t, fake.recordedCalls(), "torrent-get")
		if !reflect.DeepEqual(selection.Arguments["ids"], []any{firstTestHash}) {
			t.Fatalf("torrent-get hash IDs = %#v", selection.Arguments["ids"])
		}
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	_, bareHashResult := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    firstTestHash,
	})
	if bareHashResult != "success" {
		t.Fatalf("bare hash torrent-get result = %q", bareHashResult)
	}
	for _, fake := range []*fakeTransmissionDaemon{fixture.firstFake, fixture.secondFake} {
		selection := findTransmissionCall(t, fake.recordedCalls(), "torrent-get")
		if !reflect.DeepEqual(selection.Arguments["ids"], []any{firstTestHash}) {
			t.Fatalf("bare hash torrent-get IDs = %#v", selection.Arguments["ids"])
		}
	}

	tableArguments, tableResult := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"format": "table",
	})
	if tableResult != "success" {
		t.Fatalf("table torrent-get result = %q", tableResult)
	}
	table := tableArguments.(map[string]any)["torrents"].([][]any)
	if len(table) != 3 || !reflect.DeepEqual(table[0], []any{"id", "name"}) || table[2][0] != secondID {
		t.Fatalf("table torrents = %#v", table)
	}
}

// TestRPCFacadeRoutesEveryTorrentMutation splits facade IDs for the full method group.
func TestRPCFacadeRoutesEveryTorrentMutation(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{"id": 7}}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{"id": 9}}}
			}

			return map[string]any{}
		},
	)
	secondID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 9)
	methods := []string{
		"torrent-set", "torrent-start", "torrent-start-now", "torrent-stop",
		"torrent-verify", "torrent-reannounce", "torrent-remove",
		"torrent-rename-path", "queue-move-top",
		"queue-move-up", "queue-move-down", "queue-move-bottom",
	}
	for _, method := range methods {
		fixture.firstFake.clearCalls()
		fixture.secondFake.clearCalls()
		_, result := fixture.server.callRPCFacade(context.Background(), method, map[string]any{
			"ids": []any{float64(7), float64(secondID)},
		})
		if result != "success" {
			t.Fatalf("%s result = %q", method, result)
		}
		first := findTransmissionCall(t, fixture.firstFake.recordedCalls(), method)
		second := findTransmissionCall(t, fixture.secondFake.recordedCalls(), method)
		if !reflect.DeepEqual(first.Arguments["ids"], []any{float64(7)}) ||
			!reflect.DeepEqual(second.Arguments["ids"], []any{float64(9)}) {
			t.Fatalf("%s routed IDs = %#v / %#v", method, first.Arguments["ids"], second.Arguments["ids"])
		}
	}
	if _, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-set-location",
		map[string]any{"ids": []any{float64(7)}, "location": "/data/other"},
	); result != "Change the torrent's profile in the console to move it." {
		t.Fatalf("torrent-set-location result = %q", result)
	}
}

// TestRPCFacadeSkipsUnknownSelectionsAndUsesAnsweringDaemons matches Transmission.
func TestRPCFacadeSkipsUnknownSelectionsAndUsesAnsweringDaemons(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 7, "hashString": firstTestHash, "name": "First",
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
	missingSlotID, _ := transmissionrpc.FacadeID(63, 5)
	arguments, result := fixture.server.callRPCFacade(context.Background(), "torrent-get", map[string]any{
		"fields": []any{"id", "name"},
		"ids":    missingSlotID,
	})
	if result != "success" || len(arguments.(map[string]any)["torrents"].([]map[string]any)) != 0 {
		t.Fatalf("unknown torrent-get = %#v, %q", arguments, result)
	}

	fixture.firstFake.clearCalls()
	_, result = fixture.server.callRPCFacade(context.Background(), "torrent-start", map[string]any{
		"ids": []any{float64(7), float64(missingSlotID)},
	})
	if result != "success" {
		t.Fatalf("mixed known/unknown mutation result = %q", result)
	}
	start := findTransmissionCall(t, fixture.firstFake.recordedCalls(), "torrent-start")
	if !reflect.DeepEqual(start.Arguments["ids"], []any{float64(7)}) {
		t.Fatalf("known mutation IDs = %#v", start.Arguments["ids"])
	}

	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	_, result = fixture.server.callRPCFacade(context.Background(), "torrent-remove", map[string]any{
		"ids": []any{secondTestHash},
	})
	if result != "success" {
		t.Fatalf("already-gone hash removal result = %q", result)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-remove") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-remove") {
		t.Fatal("already-gone hash removal was forwarded")
	}

	fixture.secondFake.server.Close()
	fixture.firstFake.clearCalls()
	_, result = fixture.server.callRPCFacade(context.Background(), "torrent-stop", map[string]any{
		"ids": []any{firstTestHash},
	})
	if result != "success" || !containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-stop") {
		t.Fatalf("partial answering hash mutation result = %q, calls = %v", result, transmissionMethods(fixture.firstFake.recordedCalls()))
	}
}

// TestRPCFacadeRenameReturnsTheFacadeID preserves the public identifier namespace.
func TestRPCFacadeRenameReturnsTheFacadeID(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{"id": 9}}}
			}
			if call.Method == "torrent-rename-path" {
				return map[string]any{"id": 9, "path": "new"}
			}

			return map[string]any{}
		},
	)
	secondID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 9)
	arguments, result := fixture.server.callRPCFacade(context.Background(), "torrent-rename-path", map[string]any{
		"ids":  []any{float64(secondID)},
		"path": "old",
		"name": "new",
	})
	if result != "success" || arguments.(map[string]any)["id"] != secondID {
		t.Fatalf("rename response = %#v, %q", arguments, result)
	}
}

// TestRPCFacadeSessionMethodGroups covers every session-level routing group.
//
// It verifies summed, default, and broadcast calls plus the merger-owned update wait,
// including the guarantee that native daemons never receive blocklist-update.
//
// Since: UNRELEASED
func TestRPCFacadeSessionMethodGroups(t *testing.T) {
	responder := func(identity string) func(recordedTransmissionCall) any {
		return func(call recordedTransmissionCall) any {
			switch call.Method {
			case "session-stats":
				return map[string]any{"activeTorrentCount": 2, "downloadSpeed": 3}
			case "session-get", "free-space", "port-test", "group-get":
				return map[string]any{"source": identity}
			}

			return map[string]any{}
		}
	}
	fixture := newMultiTransmissionFixture(t, responder("default"), responder("secondary"))

	statistics, result := fixture.server.callRPCFacade(context.Background(), "session-stats", map[string]any{})
	if result != "success" || statistics.(map[string]any)["activeTorrentCount"] != float64(4) {
		t.Fatalf("summed statistics = %#v, %q", statistics, result)
	}
	for _, method := range []string{"session-get", "free-space", "port-test", "group-get"} {
		arguments, callResult := fixture.server.callRPCFacade(context.Background(), method, map[string]any{})
		if callResult != "success" || arguments.(map[string]any)["source"] != "default" {
			t.Fatalf("%s = %#v, %q", method, arguments, callResult)
		}
	}
	for _, method := range []string{"session-set", "group-set"} {
		fixture.firstFake.clearCalls()
		fixture.secondFake.clearCalls()
		callArguments := map[string]any{"test": true}
		if method == "session-set" {
			callArguments = map[string]any{"speed-limit-down": 100}
		}
		arguments, callResult := fixture.server.callRPCFacade(context.Background(), method, callArguments)
		if callResult != "success" || !containsTransmissionMethod(fixture.firstFake.recordedCalls(), method) ||
			!containsTransmissionMethod(fixture.secondFake.recordedCalls(), method) {
			t.Fatalf("%s = %#v, %q", method, arguments, callResult)
		}
	}

	setBlocklistSettingsForTest(
		t,
		fixture.server,
		true,
		[]string{"https://blocklist.example/list"},
		24,
	)
	fixture.server.blocklistPollInterval = time.Millisecond
	fixture.server.blocklistUpdateTimeout = time.Second
	fixture.firstFake.clearCalls()
	fixture.secondFake.clearCalls()
	statusWritten := make(chan error, 1)
	go func() {
		configurationPath := filepath.Join(
			fixture.server.runtimeDirectory,
			"transmission-config",
			blocklist.ConfigurationFileName,
		)
		deadline := time.Now().Add(time.Second)
		for time.Now().Before(deadline) {
			configuration, err := blocklist.ReadConfiguration(configurationPath)
			if err == nil && configuration.UpdateRequestedAt != nil {
				attemptedAt := configuration.UpdateRequestedAt.UTC()
				statusWritten <- blocklist.WriteJSON(filepath.Join(
					fixture.server.runtimeDirectory,
					"transmission-state",
					blocklist.StatusFileName,
				), blocklist.Status{
					State:         "idle",
					LastAttemptAt: &attemptedAt,
					LastSuccessAt: &attemptedAt,
					TotalRanges:   10,
					Sources: []blocklist.SourceStatus{{
						URL: "https://blocklist.example/list", State: "ok", Ranges: 10,
						UpdatedAt: &attemptedAt,
					}},
				}, 0o640)

				return
			}
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				statusWritten <- err

				return
			}
			time.Sleep(time.Millisecond)
		}
		statusWritten <- fmt.Errorf("blocklist request marker was not published")
	}()
	arguments, callResult := fixture.server.callRPCFacade(
		context.Background(),
		"blocklist-update",
		map[string]any{},
	)
	if err := <-statusWritten; err != nil {
		t.Fatalf("write facade blocklist status: %v", err)
	}
	if callResult != "success" || arguments.(map[string]any)["blocklist-size"] != 10 {
		t.Fatalf("blocklist facade = %#v, %q", arguments, callResult)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "blocklist-update") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "blocklist-update") {
		t.Fatal("blocklist-update was forwarded to a native daemon")
	}
	if _, refused := fixture.server.callRPCFacade(context.Background(), "session-close", map[string]any{}); !stringsContains(refused, "not supported") {
		t.Fatalf("session-close result = %q", refused)
	}
	if _, unsupported := fixture.server.callRPCFacade(context.Background(), "torrent-start-all", map[string]any{}); unsupported != rpcUnsupportedMethodResult {
		t.Fatalf("unsupported result = %q", unsupported)
	}
}

// TestRPCFacadeRejectsScriptsAndConfinesEveryFolderArgument protects the container.
func TestRPCFacadeRejectsScriptsAndConfinesEveryFolderArgument(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)

	for _, test := range []struct {
		name      string
		arguments map[string]any
	}{
		{
			name:      "kebab script key",
			arguments: map[string]any{"script-torrent-done-enabled": true},
		},
		{
			name:      "underscore script key",
			arguments: map[string]any{"script_torrent_done_filename": "/tmp/run"},
		},
		{
			name:      "camel script key",
			arguments: map[string]any{"scriptTorrentDoneFilename": "/tmp/run"},
		},
		{
			name:      "runner peer port",
			arguments: map[string]any{"peer_port": 51415},
		},
		{
			name:      "runner random peer port",
			arguments: map[string]any{"peerPortRandomOnStart": true},
		},
		{
			name:      "runner port forwarding",
			arguments: map[string]any{"port-forwarding-enabled": true},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			fixture.firstFake.clearCalls()
			fixture.secondFake.clearCalls()
			if _, result := fixture.server.callRPCFacade(
				context.Background(),
				"session-set",
				test.arguments,
			); !stringsContains(result, "not supported for session-set") {
				t.Fatalf("unsafe session-set result = %q", result)
			}
			if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "session-set") ||
				containsTransmissionMethod(fixture.secondFake.recordedCalls(), "session-set") {
				t.Fatal("unsafe session-set reached Transmission")
			}
		})
	}

	for _, test := range []struct {
		name      string
		method    string
		arguments map[string]any
	}{
		{name: "kebab download directory", method: "session-set", arguments: map[string]any{"download-dir": "/etc"}},
		{name: "underscore download directory", method: "session-set", arguments: map[string]any{"download_dir": "/etc"}},
		{name: "camel download directory", method: "session-set", arguments: map[string]any{"downloadDir": "/etc"}},
		{name: "underscore incomplete folder", method: "session-set", arguments: map[string]any{"incomplete_dir": "/tmp"}},
		{name: "mixed case torrent location", method: "torrent-set", arguments: map[string]any{"Location": "/config"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, result := fixture.server.callRPCFacade(
				context.Background(),
				test.method,
				test.arguments,
			); !stringsContains(result, "beneath /data") {
				t.Fatalf("%s outside path result = %q", test.method, result)
			}
		})
	}

	for _, test := range []struct {
		name      string
		method    string
		arguments map[string]any
	}{
		{name: "session download root", method: "session-set", arguments: map[string]any{"download-dir": "/data"}},
		{name: "session incomplete root", method: "session-set", arguments: map[string]any{"incomplete-dir": "/data"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, result := fixture.server.callRPCFacade(
				context.Background(),
				test.method,
				test.arguments,
			); result != "Choose a folder inside /data, not /data itself." {
				t.Fatalf("%s root result = %q", test.method, result)
			}
		})
	}

	fixture.firstFake.clearCalls()
	if _, result := fixture.server.callRPCFacade(context.Background(), "session-set", map[string]any{
		"speed-limit-down": 100,
		"speed_limit_down": 200,
	}); !stringsContains(result, "duplicate Transmission RPC argument speed-limit-down") {
		t.Fatalf("duplicate session-set result = %q", result)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "session-set") {
		t.Fatal("duplicate session-set reached Transmission")
	}

	for _, test := range []struct {
		name  string
		key   string
		value int
	}{
		{name: "kebab allowed key", key: "speed-limit-down", value: 100},
		{name: "underscore allowed key", key: "speed_limit_down", value: 200},
	} {
		t.Run(test.name, func(t *testing.T) {
			fixture.firstFake.clearCalls()
			if _, result := fixture.server.callRPCFacade(context.Background(), "session-set", map[string]any{
				test.key: test.value,
			}); result != "success" {
				t.Fatalf("allowed session-set result = %q", result)
			}
			call := findTransmissionCall(t, fixture.firstFake.recordedCalls(), "session-set")
			value, valid := integerValue(call.Arguments["speed-limit-down"])
			if !valid || value != int64(test.value) {
				t.Fatalf("allowed session-set arguments = %#v", call.Arguments)
			}
		})
	}

	fixture.firstFake.clearCalls()
	if _, result := fixture.server.callRPCFacade(context.Background(), "session-set", map[string]any{
		"downloadDir":    "/data/tv/",
		"incomplete_dir": "/data/incomplete/",
		"seedRatioLimit": 2.5,
	}); result != "success" {
		t.Fatalf("normalized session-set result = %q", result)
	}
	sessionSet := findTransmissionCall(t, fixture.firstFake.recordedCalls(), "session-set")
	if sessionSet.Arguments["download-dir"] != "/data/tv" ||
		sessionSet.Arguments["incomplete-dir"] != "/data/incomplete" ||
		sessionSet.Arguments["seed_ratio_limit"] != 2.5 {
		t.Fatalf("normalized session paths = %#v", sessionSet.Arguments)
	}

	for _, method := range []string{"torrent-set"} {
		fixture.firstFake.clearCalls()
		if _, result := fixture.server.callRPCFacade(context.Background(), method, map[string]any{
			"Location": "/data/tv/",
		}); result != "success" {
			t.Fatalf("normalized %s result = %q", method, result)
		}
		call := findTransmissionCall(t, fixture.firstFake.recordedCalls(), method)
		if call.Arguments["location"] != "/data/tv" {
			t.Fatalf("normalized %s location = %#v", method, call.Arguments)
		}
	}

	const incompleteMessage = "Choose a folder outside the incomplete folder, /data/incomplete."
	for _, test := range []struct {
		name      string
		method    string
		arguments map[string]any
	}{
		{
			name:      "torrent set incomplete location",
			method:    "torrent-set",
			arguments: map[string]any{"location": "/data/incomplete/set"},
		},
		{
			name:      "session Download directory incomplete folder",
			method:    "session-set",
			arguments: map[string]any{"download-dir": "/data/incomplete/session"},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			fixture.firstFake.clearCalls()
			fixture.secondFake.clearCalls()
			if _, result := fixture.server.callRPCFacade(
				context.Background(),
				test.method,
				test.arguments,
			); result != incompleteMessage {
				t.Fatalf("%s incomplete result = %q", test.method, result)
			}
			if len(fixture.firstFake.recordedCalls()) > 0 ||
				len(fixture.secondFake.recordedCalls()) > 0 {
				t.Fatal("reserved path reached Transmission")
			}
		})
	}

	_, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Films",
			DownloadDirectory: "/data/media/films",
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
		t.Fatalf("create reverse-check profile: %v", err)
	}
	for _, test := range []struct {
		name           string
		incompletePath string
		want           string
	}{
		{
			name:           "Download setting",
			incompletePath: "/data/downloads",
			want:           "“downloads” is the Default profile's folder, so it can't be the incomplete folder.",
		},
		{
			name:           "profile folder",
			incompletePath: "/data/media",
			want:           "Use a folder outside /data/media/films. Torrents in the Films profile finish there.",
		},
	} {
		t.Run("session incomplete contains "+test.name, func(t *testing.T) {
			fixture.firstFake.clearCalls()
			fixture.secondFake.clearCalls()
			_, result := fixture.server.callRPCFacade(
				context.Background(),
				"session-set",
				map[string]any{"incomplete-dir": test.incompletePath},
			)
			if result != test.want {
				t.Fatalf("incomplete-dir result = %q, want %q", result, test.want)
			}
			if len(fixture.firstFake.recordedCalls()) > 0 ||
				len(fixture.secondFake.recordedCalls()) > 0 {
				t.Fatal("clashing incomplete folder reached Transmission")
			}
		})
	}
}

// TestRPCFacadeDefaultProfileAddNamesEffectiveDownloadDirectory checks remote apps.
//
// An unmatched add now sends the setting-backed Default profile folder explicitly,
// so a daemon waiting for restart cannot fall back to its old settings.json value.
//
// Since: UNRELEASED
func TestRPCFacadeDefaultProfileAddNamesEffectiveDownloadDirectory(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 7, "hashString": firstTestHash, "name": "Unmatched",
				}}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
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
	defaultProfile, err := fixture.server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Labels = []string{"Remote default"}
	defaultProfile.StartPaused = true
	defaultProfile.Options.PeerLimit = 72
	if _, err := fixture.server.store.UpdateDefaultTorrentProfile(
		context.Background(),
		defaultProfile,
	); err != nil {
		testingObject.Fatalf("update Default profile: %v", err)
	}

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Unmatched",
		},
	)
	if result != "success" {
		testingObject.Fatalf("unmatched torrent-add result = %q", result)
	}
	call := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-add",
	)
	if call.Arguments["download-dir"] != "/data/default-profile" {
		testingObject.Fatalf("unmatched torrent-add arguments = %#v", call.Arguments)
	}
	if !reflect.DeepEqual(call.Arguments["labels"], []any{"Remote default"}) ||
		call.Arguments["paused"] != true {
		testingObject.Fatalf("Default profile remote defaults = %#v", call.Arguments)
	}
	optionsCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-set",
	)
	if peerLimit, valid := integerValue(optionsCall.Arguments["peer-limit"]); !valid || peerLimit != 72 {
		testingObject.Fatalf("Default profile remote options = %#v", optionsCall.Arguments)
	}
}

// TestRPCFacadeTorrentAddSavesLabels persists labels supplied by remote applications.
//
// The organization revision advances with the newly used label so open consoles can
// refresh their saved-label choices.
func TestRPCFacadeTorrentAddSavesLabels(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 7, "hashString": firstTestHash, "name": "Remote labeled",
				}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	defaultProfile, err := fixture.server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Labels = []string{"Profile label"}
	if _, err := fixture.server.store.UpdateDefaultTorrentProfile(
		context.Background(),
		defaultProfile,
	); err != nil {
		testingObject.Fatalf("update Default profile labels: %v", err)
	}

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Remote+labeled",
			"labels":   []any{"Remote new"},
		},
	)
	if result != "success" {
		testingObject.Fatalf("torrent-add result = %q", result)
	}
	addCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-add",
	)
	if !reflect.DeepEqual(addCall.Arguments["labels"], []any{"Remote new", "Profile label"}) {
		testingObject.Fatalf("merged remote labels = %#v", addCall.Arguments["labels"])
	}
	organization, err := fixture.server.store.TorrentOrganization(context.Background())
	if err != nil {
		testingObject.Fatalf("read organization: %v", err)
	}
	if organization.Revision != 2 || !reflect.DeepEqual(
		organization.Labels,
		[]string{"Profile label", "Remote new"},
	) {
		testingObject.Fatalf("organization after RPC add = %+v", organization)
	}
}

// TestRPCFacadeTorrentAddProfilePrecedence keeps folder and label matches ahead of
// pattern matching.
func TestRPCFacadeTorrentAddProfilePrecedence(testingObject *testing.T) {
	first := storage.TorrentProfile{
		ID:                "tpr-0000000000000001",
		Name:              "Movies",
		DownloadDirectory: "/data/movies",
		Labels:            []string{"Cinema"},
		MatchPatterns:     []string{"Release*"},
	}
	second := storage.TorrentProfile{
		ID:                "tpr-0000000000000002",
		Name:              "Series",
		DownloadDirectory: "/data/series",
		Labels:            []string{"TV"},
		MatchPatterns:     []string{"Episode*"},
	}
	defaultProfile := storage.TorrentProfile{
		Name:              "Default",
		DownloadDirectory: "/data/downloads",
		Labels:            []string{"Default tag"},
	}
	profiles := []storage.TorrentProfile{first, second}

	for _, testCase := range []struct {
		name        string
		arguments   map[string]any
		torrentName string
		wantID      string
		wantNamed   bool
	}{
		{
			name: "folder before labels and pattern",
			arguments: map[string]any{
				"download-dir": "/data/SERIES/",
				"labels":       []string{"Cinema"},
			},
			torrentName: "Release one",
			wantID:      second.ID,
			wantNamed:   true,
		},
		{
			name:        "profile name label",
			arguments:   map[string]any{"labels": []string{"movies"}},
			torrentName: "Episode one",
			wantID:      first.ID,
			wantNamed:   true,
		},
		{
			name:        "profile tag label",
			arguments:   map[string]any{"labels": []string{"tv"}},
			torrentName: "Release one",
			wantID:      second.ID,
			wantNamed:   true,
		},
		{
			name:        "renamed Default profile label",
			arguments:   map[string]any{"labels": []string{"default"}},
			torrentName: "Unmatched",
		},
		{
			name:        "Default profile tag label",
			arguments:   map[string]any{"labels": []string{"default TAG"}},
			torrentName: "Release one",
		},
		{
			name:        "single matching pattern",
			arguments:   map[string]any{},
			torrentName: "Release one",
			wantID:      first.ID,
			wantNamed:   true,
		},
		{
			name:        "Default fallback",
			arguments:   map[string]any{},
			torrentName: "Unmatched",
		},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			selection := rpcTorrentAddProfile(
				testCase.arguments,
				testCase.torrentName,
				profiles,
				defaultProfile,
			)
			if selection.Profile.ID != testCase.wantID || selection.Named != testCase.wantNamed {
				testingObject.Fatalf("matched profile = %+v, named %t", selection.Profile, selection.Named)
			}
		})
	}
}

// TestRPCFacadeProfileFallbackRejectsIncompleteFolder protects compatible matching.
//
// Lenient stored profiles may predate the current rule, but a matching remote-app
// add still refuses their reserved destination before calling Transmission.
//
// Since: UNRELEASED
func TestRPCFacadeProfileFallbackRejectsIncompleteFolder(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any { return map[string]any{} },
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	_, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Legacy profile",
			DownloadDirectory: "/data/incomplete/profile",
			Labels:            []string{},
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 50,
				Queue:     "normal",
			},
			MatchPatterns: []string{"Legacy*"},
		},
	)
	if err != nil {
		testingObject.Fatalf("create legacy profile: %v", err)
	}

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Legacy+release",
		},
	)
	if result != "Choose a folder outside the incomplete folder, /data/incomplete." {
		testingObject.Fatalf("legacy profile torrent-add result = %q", result)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatal("legacy profile add reached Transmission")
	}
}

// TestRPCFacadeTorrentAddMatchesProfile uses the guarded cross-daemon add path.
func TestRPCFacadeTorrentAddMatchesProfile(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 9, "hashString": secondTestHash, "name": "Second release",
				}}
			}

			return map[string]any{}
		},
	)
	profile, err := fixture.server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
		ID:                newTorrentProfileID(),
		Name:              "Second connection",
		DownloadDirectory: "/data/profile",
		Labels:            []string{"profile"},
		StartPaused:       true,
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 60,
			Queue:     "normal",
		},
		MatchPatterns: []string{"Second*"},
		ConnectionID:  &fixture.second.ID,
	})
	if err != nil {
		t.Fatalf("create matching profile: %v", err)
	}

	arguments, result := fixture.server.callRPCFacade(context.Background(), "torrent-add", map[string]any{
		"filename":     "magnet:?xt=urn:btih:" + secondTestHash + "&dn=Second+release",
		"download-dir": "/data/client/",
		"labels":       []any{"client"},
	})
	if result != "success" {
		t.Fatalf("torrent-add result = %q", result)
	}
	secondID, _ := transmissionrpc.FacadeID(fixture.second.Slot, 9)
	added := arguments.(map[string]any)["torrent-added"].(map[string]any)
	if added["id"] != secondID {
		t.Fatalf("torrent-add response = %#v", arguments)
	}
	addCall := findTransmissionCall(t, fixture.secondFake.recordedCalls(), "torrent-add")
	if !reflect.DeepEqual(addCall.Arguments["labels"], []any{"client", "profile"}) ||
		addCall.Arguments["download-dir"] != "/data/profile" ||
		addCall.Arguments["paused"] != true {
		t.Fatalf("profile/client add arguments = %#v", addCall.Arguments)
	}
	profileCall := findTransmissionCall(t, fixture.secondFake.recordedCalls(), "torrent-set")
	if profileCall.Arguments["peer-limit"] != float64(profile.Options.PeerLimit) ||
		profileCall.Arguments["labels"] != nil {
		t.Fatalf("profile option arguments = %#v", profileCall.Arguments)
	}
	assignments, err := fixture.server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || len(assignments) != 1 || assignments[secondTestHash] != profile.ID {
		t.Fatalf("profile assignments = %#v, %v", assignments, err)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "session-get") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-start") {
		t.Fatalf("magnet add follow-up calls = %#v", fixture.secondFake.recordedCalls())
	}
}

// TestRPCFacadeTorrentAddNeedsProfile keeps an overlapping pattern add on Default,
// paused, durable, and visible to notification destinations without failing the
// remote application's ordinary torrent-added request.
func TestRPCFacadeTorrentAddNeedsProfile(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 23, "hashString": firstTestHash, "name": "Shared release",
				}}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
	)
	sender := newFakeSender(fixture.server)
	createTestNotification(
		testingObject,
		fixture.server,
		fixture.cookies,
		fixture.csrfToken,
		`{"name":"Profile choices","service":"ntfy","events":["profile-choice-needed"],"settings":{"url":"https://ntfy.sh/profile-choices"}}`,
	)

	profiles := make([]storage.TorrentProfile, 0, 2)
	for _, input := range []struct {
		name       string
		pattern    string
		connection *string
	}{
		{name: "Beta", pattern: "*release", connection: &fixture.second.ID},
		{name: "Alpha", pattern: "Shared*", connection: &fixture.second.ID},
	} {
		profile, err := fixture.server.store.CreateTorrentProfile(
			context.Background(),
			storage.TorrentProfile{
				ID:                newTorrentProfileID(),
				Name:              input.name,
				DownloadDirectory: "/data/" + strings.ToLower(input.name),
				Labels:            []string{input.name},
				Options: storage.TorrentProfileOptions{
					Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
					PeerLimit: 50,
					Queue:     "normal",
				},
				MatchPatterns: []string{input.pattern},
				ConnectionID:  input.connection,
			},
		)
		if err != nil {
			testingObject.Fatalf("create %s profile: %v", input.name, err)
		}
		profiles = append(profiles, profile)
	}
	defaultProfile, err := fixture.server.defaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}

	response, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Shared+release",
		},
	)
	if result != "success" {
		testingObject.Fatalf("overlapping torrent-add result = %q", result)
	}
	added := response.(map[string]any)["torrent-added"].(map[string]any)
	if added["hashString"] != firstTestHash || added["name"] != "Shared release" {
		testingObject.Fatalf("overlapping torrent-add response = %#v", response)
	}
	addCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-add",
	)
	if addCall.Arguments["paused"] != true ||
		addCall.Arguments["download-dir"] != defaultProfile.DownloadDirectory {
		testingObject.Fatalf("overlapping torrent-add arguments = %#v", addCall.Arguments)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-start") ||
		containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		testingObject.Fatalf(
			"overlapping torrent-add calls = first %#v, second %#v",
			fixture.firstFake.recordedCalls(),
			fixture.secondFake.recordedCalls(),
		)
	}

	assignments, err := fixture.server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || len(assignments) != 0 {
		testingObject.Fatalf("overlapping profile assignments = %#v, %v", assignments, err)
	}
	needs, err := fixture.server.store.ListTorrentNeedsProfiles(context.Background())
	if err != nil {
		testingObject.Fatalf("list pending profile choices: %v", err)
	}
	wantProfileIDs := []string{profiles[1].ID, profiles[0].ID}
	if !reflect.DeepEqual(needs[firstTestHash], wantProfileIDs) {
		testingObject.Fatalf("pending profile choices = %#v, want %#v", needs, wantProfileIDs)
	}

	fixture.server.notifier.sends.Wait()
	sends := sender.recorded()
	if len(sends) != 1 || sends[0].Notification.Event != "profile-choice-needed" ||
		!strings.Contains(sends[0].Notification.Message, "Shared release") ||
		!strings.Contains(sends[0].Notification.Message, "Alpha, Beta") ||
		!strings.Contains(sends[0].Notification.Message, "Resolve it in the web UI") {
		testingObject.Fatalf("profile choice notification = %#v", sends)
	}
}

// TestRPCFacadeTorrentAddExplicitEmptyLabelsStillApplyProfileLabels preserves profiles.
func TestRPCFacadeTorrentAddExplicitEmptyLabelsStillApplyProfileLabels(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"id": 17, "hashString": firstTestHash, "name": "Empty labels",
				}}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
	)
	if _, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Empty labels profile",
			DownloadDirectory: "/data/empty-labels",
			Labels:            []string{"Inherited"},
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 50,
				Queue:     "normal",
			},
			MatchPatterns: []string{"Empty*"},
			ConnectionID:  &fixture.first.ID,
		},
	); err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Empty+labels",
			"labels":   []any{},
		},
	)
	if result != "success" {
		testingObject.Fatalf("empty-label add result = %q", result)
	}
	addCall := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-add",
	)
	if !reflect.DeepEqual(addCall.Arguments["labels"], []any{"Inherited"}) {
		testingObject.Fatalf("empty-label add arguments = %#v", addCall.Arguments)
	}
}

// TestRPCFacadeTorrentAddStartsAfterProfileOptions verifies remote follow-up order.
//
// A matched profile supplies its start preference, then its options and queue move
// finish before the newly added URL torrent is allowed to start.
func TestRPCFacadeTorrentAddStartsAfterProfileOptions(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
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
					"id":         37,
					"name":       "Profiled remote release",
				}}
			default:
				return map[string]any{}
			}
		},
	)
	profile, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Remote start profile",
			DownloadDirectory: "/data/profile",
			Labels:            []string{"profile"},
			StartPaused:       false,
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 60,
				Queue:     "top",
			},
			MatchPatterns: []string{"Profiled*"},
			ConnectionID:  &fixture.second.ID,
		},
	)
	if err != nil {
		testingObject.Fatalf("create remote start profile: %v", err)
	}

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{"filename": "https://example.test/Profiled-release.torrent"},
	)
	if result != "success" {
		testingObject.Fatalf("profiled URL torrent-add result = %q", result)
	}

	calls := fixture.secondFake.recordedCalls()
	wantMethods := []string{
		"torrent-get",
		"torrent-add",
		"torrent-set",
		"queue-move-top",
		"torrent-start",
	}
	if methods := transmissionMethods(calls); !reflect.DeepEqual(methods, wantMethods) {
		testingObject.Fatalf("profiled URL methods = %v, want %v", methods, wantMethods)
	}
	if calls[1].Arguments["paused"] != true {
		testingObject.Fatalf("profiled URL add arguments = %#v", calls[1].Arguments)
	}
	if !reflect.DeepEqual(calls[1].Arguments["labels"], []any{"profile"}) {
		testingObject.Fatalf("profiled URL labels = %#v", calls[1].Arguments)
	}
	assertSingleLocalID(testingObject, calls, "torrent-start", 37)
	if containsTransmissionMethod(calls, "session-get") {
		testingObject.Fatalf("profiled URL queried the session: %#v", calls)
	}

	assignments, err := fixture.server.store.ListTorrentProfileAssignments(context.Background())
	if err != nil || assignments[secondTestHash] != profile.ID {
		testingObject.Fatalf("profiled URL assignments = %#v, %v", assignments, err)
	}
}

// TestRPCFacadeTorrentAddURLStartPreference verifies every remote URL start decision.
//
// Unknown hashes are always added paused, while an explicit paused value or the
// selected profile's start preference decides whether the torrent starts afterward.
func TestRPCFacadeTorrentAddURLStartPreference(testingObject *testing.T) {
	tests := []struct {
		name          string
		arguments     map[string]any
		sessionStarts bool
		wantSession   bool
		wantStart     bool
	}{
		{
			name: "paused false",
			arguments: map[string]any{
				"filename": "https://example.test/start.torrent",
				"paused":   false,
			},
			wantStart: true,
		},
		{
			name: "paused true",
			arguments: map[string]any{
				"filename": "https://example.test/stay-paused.torrent",
				"paused":   true,
			},
		},
		{
			name: "Default profile starts added torrents",
			arguments: map[string]any{
				"filename": "https://example.test/session-start.torrent",
			},
			wantStart: true,
		},
		{
			name: "Default profile ignores session pause",
			arguments: map[string]any{
				"filename": "https://example.test/session-pause.torrent",
			},
			wantStart: true,
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			fixture := newMultiTransmissionFixture(
				testingObject,
				func(call recordedTransmissionCall) any {
					switch call.Method {
					case "torrent-get":
						return map[string]any{"torrents": []map[string]any{}}
					case "session-get":
						return map[string]any{"start-added-torrents": test.sessionStarts}
					case "torrent-add":
						return map[string]any{"torrent-added": map[string]any{
							"hashString": firstTestHash,
							"id":         33,
							"name":       "Remote URL preference",
						}}
					default:
						return map[string]any{}
					}
				},
				func(call recordedTransmissionCall) any {
					if call.Method == "torrent-get" {
						return map[string]any{"torrents": []map[string]any{}}
					}

					return map[string]any{}
				},
			)

			arguments, result := fixture.server.callRPCFacade(
				context.Background(),
				"torrent-add",
				test.arguments,
			)
			if result != "success" {
				testingObject.Fatalf("URL torrent-add result = %q", result)
			}
			added := arguments.(map[string]any)["torrent-added"].(map[string]any)
			if added["hashString"] != firstTestHash {
				testingObject.Fatalf("URL torrent-add response = %#v", arguments)
			}

			calls := fixture.firstFake.recordedCalls()
			addCall := findTransmissionCall(testingObject, calls, "torrent-add")
			if addCall.Arguments["paused"] != true {
				testingObject.Fatalf("URL torrent-add arguments = %#v", addCall.Arguments)
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
				assertSingleLocalID(testingObject, calls, "torrent-start", 33)
			} else if containsTransmissionMethod(calls, "torrent-start") {
				testingObject.Fatalf("paused URL add was started: %#v", calls)
			}
			if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") ||
				containsTransmissionMethod(fixture.secondFake.recordedCalls(), "session-get") ||
				containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-start") {
				testingObject.Fatalf(
					"URL add reached the secondary daemon: %#v",
					fixture.secondFake.recordedCalls(),
				)
			}
		})
	}
}

// TestRPCFacadeTorrentAddRemovesCrossDaemonURLDuplicate covers the post-add check.
//
// A profile-routed URL is added paused, removed without data when its returned hash
// exists elsewhere, and reported with the existing torrent's facade identity.
func TestRPCFacadeTorrentAddRemovesCrossDaemonURLDuplicate(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": firstTestHash,
					"id":         4,
					"name":       "Existing remote torrent",
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
					"hashString": firstTestHash,
					"id":         34,
					"name":       "Downloaded duplicate metadata",
				}}
			default:
				return map[string]any{}
			}
		},
	)
	if _, err := fixture.server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Remote duplicate target",
			DownloadDirectory: "/data/secondary",
			Labels:            []string{},
			StartPaused:       false,
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 50,
				Queue:     "normal",
			},
			MatchPatterns: []string{"Duplicate*"},
			ConnectionID:  &fixture.second.ID,
		},
	); err != nil {
		testingObject.Fatalf("create URL duplicate profile: %v", err)
	}

	arguments, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{"filename": "https://example.test/Duplicate-release.torrent"},
	)
	if result != "success" {
		testingObject.Fatalf("URL duplicate torrent-add result = %q", result)
	}
	duplicate := arguments.(map[string]any)["torrent-duplicate"].(map[string]any)
	if duplicate["id"] != int64(4) || duplicate["hashString"] != firstTestHash ||
		duplicate["name"] != "Existing remote torrent" {
		testingObject.Fatalf("URL duplicate response = %#v", arguments)
	}

	calls := fixture.secondFake.recordedCalls()
	addCall := findTransmissionCall(testingObject, calls, "torrent-add")
	if addCall.Arguments["paused"] != true {
		testingObject.Fatalf("URL duplicate add arguments = %#v", addCall.Arguments)
	}
	removeCall := findTransmissionCall(testingObject, calls, "torrent-remove")
	if !reflect.DeepEqual(removeCall.Arguments["ids"], []any{float64(34)}) ||
		removeCall.Arguments["delete-local-data"] != false {
		testingObject.Fatalf("URL duplicate remove arguments = %#v", removeCall.Arguments)
	}
	if containsTransmissionMethod(calls, "torrent-start") {
		testingObject.Fatalf("URL duplicate was started: %#v", calls)
	}
}

// TestRPCFacadeTorrentAddLeavesDaemonURLDuplicateStopped covers native duplicates.
//
// Forcing the add request paused does not change or start a torrent that the target
// daemon reports as already present.
func TestRPCFacadeTorrentAddLeavesDaemonURLDuplicateStopped(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				fields, _ := rpcStringList(call.Arguments["fields"])
				if reflect.DeepEqual(fields, []string{"labels"}) {
					return map[string]any{"torrents": []map[string]any{{
						"labels": []string{"existing"},
					}}}
				}

				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-duplicate": map[string]any{
					"hashString": firstTestHash,
					"id":         35,
					"name":       "Existing daemon torrent",
				}}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
	)
	defaultProfile, err := fixture.server.store.DefaultTorrentProfile(context.Background())
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Labels = []string{"profile"}
	if _, err := fixture.server.store.UpdateDefaultTorrentProfile(
		context.Background(),
		defaultProfile,
	); err != nil {
		testingObject.Fatalf("update Default profile labels: %v", err)
	}

	arguments, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "https://example.test/daemon-duplicate.torrent",
			"labels":   []any{"remote-test"},
			"paused":   false,
		},
	)
	if result != "success" {
		testingObject.Fatalf("daemon duplicate torrent-add result = %q", result)
	}
	duplicate := arguments.(map[string]any)["torrent-duplicate"].(map[string]any)
	if duplicate["id"] != int64(35) || duplicate["hashString"] != firstTestHash {
		testingObject.Fatalf("daemon duplicate response = %#v", arguments)
	}
	calls := fixture.firstFake.recordedCalls()
	addCall := findTransmissionCall(testingObject, calls, "torrent-add")
	if addCall.Arguments["paused"] != true || containsTransmissionMethod(calls, "torrent-start") {
		testingObject.Fatalf("daemon duplicate calls = %#v", calls)
	}
	setCall := findTransmissionCall(testingObject, calls, "torrent-set")
	if !reflect.DeepEqual(
		setCall.Arguments["labels"],
		[]any{"existing", "remote-test", "profile"},
	) {
		testingObject.Fatalf("daemon duplicate labels = %#v", setCall.Arguments)
	}
}

// TestRPCFacadeTorrentAddStartFailureUsesProfileErrorContract covers RPC errors.
//
// A rejected deferred start is returned through the same native result contract as
// a rejected profile option or queue move.
func TestRPCFacadeTorrentAddStartFailureUsesProfileErrorContract(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				return map[string]any{"torrent-added": map[string]any{
					"hashString": firstTestHash,
					"id":         36,
					"name":       "Rejected remote start",
				}}
			case "torrent-start":
				return fakeTransmissionResponse{Result: "start rejected"}
			default:
				return map[string]any{}
			}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
	)

	_, result := fixture.server.callRPCFacade(
		context.Background(),
		"torrent-add",
		map[string]any{
			"filename": "https://example.test/rejected-start.torrent",
			"paused":   false,
		},
	)
	if result != "start rejected" {
		testingObject.Fatalf("rejected remote start result = %q", result)
	}
}

// TestRPCFacadeTorrentAddFindsCrossDaemonDuplicate never forwards a duplicate add.
func TestRPCFacadeTorrentAddFindsCrossDaemonDuplicate(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 4, "hashString": firstTestHash, "name": "Existing",
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
	if _, err := fixture.server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
		ID:                newTorrentProfileID(),
		Name:              "Secondary duplicate target",
		DownloadDirectory: "/data/secondary",
		Labels:            []string{},
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
		MatchPatterns: []string{"Duplicate*"},
		ConnectionID:  &fixture.second.ID,
	}); err != nil {
		t.Fatalf("create duplicate target profile: %v", err)
	}

	arguments, result := fixture.server.callRPCFacade(context.Background(), "torrent-add", map[string]any{
		"filename": "magnet:?xt=urn:btih:" + firstTestHash + "&dn=Duplicate+release",
	})
	if result != "success" {
		t.Fatalf("duplicate torrent-add result = %q", result)
	}
	duplicate := arguments.(map[string]any)["torrent-duplicate"].(map[string]any)
	if duplicate["id"] != int64(4) || duplicate["hashString"] != firstTestHash {
		t.Fatalf("duplicate response = %#v", arguments)
	}
	if containsTransmissionMethod(fixture.secondFake.recordedCalls(), "torrent-add") {
		t.Fatal("cross-daemon duplicate was forwarded to the selected connection")
	}
}

// TestRPCFacadeTorrentAddWaitsForEveryEnabledDaemon applies readiness to known hashes.
func TestRPCFacadeTorrentAddWaitsForEveryEnabledDaemon(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{}}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any { return map[string]any{} },
	)
	fixture.secondFake.server.Close()
	_, result := fixture.server.callRPCFacade(context.Background(), "torrent-add", map[string]any{
		"filename": "magnet:?xt=urn:btih:" + firstTestHash,
	})
	if result != "Transmission for Secondary is still starting" {
		t.Fatalf("known add readiness result = %q", result)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") {
		t.Fatal("known compatible add reached Transmission before readiness")
	}
}

func stringsContains(value string, substring string) bool {
	for index := 0; index+len(substring) <= len(value); index++ {
		if value[index:index+len(substring)] == substring {
			return true
		}
	}

	return false
}
