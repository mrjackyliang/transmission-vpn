package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"syscall"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const firstDaemonRPCPort = 9092

var connectionIDPattern = regexp.MustCompile(`^vpc-[0-9a-f]{16}$`)

// daemonEntry is one connection declaration published by the control API.
type daemonEntry struct {
	ConnectionID string `json:"connectionId"`
	Slot         int    `json:"slot"`
	PeerPort     int    `json:"peerPort"`
	Default      bool   `json:"default"`
}

// daemonState is one runner-owned daemon lifecycle record.
type daemonState struct {
	ConnectionID string    `json:"connectionId"`
	State        string    `json:"state"`
	Error        string    `json:"error,omitempty"`
	RPCPort      int       `json:"rpcPort"`
	BindAddress  string    `json:"bindAddress"`
	PeerPort     int       `json:"peerPort"`
	Version      string    `json:"version"`
	RPCVersion   int       `json:"rpcVersion"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// managedDaemon owns one connection supervisor's cancellation and completion.
type managedDaemon struct {
	entry  daemonEntry
	cancel context.CancelFunc
	done   chan struct{}
}

// daemonProcess tracks one started child through RPC readiness and reload requests.
//
// A process remains unsignalable until its client answers; a blocklist replacement in
// that window sets ReloadPending so readiness delivers exactly one deferred SIGHUP.
//
// Since: UNRELEASED
type daemonProcess struct {
	Entry            daemonEntry
	ProcessID        int
	PeerPort         int
	Client           transmissionrpc.Caller
	Ready            bool
	ReloadPending    bool
	BlocklistEnabled bool
}

// runner reconciles the API's complete daemon list with independent supervisors.
//
// It also owns the blocklist merger and child process identities needed to reload all
// running daemons after one atomic merged update.
//
// Since: UNRELEASED
type runner struct {
	options options
	logger  *slog.Logger

	daemons map[string]*managedDaemon

	stateMutex sync.Mutex
	states     map[string]daemonState
	defaultID  string

	peerPortMutex sync.Mutex
	peerPortOwner map[int]string
	randomPort    func(int, int) (int, error)
	makeDirectory func(string, os.FileMode) error
	migrateLegacy func(string, []daemonEntry) error
	writeReady    func(string, daemonState) error
	writeEmpty    func(string) error

	lastMigrationError string

	processMutex           sync.Mutex
	processes              map[string]*daemonProcess
	reloadRevision         uint64
	reloadBlocklistEnabled bool
	reloadMutex            sync.Mutex
	signalProcess          func(int) error
	blocklists             *blocklistMerger
}

// newRunner prepares an empty reconciler with production random-port selection.
//
// Child signaling and the merger's network seams remain replaceable by focused tests,
// while production uses direct SIGHUP delivery to each supervised process.
//
// Since: UNRELEASED
func newRunner(configuredOptions options, logger *slog.Logger) *runner {
	configuredRunner := &runner{
		options:       configuredOptions,
		logger:        logger,
		daemons:       map[string]*managedDaemon{},
		states:        map[string]daemonState{},
		peerPortOwner: map[int]string{},
		randomPort:    secureRandomPort,
		makeDirectory: os.MkdirAll,
		migrateLegacy: migrateLegacyConfiguration,
		writeReady:    writeReadinessMarker,
		writeEmpty:    writeNoConnectionsMarker,
		processes:     map[string]*daemonProcess{},
		signalProcess: func(processID int) error {
			return syscall.Kill(processID, syscall.SIGHUP)
		},
	}
	configuredRunner.blocklists = newBlocklistMerger(configuredRunner, logger)

	return configuredRunner
}

// run polls atomically replaced configuration and reconciles daemon ownership.
//
// The blocklist manager shares this lifecycle and must finish cancellation before
// the runner returns, preventing background writes after supervisor shutdown.
//
// Since: UNRELEASED
func (runner *runner) run(ctx context.Context) error {
	configurationPath := filepath.Join(
		runner.options.RuntimeDirectory,
		"transmission-config",
		"daemons.json",
	)
	ticker := time.NewTicker(runner.options.WatchInterval)
	defer ticker.Stop()
	defer os.Remove(runner.readinessMarkerPath())
	blocklistDone := make(chan struct{})
	go func() {
		defer close(blocklistDone)
		runner.blocklists.run(ctx, runner.options.WatchInterval)
	}()
	defer func() { <-blocklistDone }()

	lastError := ""
	for {
		entries, err := readDaemonEntries(configurationPath)
		if err == nil {
			err = runner.reconcile(ctx, entries)
		}
		if err != nil {
			if err.Error() != lastError {
				runner.logger.Error("Transmission daemon list is unavailable", "error", err)
				lastError = err.Error()
			}
		} else {
			lastError = ""
		}

		select {
		case <-ctx.Done():
			runner.stopAll()

			return nil
		case <-ticker.C:
		}
	}
}

// reconcile starts new declarations, restarts changed ones, and stops removed ones.
func (runner *runner) reconcile(ctx context.Context, entries []daemonEntry) error {
	desired := make(map[string]daemonEntry, len(entries))
	defaultID := ""
	var slotZero *daemonEntry
	for _, entry := range entries {
		desired[entry.ConnectionID] = entry
		if entry.Default {
			defaultID = entry.ConnectionID
		}
		if entry.Slot == 0 {
			entryCopy := entry
			slotZero = &entryCopy
		}
	}
	runner.setDefaultID(defaultID)

	randomPeerPorts, err := runner.randomPeerPortsEnabled()
	if err != nil {
		return err
	}
	migrationError := runner.migrateLegacy(runner.options.ConfigDirectory, entries)
	migrationFailedID := ""
	if migrationError != nil && slotZero != nil {
		migrationFailedID = slotZero.ConnectionID
	}

	stopIDs := make([]string, 0)
	for connectionID, daemon := range runner.daemons {
		entry, found := desired[connectionID]
		peerPortChanged := entry.PeerPort != daemon.entry.PeerPort && !randomPeerPorts
		if !found || connectionID == migrationFailedID || entry.Slot != daemon.entry.Slot ||
			peerPortChanged {
			stopIDs = append(stopIDs, connectionID)
		} else {
			daemon.entry.Default = entry.Default
		}
	}
	sort.Strings(stopIDs)
	for _, connectionID := range stopIDs {
		runner.stopDaemon(connectionID, true)
	}
	if migrationError != nil && slotZero != nil {
		runner.publishMigrationFailure(*slotZero, migrationError)
	} else {
		runner.lastMigrationError = ""
	}

	for _, entry := range entries {
		if entry.ConnectionID == migrationFailedID {
			continue
		}
		if _, found := runner.daemons[entry.ConnectionID]; found {
			continue
		}

		daemonContext, cancelDaemon := context.WithCancel(ctx)
		daemon := &managedDaemon{
			entry:  entry,
			cancel: cancelDaemon,
			done:   make(chan struct{}),
		}
		runner.daemons[entry.ConnectionID] = daemon
		go func() {
			defer close(daemon.done)
			runner.superviseDaemon(daemonContext, daemon.entry)
		}()
	}

	return nil
}

// randomPeerPortsEnabled reads whether connection peer-port edits affect a daemon.
func (runner *runner) randomPeerPortsEnabled() (bool, error) {
	basePath := filepath.Join(
		runner.options.RuntimeDirectory,
		"transmission-config",
		"settings-base.json",
	)
	baseSettings, err := readNativeSettings(basePath, false)
	if err != nil {
		return false, err
	}

	return nativeBoolean(baseSettings, "peer-port-random-on-start")
}

// publishMigrationFailure isolates legacy data errors to the slot-zero daemon.
func (runner *runner) publishMigrationFailure(entry daemonEntry, migrationError error) {
	bindAddress, _ := transmissionconfig.SlotBindAddressIPv4(entry.Slot)
	message := "Couldn't move the existing Transmission files: " + migrationError.Error()
	runner.publishDaemonState(daemonState{
		ConnectionID: entry.ConnectionID,
		State:        "exited",
		Error:        message,
		RPCPort:      firstDaemonRPCPort + entry.Slot,
		BindAddress:  bindAddress,
		PeerPort:     entry.PeerPort,
	})

	logKey := entry.ConnectionID + "\x00" + message
	if logKey == runner.lastMigrationError {
		return
	}
	runner.lastMigrationError = logKey
	runner.logger.Error(
		"Transmission legacy configuration migration failed",
		"connectionId",
		entry.ConnectionID,
		"error",
		message,
	)
}

// stopDaemon cancels one supervisor and optionally removes its runtime state.
func (runner *runner) stopDaemon(connectionID string, removeState bool) {
	daemon, found := runner.daemons[connectionID]
	if !found {
		return
	}

	delete(runner.daemons, connectionID)
	daemon.cancel()
	<-daemon.done
	if removeState {
		runner.removeDaemonState(connectionID)
	}
}

// stopAll waits for every child to honor the same bounded shutdown policy.
func (runner *runner) stopAll() {
	connectionIDs := make([]string, 0, len(runner.daemons))
	for connectionID, daemon := range runner.daemons {
		connectionIDs = append(connectionIDs, connectionID)
		daemon.cancel()
	}
	sort.Strings(connectionIDs)
	for _, connectionID := range connectionIDs {
		daemon := runner.daemons[connectionID]
		<-daemon.done
		delete(runner.daemons, connectionID)
	}
}

// superviseDaemon restarts one connection without affecting sibling daemons.
//
// It installs current merger files before each child starts and registers the live
// process identity only for the interval in which SIGHUP delivery is safe.
//
// Since: UNRELEASED
func (runner *runner) superviseDaemon(ctx context.Context, entry daemonEntry) {
	restartDelay := runner.options.RestartBackoff
	for ctx.Err() == nil {
		bindAddress, bindError := transmissionconfig.SlotBindAddressIPv4(entry.Slot)
		if bindError != nil {
			runner.publishExitedState(entry, "", entry.PeerPort)
			runner.logger.Error(
				"Transmission daemon bind address is invalid",
				"connectionId",
				entry.ConnectionID,
				"error",
				bindError,
			)

			return
		}
		configDirectory, peerPort, releasePeerPort, err := runner.prepareDaemonSettings(
			entry,
			bindAddress,
		)
		if err != nil {
			runner.publishExitedState(entry, bindAddress, entry.PeerPort)
			runner.logger.Error(
				"Transmission daemon configuration failed",
				"connectionId",
				entry.ConnectionID,
				"error",
				err,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)

			continue
		}
		preparedRevision, err := runner.blocklists.prepareDaemon(ctx, entry, peerPort)
		if err != nil {
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)
			runner.logger.Error(
				"Transmission daemon blocklist preparation failed",
				"connectionId",
				entry.ConnectionID,
				"error",
				err,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)

			continue
		}

		rpcPort := firstDaemonRPCPort + entry.Slot
		runner.publishDaemonState(daemonState{
			ConnectionID: entry.ConnectionID,
			State:        "starting",
			RPCPort:      rpcPort,
			BindAddress:  bindAddress,
			PeerPort:     peerPort,
		})

		client, clientError := transmissionrpc.NewClient(
			fmt.Sprintf("http://127.0.0.1:%d/transmission/rpc", rpcPort),
			5*time.Second,
		)
		if clientError != nil {
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)
			runner.logger.Error(
				"Transmission daemon client failed",
				"connectionId",
				entry.ConnectionID,
				"error",
				clientError,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)

			continue
		}

		command := exec.Command(
			runner.options.DaemonPath,
			"--foreground",
			"--config-dir",
			configDirectory,
			"--log-level",
			"info",
		)
		command.Stdout = os.Stdout
		command.Stderr = os.Stderr
		command.SysProcAttr = childProcessAttributes()
		if err := command.Start(); err != nil {
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)
			runner.logger.Error(
				"Transmission daemon failed to start",
				"connectionId",
				entry.ConnectionID,
				"error",
				err,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)

			continue
		}
		runner.setDaemonProcess(
			entry,
			command.Process.Pid,
			peerPort,
			client,
			preparedRevision,
		)

		exited := make(chan error, 1)
		go func() {
			exited <- command.Wait()
		}()

		readiness, err := waitForReadiness(
			ctx,
			client,
			exited,
			runner.options.ReadinessTimeout,
		)
		if err != nil {
			stopProcessGroup(command.Process.Pid, exited)
			runner.clearDaemonProcess(entry.ConnectionID, command.Process.Pid)
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)
			if ctx.Err() != nil {
				return
			}
			runner.logger.Error(
				"Transmission daemon did not become ready",
				"connectionId",
				entry.ConnectionID,
				"error",
				err,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)

			continue
		}
		if err := runner.markDaemonReady(ctx, entry.ConnectionID, command.Process.Pid); err != nil {
			runner.logger.Warn(
				"Transmission daemon deferred reload failed",
				"connectionId",
				entry.ConnectionID,
				"error",
				err,
			)
		}

		runner.publishDaemonState(daemonState{
			ConnectionID: entry.ConnectionID,
			State:        "ready",
			RPCPort:      rpcPort,
			BindAddress:  bindAddress,
			PeerPort:     peerPort,
			Version:      readiness.Version,
			RPCVersion:   readiness.RPCVersion,
		})
		runner.logger.Info(
			"Transmission daemon is ready",
			"connectionId",
			entry.ConnectionID,
			"version",
			readiness.Version,
			"rpcVersion",
			readiness.RPCVersion,
			"bindAddress",
			bindAddress,
		)
		event, processError, stable := waitForDaemonEvent(
			ctx,
			exited,
			runner.options.BackoffResetAfter,
		)
		if stable {
			restartDelay = runner.options.RestartBackoff
		}
		switch event {
		case daemonEventStopping:
			runner.logger.Info(
				"Transmission daemon is stopping",
				"connectionId",
				entry.ConnectionID,
			)
			stopProcessGroup(command.Process.Pid, exited)
			runner.clearDaemonProcess(entry.ConnectionID, command.Process.Pid)
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)

			return
		case daemonEventExited:
			runner.clearDaemonProcess(entry.ConnectionID, command.Process.Pid)
			releasePeerPort()
			runner.publishExitedState(entry, bindAddress, peerPort)
			if processError == nil {
				processError = errors.New("daemon exited")
			}
			runner.logger.Error(
				"Transmission daemon exited",
				"connectionId",
				entry.ConnectionID,
				"error",
				processError,
			)
			if !waitForRetry(ctx, restartDelay) {
				return
			}
			restartDelay = nextRestartDelay(restartDelay)
		}
	}
}

// setDaemonProcess records one started child without making it signalable yet.
//
// The prepared revision detects a sync between preparation and Start; that race marks
// the child for one deferred reload after its RPC readiness handshake.
//
// Since: UNRELEASED
func (runner *runner) setDaemonProcess(
	entry daemonEntry,
	processID int,
	peerPort int,
	client transmissionrpc.Caller,
	preparedRevision uint64,
) {
	runner.processMutex.Lock()
	runner.processes[entry.ConnectionID] = &daemonProcess{
		Entry:            entry,
		ProcessID:        processID,
		PeerPort:         peerPort,
		Client:           client,
		ReloadPending:    runner.reloadRevision > preparedRevision,
		BlocklistEnabled: runner.reloadBlocklistEnabled,
	}
	runner.processMutex.Unlock()
}

// clearDaemonProcess removes one child only if the recorded process still matches.
//
// The process identity guard prevents a delayed cleanup from erasing a rapidly
// restarted replacement for the same connection.
//
// Since: UNRELEASED
func (runner *runner) clearDaemonProcess(connectionID string, processID int) {
	runner.processMutex.Lock()
	process := runner.processes[connectionID]
	if process != nil && process.ProcessID == processID {
		delete(runner.processes, connectionID)
	}
	runner.processMutex.Unlock()
}

type daemonEvent int

const (
	daemonEventStopping daemonEvent = iota
	daemonEventExited
)

// waitForDaemonEvent observes only supervisor cancellation and the child process.
func waitForDaemonEvent(
	ctx context.Context,
	exited <-chan error,
	backoffResetAfter time.Duration,
) (daemonEvent, error, bool) {
	resetTimer := time.NewTimer(backoffResetAfter)
	defer resetTimer.Stop()
	resetChannel := resetTimer.C
	stable := false

	for {
		select {
		case <-ctx.Done():
			return daemonEventStopping, nil, stable
		case processError := <-exited:
			return daemonEventExited, processError, stable
		case <-resetChannel:
			stable = true
			resetChannel = nil
		}
	}
}

// readDaemonEntries validates one complete list before it can change running daemons.
func readDaemonEntries(path string) ([]daemonEntry, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read Transmission daemon list: %w", err)
	}

	var entries []daemonEntry
	if err := json.Unmarshal(content, &entries); err != nil {
		return nil, fmt.Errorf("decode Transmission daemon list: %w", err)
	}
	if entries == nil {
		return nil, errors.New("Transmission daemon list must be a JSON array")
	}

	connectionIDs := make(map[string]struct{}, len(entries))
	slots := make(map[int]struct{}, len(entries))
	defaultCount := 0
	for _, entry := range entries {
		if !connectionIDPattern.MatchString(entry.ConnectionID) {
			return nil, fmt.Errorf("invalid Transmission connection identifier %q", entry.ConnectionID)
		}
		if entry.Slot < 0 || entry.Slot > 63 {
			return nil, fmt.Errorf("Transmission slot %d is outside 0 to 63", entry.Slot)
		}
		if entry.PeerPort < 1024 || entry.PeerPort > 65535 {
			return nil, fmt.Errorf("Transmission peer port %d is outside 1024 to 65535", entry.PeerPort)
		}
		if _, found := connectionIDs[entry.ConnectionID]; found {
			return nil, fmt.Errorf("duplicate Transmission connection %s", entry.ConnectionID)
		}
		if _, found := slots[entry.Slot]; found {
			return nil, fmt.Errorf("duplicate Transmission slot %d", entry.Slot)
		}
		connectionIDs[entry.ConnectionID] = struct{}{}
		slots[entry.Slot] = struct{}{}
		if entry.Default {
			defaultCount++
		}
	}
	if len(entries) > 0 && defaultCount != 1 {
		return nil, fmt.Errorf("Transmission daemon list requires one default, found %d", defaultCount)
	}

	sort.Slice(entries, func(left int, right int) bool {
		return entries[left].Slot < entries[right].Slot
	})

	return entries, nil
}

// publishExitedState records a stopped child without adding non-contract error fields.
func (runner *runner) publishExitedState(entry daemonEntry, bindAddress string, peerPort int) {
	runner.publishDaemonState(daemonState{
		ConnectionID: entry.ConnectionID,
		State:        "exited",
		RPCPort:      firstDaemonRPCPort + entry.Slot,
		BindAddress:  bindAddress,
		PeerPort:     peerPort,
	})
}

// publishDaemonState records one state, refreshes default readiness, then writes the file.
//
// Memory and the readiness marker change before the state file, all under stateMutex, so
// a reader that sees a ready state file never races a default switch that removes the marker.
//
// Since: UNRELEASED
func (runner *runner) publishDaemonState(state daemonState) {
	state.UpdatedAt = time.Now().UTC()

	runner.stateMutex.Lock()
	defer runner.stateMutex.Unlock()
	runner.states[state.ConnectionID] = state
	runner.updateReadinessMarkerLocked()

	if err := writeDaemonState(runner.statePath(state.ConnectionID), state); err != nil {
		runner.logger.Error(
			"Transmission daemon state could not be written",
			"connectionId",
			state.ConnectionID,
			"error",
			err,
		)
	}
}

// removeDaemonState removes a declaration's stale file and readiness contribution.
func (runner *runner) removeDaemonState(connectionID string) {
	_ = os.Remove(runner.statePath(connectionID))

	runner.stateMutex.Lock()
	defer runner.stateMutex.Unlock()
	delete(runner.states, connectionID)
	runner.updateReadinessMarkerLocked()
}

// setDefaultID updates readiness immediately when the daemon list changes default.
func (runner *runner) setDefaultID(connectionID string) {
	runner.stateMutex.Lock()
	defer runner.stateMutex.Unlock()
	runner.defaultID = connectionID
	runner.updateReadinessMarkerLocked()
}

// updateReadinessMarkerLocked publishes the current default while holding stateMutex.
func (runner *runner) updateReadinessMarkerLocked() {
	markerPath := runner.readinessMarkerPath()
	if runner.defaultID == "" {
		if err := runner.writeEmpty(markerPath); err != nil {
			runner.logger.Error("Transmission no-connections marker could not be written", "error", err)
		}

		return
	}

	state, found := runner.states[runner.defaultID]
	if !found || state.State != "ready" {
		_ = os.Remove(markerPath)

		return
	}
	if err := runner.writeReady(markerPath, state); err != nil {
		runner.logger.Error(
			"Transmission readiness marker could not be written",
			"connectionId",
			state.ConnectionID,
			"error",
			err,
		)
	}
}

// writeDaemonState atomically publishes one group-readable daemon state file.
func writeDaemonState(path string, state daemonState) error {
	return writeJSONFile(path, ".transmission-state-*", 0o640, state)
}

// writeReadinessMarker atomically publishes the default daemon's identity.
func writeReadinessMarker(path string, state daemonState) error {
	return writeJSONFile(path, ".transmission-ready-*", 0o644, map[string]any{
		"service":      "transmission",
		"phase":        "daemon",
		"connectionId": state.ConnectionID,
		"version":      state.Version,
		"rpcVersion":   state.RPCVersion,
		"rpcPort":      state.RPCPort,
	})
}

// writeNoConnectionsMarker keeps container liveness healthy before VPN setup.
func writeNoConnectionsMarker(path string) error {
	return writeJSONFile(path, ".transmission-ready-*", 0o644, map[string]any{
		"service": "transmission",
		"phase":   "no-connections",
	})
}

// writeJSONFile writes and renames one complete runtime document.
func writeJSONFile(path string, pattern string, mode os.FileMode, value any) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), pattern)
	if err != nil {
		return err
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(mode); err != nil {
		return err
	}
	if err := json.NewEncoder(temporaryFile).Encode(value); err != nil {
		return err
	}
	if err := temporaryFile.Sync(); err != nil {
		return err
	}
	if err := temporaryFile.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return err
	}

	committed = true

	return nil
}

// waitForRetry pauses one failing daemon without delaying sibling supervisors.
func waitForRetry(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

// nextRestartDelay doubles repeated failures up to a bounded thirty seconds.
func nextRestartDelay(current time.Duration) time.Duration {
	next := current * 2
	if next > 30*time.Second {
		return 30 * time.Second
	}

	return next
}

// statePath returns one connection's runner-owned daemon state file.
func (runner *runner) statePath(connectionID string) string {
	return filepath.Join(
		runner.options.RuntimeDirectory,
		"transmission-state",
		connectionID+".json",
	)
}

// readinessMarkerPath returns the legacy default-daemon readiness projection.
func (runner *runner) readinessMarkerPath() string {
	return filepath.Join(
		runner.options.RuntimeDirectory,
		"services",
		"transmission.ready",
	)
}
