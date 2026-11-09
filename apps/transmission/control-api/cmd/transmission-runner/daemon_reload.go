package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"syscall"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
)

// liveDaemonSettingMapping connects one legacy RPC field to its settings.json key.
//
// A converter is present only when Transmission exposes a different value format
// through session-get than it persists in its native configuration file.
//
// Since: UNRELEASED
type liveDaemonSettingMapping struct {
	settingsKey string
	convert     func(json.RawMessage) (json.RawMessage, error)
}

var (
	// liveDaemonSettingMappings is the complete user-tunable live session allowlist.
	//
	// The keys mirror the API registry and compatible RPC facade, while deliberately
	// excluding derived status, listener, script, and other appliance-owned fields.
	//
	// Since: UNRELEASED
	liveDaemonSettingMappings = map[string]liveDaemonSettingMapping{
		"alt-speed-down":               {settingsKey: "alt-speed-down"},
		"alt-speed-enabled":            {settingsKey: "alt-speed-enabled"},
		"alt-speed-time-begin":         {settingsKey: "alt-speed-time-begin"},
		"alt-speed-time-day":           {settingsKey: "alt-speed-time-day"},
		"alt-speed-time-enabled":       {settingsKey: "alt-speed-time-enabled"},
		"alt-speed-time-end":           {settingsKey: "alt-speed-time-end"},
		"alt-speed-up":                 {settingsKey: "alt-speed-up"},
		"blocklist-enabled":            {settingsKey: "blocklist-enabled"},
		"cache-size-mb":                {settingsKey: "cache-size-mb"},
		"dht-enabled":                  {settingsKey: "dht-enabled"},
		"download-dir":                 {settingsKey: "download-dir"},
		"download-queue-enabled":       {settingsKey: "download-queue-enabled"},
		"download-queue-size":          {settingsKey: "download-queue-size"},
		"encryption":                   {settingsKey: "encryption", convert: convertLiveEncryptionSetting},
		"idle-seeding-limit":           {settingsKey: "idle-seeding-limit"},
		"idle-seeding-limit-enabled":   {settingsKey: "idle-seeding-limit-enabled"},
		"incomplete-dir":               {settingsKey: "incomplete-dir"},
		"incomplete-dir-enabled":       {settingsKey: "incomplete-dir-enabled"},
		"lpd-enabled":                  {settingsKey: "lpd-enabled"},
		"peer-limit-global":            {settingsKey: "peer-limit-global"},
		"pex-enabled":                  {settingsKey: "pex-enabled"},
		"queue-stalled-enabled":        {settingsKey: "queue-stalled-enabled"},
		"queue-stalled-minutes":        {settingsKey: "queue-stalled-minutes"},
		"rename-partial-files":         {settingsKey: "rename-partial-files"},
		"seed-queue-enabled":           {settingsKey: "seed-queue-enabled"},
		"seed-queue-size":              {settingsKey: "seed-queue-size"},
		"speed-limit-down":             {settingsKey: "speed-limit-down"},
		"speed-limit-down-enabled":     {settingsKey: "speed-limit-down-enabled"},
		"speed-limit-up":               {settingsKey: "speed-limit-up"},
		"speed-limit-up-enabled":       {settingsKey: "speed-limit-up-enabled"},
		"start-added-torrents":         {settingsKey: "start-added-torrents"},
		"trash-original-torrent-files": {settingsKey: "trash-original-torrent-files"},
		"utp-enabled":                  {settingsKey: "utp-enabled"},
	}
)

// currentReloadRevision returns the latest completed synchronization generation.
//
// Daemon preparation captures this value so a later process registration can detect
// whether blocklist files changed before the RPC socket became ready.
//
// Since: UNRELEASED
func (runner *runner) currentReloadRevision() uint64 {
	runner.processMutex.Lock()
	defer runner.processMutex.Unlock()

	return runner.reloadRevision
}

// requestDaemonReloads reloads every ready child and defers every starting child.
//
// One generation covers the complete synchronized daemon set; errors are joined only
// after all ready siblings have received their independent reload attempt.
//
// Since: UNRELEASED
func (runner *runner) requestDaemonReloads(
	ctx context.Context,
	entries []daemonEntry,
	blocklistEnabled bool,
) error {
	readyProcesses := runner.scheduleDaemonReloads(entries, blocklistEnabled)

	return runner.reloadDaemons(ctx, readyProcesses)
}

// scheduleDaemonReloads records one generation and snapshots every ready child.
//
// Callers keep file synchronization and revision publication atomic, then perform
// slower RPC snapshots after releasing their filesystem ownership lock.
//
// Since: UNRELEASED
func (runner *runner) scheduleDaemonReloads(
	entries []daemonEntry,
	blocklistEnabled bool,
) []daemonProcess {
	desired := make(map[string]daemonEntry, len(entries))
	for _, entry := range entries {
		desired[entry.ConnectionID] = entry
	}

	runner.processMutex.Lock()
	runner.reloadRevision++
	runner.reloadBlocklistEnabled = blocklistEnabled
	readyProcesses := make([]daemonProcess, 0, len(runner.processes))
	for connectionID, process := range runner.processes {
		entry, found := desired[connectionID]
		if !found {
			continue
		}
		process.Entry = entry
		process.BlocklistEnabled = blocklistEnabled
		if !process.Ready {
			process.ReloadPending = true

			continue
		}
		process.ReloadPending = false
		readyProcesses = append(readyProcesses, *process)
	}
	runner.processMutex.Unlock()

	sort.Slice(readyProcesses, func(left int, right int) bool {
		return readyProcesses[left].Entry.ConnectionID < readyProcesses[right].Entry.ConnectionID
	})

	return readyProcesses
}

// reloadDaemons snapshots and signals one previously scheduled ready-child set.
//
// Failures mark only the matching process pending so a later generation can retry
// without losing successful reloads delivered to sibling daemons.
//
// Since: UNRELEASED
func (runner *runner) reloadDaemons(
	ctx context.Context,
	readyProcesses []daemonProcess,
) error {
	var reloadError error
	for _, process := range readyProcesses {
		if err := runner.reloadDaemon(ctx, process); err != nil {
			runner.markReloadPending(process.Entry.ConnectionID, process.ProcessID)
			reloadError = errors.Join(reloadError, err)
		}
	}

	return reloadError
}

// markDaemonReady makes one matching child signalable after its RPC handshake.
//
// A pending generation is consumed under the process lock and reloaded once outside
// it, preventing an early SIGHUP from terminating a handlerless daemon.
//
// Since: UNRELEASED
func (runner *runner) markDaemonReady(
	ctx context.Context,
	connectionID string,
	processID int,
) error {
	runner.processMutex.Lock()
	process := runner.processes[connectionID]
	if process == nil || process.ProcessID != processID {
		runner.processMutex.Unlock()

		return nil
	}
	process.Ready = true
	if !process.ReloadPending {
		runner.processMutex.Unlock()

		return nil
	}
	process.ReloadPending = false
	snapshot := *process
	runner.processMutex.Unlock()

	if err := runner.reloadDaemon(ctx, snapshot); err != nil {
		runner.markReloadPending(connectionID, processID)

		return err
	}

	return nil
}

// markReloadPending preserves a failed reload for the next synchronization request.
//
// The identity guard prevents an old process failure from marking a rapidly restarted
// replacement that has already prepared the latest files.
//
// Since: UNRELEASED
func (runner *runner) markReloadPending(connectionID string, processID int) {
	runner.processMutex.Lock()
	process := runner.processes[connectionID]
	if process != nil && process.ProcessID == processID {
		process.ReloadPending = true
	}
	runner.processMutex.Unlock()
}

// reloadDaemon snapshots live settings, reapplies owned keys, and sends one SIGHUP.
//
// The shared path covers every runner reload reason so RPC session changes survive
// blocklist replacement and the slot bind, peer port, and RPC socket remain fixed.
//
// Since: UNRELEASED
func (runner *runner) reloadDaemon(ctx context.Context, process daemonProcess) error {
	settingsPath := filepath.Join(
		runner.options.ConfigDirectory,
		process.Entry.ConnectionID,
		"settings.json",
	)
	fields := make([]string, 0, len(liveDaemonSettingMappings))
	for key := range liveDaemonSettingMappings {
		fields = append(fields, key)
	}
	sort.Strings(fields)

	runner.reloadMutex.Lock()
	defer runner.reloadMutex.Unlock()

	liveSettings := map[string]json.RawMessage{}
	if err := process.Client.Call(
		ctx,
		"session-get",
		map[string]any{"fields": fields},
		&liveSettings,
	); err != nil {
		return fmt.Errorf("read live state for daemon %s: %w", process.Entry.ConnectionID, err)
	}

	runner.processMutex.Lock()
	currentProcess := runner.processes[process.Entry.ConnectionID]
	processCurrent := currentProcess != nil && currentProcess.ProcessID == process.ProcessID
	runner.processMutex.Unlock()
	if !processCurrent {
		return nil
	}
	currentSettings, err := readNativeSettings(settingsPath, false)
	if err != nil {
		return fmt.Errorf("read live settings for daemon %s: %w", process.Entry.ConnectionID, err)
	}
	for rpcKey, mapping := range liveDaemonSettingMappings {
		liveValue, found := liveSettings[rpcKey]
		if !found {
			continue
		}
		if mapping.convert != nil {
			liveValue, err = mapping.convert(liveValue)
			if err != nil {
				return fmt.Errorf("convert live setting %s for daemon %s: %w", rpcKey, process.Entry.ConnectionID, err)
			}
		}
		currentSettings[mapping.settingsKey] = append(json.RawMessage(nil), liveValue...)
	}
	if err := runner.writeOwnedDaemonSettings(
		settingsPath,
		currentSettings,
		process.Entry,
		process.PeerPort,
		process.BlocklistEnabled,
	); err != nil {
		return err
	}
	if err := runner.signalProcess(process.ProcessID); err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("signal daemon %s: %w", process.Entry.ConnectionID, err)
	}

	return nil
}

// convertLiveEncryptionSetting restores Transmission's native integer mode.
//
// Legacy session-get returns required, preferred, or tolerated strings, while the
// 4.1 settings file persists the corresponding enum value from zero through two.
//
// Since: UNRELEASED
func convertLiveEncryptionSetting(value json.RawMessage) (json.RawMessage, error) {
	var name string
	if err := json.Unmarshal(value, &name); err == nil {
		mode := -1
		switch name {
		case "allowed", "tolerated":
			mode = 0
		case "preferred":
			mode = 1
		case "required":
			mode = 2
		}
		if mode < 0 {
			return nil, fmt.Errorf("unsupported encryption mode %q", name)
		}

		return json.Marshal(mode)
	}

	var mode int
	if err := json.Unmarshal(value, &mode); err != nil || mode < 0 || mode > 2 {
		return nil, errors.New("encryption mode must be required, preferred, tolerated, or an integer from 0 to 2")
	}

	return json.Marshal(mode)
}

// writePreparedDaemonSettings applies owned keys before a new child starts.
//
// No RPC merge is needed before Start; prepareDaemonSettings has already combined the
// saved file and application base, and this pass supplies current blocklist ownership.
//
// Since: UNRELEASED
func (runner *runner) writePreparedDaemonSettings(
	entry daemonEntry,
	peerPort int,
	blocklistEnabled bool,
) error {
	runner.reloadMutex.Lock()
	defer runner.reloadMutex.Unlock()

	settingsPath := filepath.Join(
		runner.options.ConfigDirectory,
		entry.ConnectionID,
		"settings.json",
	)
	settings, err := readNativeSettings(settingsPath, false)
	if err != nil {
		return err
	}

	return runner.writeOwnedDaemonSettings(
		settingsPath,
		settings,
		entry,
		peerPort,
		blocklistEnabled,
	)
}

// writeOwnedDaemonSettings applies runner invariants and atomically writes one file.
//
// Owned values are deliberately assigned after any live merge so remote session-set
// calls cannot move a daemon off its protected slot or restore Transmission URL fetches.
//
// Since: UNRELEASED
func (runner *runner) writeOwnedDaemonSettings(
	settingsPath string,
	settings map[string]json.RawMessage,
	entry daemonEntry,
	peerPort int,
	blocklistEnabled bool,
) error {
	bindAddress, err := transmissionconfig.SlotBindAddressIPv4(entry.Slot)
	if err != nil {
		return err
	}
	setNativeValue(settings, "bind-address-ipv4", bindAddress)
	setNativeValue(settings, "peer-port", peerPort)
	setNativeValue(settings, "peer-port-random-on-start", false)
	setNativeValue(settings, "rpc-bind-address", "127.0.0.1")
	setNativeValue(settings, "rpc-port", firstDaemonRPCPort+entry.Slot)
	setNativeValue(settings, "rpc-host-whitelist", "127.0.0.1,localhost")
	setNativeValue(settings, "rpc-host-whitelist-enabled", true)
	setNativeValue(settings, "blocklist-enabled", blocklistEnabled)
	setNativeValue(settings, "blocklist-url", "")
	content, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings for daemon %s: %w", entry.ConnectionID, err)
	}
	if err := transmissionconfig.Write(settingsPath, append(content, '\n')); err != nil {
		return fmt.Errorf("write settings for daemon %s: %w", entry.ConnectionID, err)
	}

	return nil
}
