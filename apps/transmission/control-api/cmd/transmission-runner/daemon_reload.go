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
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// liveDaemonSettingMapping connects one legacy RPC field to its settings.json key.
//
// A converter is present only when Transmission exposes a different value format
// through session-get than it persists in its native configuration file.
//
// Since: 2.0.0
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
	// Since: 2.0.0
	liveDaemonSettingMappings = map[transmissionrpc.SessionField]liveDaemonSettingMapping{
		transmissionrpc.SessionFieldAlternateSpeedDown: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedDown),
		},
		transmissionrpc.SessionFieldAlternateSpeedEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedEnabled),
		},
		transmissionrpc.SessionFieldAlternateSpeedTimeBegin: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedTimeBegin),
		},
		transmissionrpc.SessionFieldAlternateSpeedTimeDay: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedTimeDay),
		},
		transmissionrpc.SessionFieldAlternateSpeedTimeEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedTimeEnabled),
		},
		transmissionrpc.SessionFieldAlternateSpeedTimeEnd: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedTimeEnd),
		},
		transmissionrpc.SessionFieldAlternateSpeedUp: {
			settingsKey: string(transmissionrpc.SessionFieldAlternateSpeedUp),
		},
		transmissionrpc.SessionFieldBlocklistEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldBlocklistEnabled),
		},
		transmissionrpc.SessionFieldCacheSizeMB: {
			settingsKey: string(transmissionrpc.SessionFieldCacheSizeMB),
		},
		transmissionrpc.SessionFieldDHTEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldDHTEnabled),
		},
		transmissionrpc.SessionFieldDownloadDirectory: {
			settingsKey: string(transmissionrpc.SessionFieldDownloadDirectory),
		},
		transmissionrpc.SessionFieldDownloadQueueEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldDownloadQueueEnabled),
		},
		transmissionrpc.SessionFieldDownloadQueueSize: {
			settingsKey: string(transmissionrpc.SessionFieldDownloadQueueSize),
		},
		transmissionrpc.SessionFieldEncryption: {
			settingsKey: string(transmissionrpc.SessionFieldEncryption),
			convert:     convertLiveEncryptionSetting,
		},
		transmissionrpc.SessionFieldIdleSeedingLimit: {
			settingsKey: string(transmissionrpc.SessionFieldIdleSeedingLimit),
		},
		transmissionrpc.SessionFieldIdleSeedingLimitEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldIdleSeedingLimitEnabled),
		},
		transmissionrpc.SessionFieldIncompleteDirectory: {
			settingsKey: string(transmissionrpc.SessionFieldIncompleteDirectory),
		},
		transmissionrpc.SessionFieldIncompleteDirectoryEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldIncompleteDirectoryEnabled),
		},
		transmissionrpc.SessionFieldLPDEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldLPDEnabled),
		},
		transmissionrpc.SessionFieldPeerLimitGlobal: {
			settingsKey: string(transmissionrpc.SessionFieldPeerLimitGlobal),
		},
		transmissionrpc.SessionFieldPEXEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldPEXEnabled),
		},
		transmissionrpc.SessionFieldQueueStalledEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldQueueStalledEnabled),
		},
		transmissionrpc.SessionFieldQueueStalledMinutes: {
			settingsKey: string(transmissionrpc.SessionFieldQueueStalledMinutes),
		},
		transmissionrpc.SessionFieldRenamePartialFiles: {
			settingsKey: string(transmissionrpc.SessionFieldRenamePartialFiles),
		},
		transmissionrpc.SessionFieldSeedQueueEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldSeedQueueEnabled),
		},
		transmissionrpc.SessionFieldSeedQueueSize: {
			settingsKey: string(transmissionrpc.SessionFieldSeedQueueSize),
		},
		transmissionrpc.SessionFieldSpeedLimitDown: {
			settingsKey: string(transmissionrpc.SessionFieldSpeedLimitDown),
		},
		transmissionrpc.SessionFieldSpeedLimitDownEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldSpeedLimitDownEnabled),
		},
		transmissionrpc.SessionFieldSpeedLimitUp: {
			settingsKey: string(transmissionrpc.SessionFieldSpeedLimitUp),
		},
		transmissionrpc.SessionFieldSpeedLimitUpEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldSpeedLimitUpEnabled),
		},
		transmissionrpc.SessionFieldStartAddedTorrents: {
			settingsKey: string(transmissionrpc.SessionFieldStartAddedTorrents),
		},
		transmissionrpc.SessionFieldTrashOriginalTorrentFiles: {
			settingsKey: string(transmissionrpc.SessionFieldTrashOriginalTorrentFiles),
		},
		transmissionrpc.SessionFieldUTPEnabled: {
			settingsKey: string(transmissionrpc.SessionFieldUTPEnabled),
		},
	}
)

// currentReloadRevision returns the latest completed synchronization generation.
//
// Daemon preparation captures this value so a later process registration can detect
// whether blocklist files changed before the RPC socket became ready.
//
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
func (runner *runner) reloadDaemon(ctx context.Context, process daemonProcess) error {
	settingsPath := filepath.Join(
		runner.options.ConfigDirectory,
		process.Entry.ConnectionID,
		"settings.json",
	)
	fields := make([]transmissionrpc.SessionField, 0, len(liveDaemonSettingMappings))
	for field := range liveDaemonSettingMappings {
		fields = append(fields, field)
	}
	sort.Slice(fields, func(left int, right int) bool {
		return fields[left] < fields[right]
	})

	runner.reloadMutex.Lock()
	defer runner.reloadMutex.Unlock()

	liveSettings, err := process.Client.GetSession(
		ctx,
		transmissionrpc.GetSessionRequest{Fields: fields},
	)
	if err != nil {
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
		liveValue, found := liveSettings[string(rpcKey)]
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
// Since: 2.0.0
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
// Since: 2.0.0
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
// Since: 2.0.0
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
