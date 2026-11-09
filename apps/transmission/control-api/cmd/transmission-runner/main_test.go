package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

const fakeDaemonSessionID = "runner-test-session"

// TestRunnerReconcilesDaemonList verifies independent start, stop, state, and readiness.
func TestRunnerReconcilesDaemonList(testingObject *testing.T) {
	runner, runtimeDirectory, _, eventsPath := prepareRunnerTest(testingObject)
	defaultEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000001",
		Slot:         20,
		PeerPort:     51413,
		Default:      true,
	}
	secondEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000002",
		Slot:         21,
		PeerPort:     51414,
	}
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{
		defaultEntry,
		secondEntry,
	})

	cancel, stopped := startRunnerForTest(runner)
	defer stopRunnerForTest(testingObject, cancel, stopped)

	waitForTest(testingObject, 5*time.Second, func() bool {
		_, markerError := os.Stat(filepath.Join(
			runtimeDirectory,
			"services",
			"transmission.ready",
		))

		return markerError == nil &&
			daemonStateForTest(runtimeDirectory, defaultEntry.ConnectionID).State == "ready" &&
			daemonStateForTest(runtimeDirectory, secondEntry.ConnectionID).State == "ready"
	}, "both Transmission daemons to become ready")

	defaultState := daemonStateForTest(runtimeDirectory, defaultEntry.ConnectionID)
	if defaultState.RPCPort != firstDaemonRPCPort+defaultEntry.Slot ||
		defaultState.BindAddress != "198.18.20.1" ||
		defaultState.PeerPort != defaultEntry.PeerPort ||
		defaultState.Version != "4.0.6" || defaultState.RPCVersion != 18 {
		testingObject.Fatalf("default daemon state = %#v", defaultState)
	}
	marker := readinessMarkerForTest(testingObject, runtimeDirectory)
	if marker.Phase != "daemon" || marker.ConnectionID != defaultEntry.ConnectionID ||
		marker.RPCPort != defaultState.RPCPort {
		testingObject.Fatalf("readiness marker = %#v", marker)
	}

	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{defaultEntry})
	waitForTest(testingObject, 5*time.Second, func() bool {
		_, err := os.Stat(filepath.Join(
			runtimeDirectory,
			"transmission-state",
			secondEntry.ConnectionID+".json",
		))

		return os.IsNotExist(err) && countFakeEvents(eventsPath, secondEntry.ConnectionID, "stop") >= 1
	}, "the removed Transmission daemon to stop")
	if countFakeEvents(eventsPath, defaultEntry.ConnectionID, "start") != 1 {
		testingObject.Fatalf("default daemon start events = %d", countFakeEvents(eventsPath, defaultEntry.ConnectionID, "start"))
	}
	if countFakeEvents(eventsPath, secondEntry.ConnectionID, "start") != 1 {
		testingObject.Fatalf("second daemon start events = %d", countFakeEvents(eventsPath, secondEntry.ConnectionID, "start"))
	}

	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{})
	waitForTest(testingObject, 5*time.Second, func() bool {
		_, markerError := os.Stat(filepath.Join(
			runtimeDirectory,
			"services",
			"transmission.ready",
		))
		_, stateError := os.Stat(filepath.Join(
			runtimeDirectory,
			"transmission-state",
			defaultEntry.ConnectionID+".json",
		))

		return markerError == nil && os.IsNotExist(stateError) &&
			countFakeEvents(eventsPath, defaultEntry.ConnectionID, "stop") >= 1
	}, "no-connections Transmission readiness to be published")
	marker = readinessMarkerForTest(testingObject, runtimeDirectory)
	if marker.Phase != "no-connections" || marker.ConnectionID != "" {
		testingObject.Fatalf("no-connections readiness marker = %#v", marker)
	}
}

// TestRunnerResumesInterruptedLegacyMigration verifies every durable staging step.
func TestRunnerResumesInterruptedLegacyMigration(testingObject *testing.T) {
	entry := daemonEntry{
		ConnectionID: "vpc-0000000000000013",
		Slot:         0,
		PeerPort:     51413,
		Default:      true,
	}
	paths := []string{
		"settings.json",
		filepath.Join("torrents", "existing.torrent"),
		filepath.Join("resume", "existing.resume"),
	}

	for _, testCase := range []struct {
		name        string
		stagedCount int
	}{
		{name: "staging directory only", stagedCount: 0},
		{name: "after first rename", stagedCount: 1},
		{name: "after second rename", stagedCount: 2},
		{name: "fully staged", stagedCount: len(paths)},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			configRoot := testingObject.TempDir()
			stagingRoot := filepath.Join(configRoot, ".slot-zero-migration-crash")
			if err := os.Mkdir(stagingRoot, 0o750); err != nil {
				testingObject.Fatalf("create interrupted migration directory: %v", err)
			}
			for index, relativePath := range paths {
				root := configRoot
				if index < testCase.stagedCount {
					root = stagingRoot
				}
				writeFileForTest(
					testingObject,
					filepath.Join(root, relativePath),
					[]byte(relativePath),
					0o600,
				)
			}

			if err := migrateLegacyConfiguration(configRoot, []daemonEntry{entry}); err != nil {
				testingObject.Fatalf("resume legacy migration: %v", err)
			}
			for _, relativePath := range paths {
				if _, err := os.Stat(filepath.Join(configRoot, entry.ConnectionID, relativePath)); err != nil {
					testingObject.Fatalf("resumed path %s: %v", relativePath, err)
				}
			}
			rootEntries, err := os.ReadDir(configRoot)
			if err != nil {
				testingObject.Fatalf("list migrated root: %v", err)
			}
			for _, rootEntry := range rootEntries {
				if strings.HasPrefix(rootEntry.Name(), ".slot-zero-migration-") {
					testingObject.Fatalf("migration directory remained: %s", rootEntry.Name())
				}
			}
		})
	}
}

// TestRunnerIsolatesLegacyMigrationPermissionFailure keeps sibling daemons running.
func TestRunnerIsolatesLegacyMigrationPermissionFailure(testingObject *testing.T) {
	runner, runtimeDirectory, _, eventsPath := prepareRunnerTest(testingObject)
	var logs synchronizedBuffer
	runner.logger = slog.New(slog.NewTextHandler(&logs, nil))
	runner.migrateLegacy = func(string, []daemonEntry) error { return os.ErrPermission }
	slotZero := daemonEntry{
		ConnectionID: "vpc-0000000000000014",
		Slot:         0,
		PeerPort:     51413,
		Default:      true,
	}
	sibling := daemonEntry{
		ConnectionID: "vpc-0000000000000015",
		Slot:         1,
		PeerPort:     51414,
	}
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{slotZero, sibling})

	cancel, stopped := startRunnerForTest(runner)
	defer stopRunnerForTest(testingObject, cancel, stopped)
	waitForTest(testingObject, 5*time.Second, func() bool {
		failed := daemonStateForTest(runtimeDirectory, slotZero.ConnectionID)

		return failed.State == "exited" &&
			failed.Error == "Couldn't move the existing Transmission files: permission denied" &&
			daemonStateForTest(runtimeDirectory, sibling.ConnectionID).State == "ready"
	}, "slot-zero migration failure and ready sibling")
	time.Sleep(5 * runner.options.WatchInterval)
	if starts := countFakeEvents(eventsPath, sibling.ConnectionID, "start"); starts != 1 {
		testingObject.Fatalf("sibling daemon starts = %d, want 1", starts)
	}
	if count := strings.Count(logs.String(), "Transmission legacy configuration migration failed"); count != 1 {
		testingObject.Fatalf("migration error log count = %d, want 1: %s", count, logs.String())
	}
}

type synchronizedBuffer struct {
	mutex   sync.Mutex
	builder strings.Builder
}

func (buffer *synchronizedBuffer) Write(content []byte) (int, error) {
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	return buffer.builder.Write(content)
}

func (buffer *synchronizedBuffer) String() string {
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	return buffer.builder.String()
}

// TestRunnerMovesLegacyConfiguration verifies slot zero retains today's torrents.
func TestRunnerMovesLegacyConfiguration(testingObject *testing.T) {
	configRoot := testingObject.TempDir()
	writeFileForTest(testingObject, filepath.Join(configRoot, "settings.json"), []byte("{}\n"), 0o600)
	writeFileForTest(testingObject, filepath.Join(configRoot, "stats.json"), []byte("{}\n"), 0o600)
	writeFileForTest(
		testingObject,
		filepath.Join(configRoot, "torrents", "existing.torrent"),
		[]byte("torrent"),
		0o600,
	)
	writeFileForTest(
		testingObject,
		filepath.Join(configRoot, "future-transmission-file"),
		[]byte("preserve me"),
		0o600,
	)

	entry := daemonEntry{
		ConnectionID: "vpc-0000000000000003",
		Slot:         0,
		PeerPort:     51413,
		Default:      true,
	}
	if err := migrateLegacyConfiguration(configRoot, []daemonEntry{entry}); err != nil {
		testingObject.Fatalf("migrate legacy Transmission configuration: %v", err)
	}

	targetRoot := filepath.Join(configRoot, entry.ConnectionID)
	for _, relativePath := range []string{
		"settings.json",
		"stats.json",
		filepath.Join("torrents", "existing.torrent"),
		"future-transmission-file",
	} {
		if _, err := os.Stat(filepath.Join(targetRoot, relativePath)); err != nil {
			testingObject.Fatalf("migrated path %s: %v", relativePath, err)
		}
	}
	if _, err := os.Stat(filepath.Join(configRoot, "settings.json")); !os.IsNotExist(err) {
		testingObject.Fatalf("legacy settings remained at the top level: %v", err)
	}
	if err := migrateLegacyConfiguration(configRoot, []daemonEntry{entry}); err != nil {
		testingObject.Fatalf("repeat legacy migration: %v", err)
	}
}

// TestRunnerMergesSettingsAndReservesRandomPorts verifies daemon-owned overrides.
func TestRunnerMergesSettingsAndReservesRandomPorts(testingObject *testing.T) {
	runner, runtimeDirectory, configRoot, _ := prepareRunnerTest(testingObject)
	writeBaseSettingsForTest(testingObject, runtimeDirectory, true, 52000, 52002)
	runner.randomPort = func(minimum int, _ int) (int, error) { return minimum, nil }

	first := daemonEntry{
		ConnectionID: "vpc-0000000000000004",
		Slot:         30,
		PeerPort:     51413,
		Default:      true,
	}
	second := daemonEntry{
		ConnectionID: "vpc-0000000000000005",
		Slot:         31,
		PeerPort:     51414,
	}
	writeFileForTest(
		testingObject,
		filepath.Join(configRoot, first.ConnectionID, "settings.json"),
		[]byte(`{"custom-setting":"kept","download-dir":"/data/old"}`),
		0o600,
	)

	firstDirectory, firstPort, releaseFirst, err := runner.prepareDaemonSettings(first, "198.18.30.1")
	if err != nil {
		testingObject.Fatalf("prepare first daemon settings: %v", err)
	}
	defer releaseFirst()
	secondDirectory, secondPort, releaseSecond, err := runner.prepareDaemonSettings(second, "198.18.31.1")
	if err != nil {
		testingObject.Fatalf("prepare second daemon settings: %v", err)
	}
	defer releaseSecond()
	if firstPort != 52000 || secondPort != 52001 {
		testingObject.Fatalf("random peer ports = %d and %d, want 52000 and 52001", firstPort, secondPort)
	}

	firstSettings := nativeSettingsForTest(testingObject, filepath.Join(firstDirectory, "settings.json"))
	wantFirst := map[string]any{
		"bind-address-ipv4":          "198.18.30.1",
		"custom-setting":             "kept",
		"download-dir":               "/data/downloads",
		"peer-port":                  float64(52000),
		"peer-port-random-on-start":  false,
		"rpc-bind-address":           "127.0.0.1",
		"rpc-host-whitelist":         "127.0.0.1,localhost",
		"rpc-host-whitelist-enabled": true,
		"rpc-port":                   float64(firstDaemonRPCPort + first.Slot),
	}
	for key, want := range wantFirst {
		if got := firstSettings[key]; !reflect.DeepEqual(got, want) {
			testingObject.Fatalf("first setting %s = %#v, want %#v", key, got, want)
		}
	}
	secondSettings := nativeSettingsForTest(testingObject, filepath.Join(secondDirectory, "settings.json"))
	if secondSettings["peer-port"] != float64(52001) ||
		secondSettings["bind-address-ipv4"] != "198.18.31.1" ||
		secondSettings["rpc-port"] != float64(firstDaemonRPCPort+second.Slot) {
		testingObject.Fatalf("second daemon settings = %#v", secondSettings)
	}
}

// TestRunnerDoesNotRestartOnProviderAddressChange verifies permanent slot binding.
func TestRunnerDoesNotRestartOnProviderAddressChange(testingObject *testing.T) {
	runner, runtimeDirectory, _, eventsPath := prepareRunnerTest(testingObject)
	entry := daemonEntry{
		ConnectionID: "vpc-0000000000000006",
		Slot:         40,
		PeerPort:     51413,
		Default:      true,
	}
	writeVPNStatusForTest(testingObject, runtimeDirectory, entry, "protected", "10.61.0.2")
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{entry})

	cancel, stopped := startRunnerForTest(runner)
	defer stopRunnerForTest(testingObject, cancel, stopped)
	waitForTest(testingObject, 5*time.Second, func() bool {
		state := daemonStateForTest(runtimeDirectory, entry.ConnectionID)

		return state.State == "ready" && state.BindAddress == "198.18.40.1"
	}, "the protected daemon to become ready")

	writeVPNStatusForTest(testingObject, runtimeDirectory, entry, "reconnecting", "")
	time.Sleep(5 * runner.options.WatchInterval)
	state := daemonStateForTest(runtimeDirectory, entry.ConnectionID)
	if countFakeEvents(eventsPath, entry.ConnectionID, "start") != 1 ||
		state.State != "ready" || state.BindAddress != "198.18.40.1" {
		testingObject.Fatalf(
			"provider-address change restarted daemon: starts=%d state=%#v",
			countFakeEvents(eventsPath, entry.ConnectionID, "start"),
			state,
		)
	}
}

// TestRunnerDoesNotRestartForDefaultOrIgnoredPeerPort verifies settings relevance.
func TestRunnerDoesNotRestartForDefaultOrIgnoredPeerPort(testingObject *testing.T) {
	runner, runtimeDirectory, _, eventsPath := prepareRunnerTest(testingObject)
	writeBaseSettingsForTest(testingObject, runtimeDirectory, true, 52000, 52010)
	first := daemonEntry{
		ConnectionID: "vpc-0000000000000016",
		Slot:         42,
		PeerPort:     51413,
		Default:      true,
	}
	second := daemonEntry{
		ConnectionID: "vpc-0000000000000017",
		Slot:         43,
		PeerPort:     51414,
	}
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{first, second})

	cancel, stopped := startRunnerForTest(runner)
	defer stopRunnerForTest(testingObject, cancel, stopped)
	waitForTest(testingObject, 5*time.Second, func() bool {
		return daemonStateForTest(runtimeDirectory, first.ConnectionID).State == "ready" &&
			daemonStateForTest(runtimeDirectory, second.ConnectionID).State == "ready"
	}, "both random-port daemons to become ready")

	first.Default = false
	first.PeerPort = 53000
	second.Default = true
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{first, second})
	waitForTest(testingObject, 5*time.Second, func() bool {
		return readinessMarkerForTest(testingObject, runtimeDirectory).ConnectionID == second.ConnectionID
	}, "readiness to follow the new default")
	time.Sleep(5 * runner.options.WatchInterval)
	for _, connectionID := range []string{first.ConnectionID, second.ConnectionID} {
		if starts := countFakeEvents(eventsPath, connectionID, "start"); starts != 1 {
			testingObject.Fatalf("daemon %s starts = %d, want 1", connectionID, starts)
		}
	}
}

// TestRunnerIsolatesRepeatedDaemonFailures verifies one child cannot stop a sibling.
func TestRunnerIsolatesRepeatedDaemonFailures(testingObject *testing.T) {
	runner, runtimeDirectory, _, eventsPath := prepareRunnerTest(testingObject)
	defaultEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000007",
		Slot:         50,
		PeerPort:     51413,
		Default:      true,
	}
	failingEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000008",
		Slot:         51,
		PeerPort:     51414,
	}
	testingObject.Setenv("TVPN_RUNNER_FAKE_FAIL_CONNECTION", failingEntry.ConnectionID)
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{
		defaultEntry,
		failingEntry,
	})

	cancel, stopped := startRunnerForTest(runner)
	defer stopRunnerForTest(testingObject, cancel, stopped)
	waitForTest(testingObject, 5*time.Second, func() bool {
		return daemonStateForTest(runtimeDirectory, defaultEntry.ConnectionID).State == "ready" &&
			countFakeEvents(eventsPath, failingEntry.ConnectionID, "start") >= 2
	}, "one failing daemon to restart beside a ready sibling")
	if countFakeEvents(eventsPath, defaultEntry.ConnectionID, "start") != 1 {
		testingObject.Fatalf(
			"ready sibling restarted %d times",
			countFakeEvents(eventsPath, defaultEntry.ConnectionID, "start"),
		)
	}
}

// TestWaitForDaemonEventIgnoresExternalState observes only process lifecycle.
func TestWaitForDaemonEventIgnoresExternalState(testingObject *testing.T) {
	exited := make(chan error, 1)
	exited <- errors.New("test exit")
	event, err, stable := waitForDaemonEvent(context.Background(), exited, time.Second)
	if event != daemonEventExited || err == nil || stable {
		testingObject.Fatalf("daemon event = %v, %v, stable=%t", event, err, stable)
	}
}

// TestWaitForDaemonEventResetsBackoffOnlyAfterStableReadiness covers crash loops.
func TestWaitForDaemonEventResetsBackoffOnlyAfterStableReadiness(testingObject *testing.T) {
	exited := make(chan error, 1)
	time.AfterFunc(40*time.Millisecond, func() { exited <- errors.New("test exit") })
	event, err, stable := waitForDaemonEvent(context.Background(), exited, 10*time.Millisecond)
	if event != daemonEventExited || err == nil || !stable {
		testingObject.Fatalf("stable daemon event = %v, %v, stable=%t", event, err, stable)
	}
}

// TestReadinessMarkerCannotBeRecreatedByStaleSiblingState serializes marker writes.
func TestReadinessMarkerCannotBeRecreatedByStaleSiblingState(testingObject *testing.T) {
	runner, runtimeDirectory, _, _ := prepareRunnerTest(testingObject)
	defaultID := "vpc-0000000000000018"
	runner.defaultID = defaultID
	runner.states[defaultID] = daemonState{
		ConnectionID: defaultID,
		State:        "ready",
		RPCPort:      firstDaemonRPCPort,
	}

	writeStarted := make(chan struct{})
	releaseWrite := make(chan struct{})
	var blockOnce sync.Once
	runner.writeReady = func(path string, state daemonState) error {
		blockOnce.Do(func() {
			close(writeStarted)
			<-releaseWrite
		})

		return writeReadinessMarker(path, state)
	}

	siblingDone := make(chan struct{})
	go func() {
		defer close(siblingDone)
		runner.publishDaemonState(daemonState{
			ConnectionID: "vpc-0000000000000019",
			State:        "ready",
			RPCPort:      firstDaemonRPCPort + 1,
		})
	}()
	<-writeStarted

	defaultDone := make(chan struct{})
	go func() {
		defer close(defaultDone)
		runner.publishExitedState(daemonEntry{
			ConnectionID: defaultID,
			Slot:         0,
			PeerPort:     51413,
			Default:      true,
		}, "198.18.0.1", 51413)
	}()
	close(releaseWrite)
	<-siblingDone
	<-defaultDone

	if _, err := os.Stat(filepath.Join(runtimeDirectory, "services", "transmission.ready")); !os.IsNotExist(err) {
		testingObject.Fatalf("stale readiness marker remained: %v", err)
	}
}

// TestRandomPeerPortsSkipContainerListeners protects every published and RPC port.
func TestRandomPeerPortsSkipContainerListeners(testingObject *testing.T) {
	runner, _, _, _ := prepareRunnerTest(testingObject)
	runner.randomPort = func(minimum int, _ int) (int, error) { return minimum, nil }

	for _, testCase := range []struct {
		name    string
		minimum int
		maximum int
		want    int
	}{
		{name: "rpc range", minimum: 9091, maximum: 9156, want: 9156},
		{name: "control API", minimum: 22602, maximum: 22603, want: 22603},
		{name: "web proxy", minimum: 22605, maximum: 22606, want: 22606},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			port, release, err := runner.reserveRandomPeerPort(
				"vpc-0000000000000020",
				testCase.minimum,
				testCase.maximum,
			)
			if err != nil || port != testCase.want {
				testingObject.Fatalf("reserved port = %d, %v, want %d", port, err, testCase.want)
			}
			release()
		})
	}

	if _, _, err := runner.reserveRandomPeerPort(
		"vpc-0000000000000021",
		9091,
		9155,
	); err == nil {
		testingObject.Fatal("reserved-only random range was accepted")
	}
}

// TestFakeTransmissionDaemonProcess is executed by the runner through a tiny wrapper.
func TestFakeTransmissionDaemonProcess(testingObject *testing.T) {
	if os.Getenv("TVPN_RUNNER_FAKE_DAEMON") != "1" {
		return
	}

	configDirectory := argumentValue(os.Args, "--config-dir")
	settings := nativeSettingsForFake(filepath.Join(configDirectory, "settings.json"))
	rpcPort := int(settings["rpc-port"].(float64))
	connectionID := filepath.Base(configDirectory)
	appendFakeEvent(os.Getenv("TVPN_RUNNER_FAKE_EVENTS"), connectionID, "start", rpcPort)
	if os.Getenv("TVPN_RUNNER_FAKE_FAIL_CONNECTION") == connectionID {
		return
	}

	listener, err := net.Listen("tcp4", "127.0.0.1:"+strconv.Itoa(rpcPort))
	if err != nil {
		panic(err)
	}
	server := &http.Server{Handler: http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		if request.Header.Get("X-Transmission-Session-Id") != fakeDaemonSessionID {
			responseWriter.Header().Set("X-Transmission-Session-Id", fakeDaemonSessionID)
			responseWriter.WriteHeader(http.StatusConflict)

			return
		}
		_, _ = io.Copy(io.Discard, request.Body)
		_ = json.NewEncoder(responseWriter).Encode(map[string]any{
			"arguments": map[string]any{
				"rpc-version":        18,
				"rpc-version-semver": "5.3.0",
				"version":            "4.0.6",
			},
			"result": "success",
		})
	})}
	serveDone := make(chan struct{})
	go func() {
		defer close(serveDone)
		_ = server.Serve(listener)
	}()

	stopping := make(chan os.Signal, 1)
	signal.Notify(stopping, syscall.SIGINT, syscall.SIGTERM)
	<-stopping
	signal.Stop(stopping)
	_ = server.Close()
	<-serveDone
	appendFakeEvent(os.Getenv("TVPN_RUNNER_FAKE_EVENTS"), connectionID, "stop", rpcPort)
}

type readinessMarker struct {
	ConnectionID string `json:"connectionId"`
	Phase        string `json:"phase"`
	RPCPort      int    `json:"rpcPort"`
}

type fakeDaemonEvent struct {
	ConnectionID string `json:"connectionId"`
	Event        string `json:"event"`
	RPCPort      int    `json:"rpcPort"`
}

func prepareRunnerTest(testingObject *testing.T) (*runner, string, string, string) {
	testingObject.Helper()
	root := testingObject.TempDir()
	runtimeDirectory := filepath.Join(root, "run")
	configRoot := filepath.Join(root, "config")
	for _, path := range []string{
		configRoot,
		filepath.Join(runtimeDirectory, "services"),
		filepath.Join(runtimeDirectory, "transmission-config"),
		filepath.Join(runtimeDirectory, "transmission-state"),
		filepath.Join(runtimeDirectory, "vpn.status.d"),
	} {
		if err := os.MkdirAll(path, 0o750); err != nil {
			testingObject.Fatalf("create runner test directory: %v", err)
		}
	}
	writeBaseSettingsForTest(testingObject, runtimeDirectory, false, 49152, 65535)

	eventsPath := filepath.Join(root, "fake-daemon-events.jsonl")
	wrapperPath := filepath.Join(root, "fake-transmission-daemon")
	wrapper := "#!/bin/sh\nexec \"" + os.Args[0] + "\" -test.run '^TestFakeTransmissionDaemonProcess$' -- \"$@\"\n"
	writeFileForTest(testingObject, wrapperPath, []byte(wrapper), 0o755)
	testingObject.Setenv("TVPN_RUNNER_FAKE_DAEMON", "1")
	testingObject.Setenv("TVPN_RUNNER_FAKE_EVENTS", eventsPath)

	configuredRunner := newRunner(options{
		BackoffResetAfter: 100 * time.Millisecond,
		ConfigDirectory:   configRoot,
		DaemonPath:        wrapperPath,
		ReadinessTimeout:  3 * time.Second,
		RestartBackoff:    20 * time.Millisecond,
		RuntimeDirectory:  runtimeDirectory,
		WatchInterval:     20 * time.Millisecond,
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	configuredRunner.makeDirectory = func(string, os.FileMode) error { return nil }

	return configuredRunner, runtimeDirectory, configRoot, eventsPath
}

func startRunnerForTest(configuredRunner *runner) (context.CancelFunc, <-chan error) {
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan error, 1)
	go func() {
		stopped <- configuredRunner.run(ctx)
	}()

	return cancel, stopped
}

func stopRunnerForTest(
	testingObject *testing.T,
	cancel context.CancelFunc,
	stopped <-chan error,
) {
	testingObject.Helper()
	cancel()
	select {
	case err := <-stopped:
		if err != nil {
			testingObject.Errorf("stop runner: %v", err)
		}
	case <-time.After(7 * time.Second):
		testingObject.Error("runner did not stop")
	}
}

func writeBaseSettingsForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	random bool,
	minimum int,
	maximum int,
) {
	testingObject.Helper()
	content, err := json.Marshal(map[string]any{
		"download-dir":                "/data/downloads",
		"incomplete-dir":              "/data/incomplete",
		"incomplete-dir-enabled":      false,
		"peer-port-random-high":       maximum,
		"peer-port-random-low":        minimum,
		"peer-port-random-on-start":   random,
		"rpc-authentication-required": false,
		"rpc-whitelist-enabled":       true,
	})
	if err != nil {
		testingObject.Fatalf("encode base settings: %v", err)
	}
	writeFileForTest(
		testingObject,
		filepath.Join(runtimeDirectory, "transmission-config", "settings-base.json"),
		content,
		0o640,
	)
}

func writeDaemonEntriesForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	entries []daemonEntry,
) {
	testingObject.Helper()
	content, err := json.Marshal(entries)
	if err != nil {
		testingObject.Fatalf("encode daemon entries: %v", err)
	}
	path := filepath.Join(runtimeDirectory, "transmission-config", "daemons.json")
	temporaryPath := path + ".new"
	writeFileForTest(testingObject, temporaryPath, content, 0o640)
	if err := os.Rename(temporaryPath, path); err != nil {
		testingObject.Fatalf("publish daemon entries: %v", err)
	}
}

func writeVPNStatusForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	entry daemonEntry,
	state string,
	address string,
) {
	testingObject.Helper()
	content, err := json.Marshal(map[string]any{
		"connectionId": entry.ConnectionID,
		"slot":         entry.Slot,
		"default":      entry.Default,
		"state":        state,
		"address":      address,
	})
	if err != nil {
		testingObject.Fatalf("encode VPN status: %v", err)
	}
	writeFileForTest(
		testingObject,
		filepath.Join(runtimeDirectory, "vpn.status.d", entry.ConnectionID+".json"),
		content,
		0o644,
	)
}

func daemonStateForTest(runtimeDirectory string, connectionID string) daemonState {
	content, err := os.ReadFile(filepath.Join(
		runtimeDirectory,
		"transmission-state",
		connectionID+".json",
	))
	if err != nil {
		return daemonState{}
	}
	var state daemonState
	if json.Unmarshal(content, &state) != nil {
		return daemonState{}
	}

	return state
}

func readinessMarkerForTest(
	testingObject *testing.T,
	runtimeDirectory string,
) readinessMarker {
	testingObject.Helper()
	content, err := os.ReadFile(filepath.Join(runtimeDirectory, "services", "transmission.ready"))
	if err != nil {
		testingObject.Fatalf("read readiness marker: %v", err)
	}
	var marker readinessMarker
	if err := json.Unmarshal(content, &marker); err != nil {
		testingObject.Fatalf("decode readiness marker: %v", err)
	}

	return marker
}

func nativeSettingsForTest(testingObject *testing.T, path string) map[string]any {
	testingObject.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read native settings: %v", err)
	}
	settings := map[string]any{}
	if err := json.Unmarshal(content, &settings); err != nil {
		testingObject.Fatalf("decode native settings: %v", err)
	}

	return settings
}

func nativeSettingsForFake(path string) map[string]any {
	content, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	settings := map[string]any{}
	if err := json.Unmarshal(content, &settings); err != nil {
		panic(err)
	}

	return settings
}

func appendFakeEvent(path string, connectionID string, event string, rpcPort int) {
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		panic(err)
	}
	content, err := json.Marshal(fakeDaemonEvent{
		ConnectionID: connectionID,
		Event:        event,
		RPCPort:      rpcPort,
	})
	if err != nil {
		panic(err)
	}
	content = append(content, '\n')
	if _, err := file.Write(content); err != nil {
		panic(err)
	}
	if err := file.Close(); err != nil {
		panic(err)
	}
}

func countFakeEvents(path string, connectionID string, event string) int {
	file, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer file.Close()

	count := 0
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var recorded fakeDaemonEvent
		if json.Unmarshal(scanner.Bytes(), &recorded) == nil &&
			recorded.ConnectionID == connectionID && recorded.Event == event {
			count++
		}
	}

	return count
}

func waitForTest(
	testingObject *testing.T,
	timeout time.Duration,
	condition func() bool,
	description string,
) {
	testingObject.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	testingObject.Fatalf("timed out waiting for %s", description)
}

func writeFileForTest(
	testingObject *testing.T,
	path string,
	content []byte,
	mode os.FileMode,
) {
	testingObject.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		testingObject.Fatalf("create parent directory for %s: %v", path, err)
	}
	if err := os.WriteFile(path, content, mode); err != nil {
		testingObject.Fatalf("write %s: %v", path, err)
	}
}

func argumentValue(arguments []string, name string) string {
	for index := 0; index < len(arguments)-1; index++ {
		if arguments[index] == name {
			return strings.TrimSpace(arguments[index+1])
		}
	}
	panic(fmt.Sprintf("argument %s is missing", name))
}
