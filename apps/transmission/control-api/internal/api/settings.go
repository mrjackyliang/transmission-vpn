package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// settingsSnapshotResponse adds runtime-only restart state to durable settings.
//
// A container restart starts this list empty because config-init renders the complete
// accepted snapshot before the API process starts.
type settingsSnapshotResponse struct {
	storage.ConfigurationSnapshot
	PendingRestartKeys []string `json:"pendingRestartKeys"`
}

// handleGetSettings returns the complete effective setting contract and revision.
//
// Defaults and managed provenance are resolved server-side so every client observes
// identical precedence and lock behavior.
//
// Since: 2.0.0
func (server *Server) handleGetSettings(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	snapshot, err := server.store.EffectiveConfiguration(request.Context(), server.registry)
	if err != nil {
		server.logInternalError("read effective settings", err)
		writeError(responseWriter, http.StatusInternalServerError, "settings_unavailable", "Settings are unavailable.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, settingsSnapshotResponse{
		ConfigurationSnapshot: snapshot,
		PendingRestartKeys:    server.transmissionRestartKeys(request.Context()),
	})
}

// settingsRuntimeApply explains which committed values reached the running daemon.
//
// Persistence remains authoritative when Transmission is restarting or unavailable;
// clients can distinguish that safe deferred state from an uncommitted transaction.
type settingsRuntimeApply struct {
	Status      string                    `json:"status"`
	AppliedKeys []string                  `json:"appliedKeys"`
	PendingKeys []string                  `json:"pendingKeys"`
	Connections []settingsConnectionApply `json:"connections"`
}

// settingsConnectionApply reports the running state of one daemon after a save.
type settingsConnectionApply struct {
	ConnectionID string   `json:"connectionId"`
	Status       string   `json:"status"`
	AppliedKeys  []string `json:"appliedKeys"`
	PendingKeys  []string `json:"pendingKeys"`
	Error        string   `json:"error,omitempty"`
}

// applyLiveTransmissionSettings propagates only registry-approved live settings.
//
// Runner-owned blocklist keys count as applied even when they produce no native RPC
// arguments, because publication has already handed them to the merger.
//
// Since: 2.0.0
func (server *Server) applyLiveTransmissionSettings(
	request *http.Request,
	changes storage.SettingChanges,
) settingsRuntimeApply {
	arguments, pendingKeys, err := transmissionconfig.LiveSessionArguments(
		server.registry,
		changes,
	)
	if err != nil {
		server.logInternalError("map live Transmission settings", err)

		return settingsRuntimeApply{
			Status:      "deferred",
			AppliedKeys: []string{},
			PendingKeys: sortedSettingKeys(changes),
			Connections: []settingsConnectionApply{},
		}
	}

	sort.Strings(pendingKeys)
	pendingSet := make(map[string]struct{}, len(pendingKeys))
	for _, key := range pendingKeys {
		pendingSet[key] = struct{}{}
	}
	liveKeys := make([]string, 0, len(changes)-len(pendingKeys))
	for key := range changes {
		if _, pending := pendingSet[key]; !pending {
			liveKeys = append(liveKeys, key)
		}
	}
	sort.Strings(liveKeys)
	daemons := server.transmissionDaemons(request.Context())
	sort.Slice(daemons, func(left int, right int) bool {
		return daemons[left].Slot < daemons[right].Slot
	})
	if len(arguments) == 0 {
		status := "applied"
		if len(pendingKeys) > 0 {
			status = "restart-required"
		}
		connections := make([]settingsConnectionApply, 0, len(daemons))
		for _, daemon := range daemons {
			connections = append(connections, settingsConnectionApply{
				ConnectionID: daemon.ConnectionID,
				Status:       status,
				AppliedKeys:  append([]string{}, liveKeys...),
				PendingKeys:  append([]string{}, pendingKeys...),
			})
		}

		return settingsRuntimeApply{
			Status:      status,
			AppliedKeys: liveKeys,
			PendingKeys: pendingKeys,
			Connections: connections,
		}
	}

	if len(daemons) == 0 {
		return settingsRuntimeApply{
			Status:      "deferred",
			AppliedKeys: []string{},
			PendingKeys: sortedSettingKeys(changes),
			Connections: []settingsConnectionApply{},
		}
	}

	failures := server.callEveryTransmission(
		request.Context(),
		"session-set",
		func(transmissionrpc.Daemon) (any, error) {
			return arguments, nil
		},
	)
	if len(failures) > 0 {
		for connectionID, err := range failures {
			server.logInternalError(
				"apply live Transmission settings for connection "+connectionID,
				err,
			)
		}

		server.addTransmissionPendingKeys(request.Context(), liveKeys)
		connections := make([]settingsConnectionApply, 0, len(daemons))
		for _, daemon := range daemons {
			connection := settingsConnectionApply{
				ConnectionID: daemon.ConnectionID,
				AppliedKeys:  append([]string{}, liveKeys...),
				PendingKeys:  append([]string{}, pendingKeys...),
			}
			if _, failed := failures[daemon.ConnectionID]; failed {
				connection.Status = "deferred"
				connection.AppliedKeys = []string{}
				connection.PendingKeys = sortedSettingKeys(changes)
				connection.Error = "Transmission is unavailable for this connection."
			} else if len(pendingKeys) > 0 {
				connection.Status = "restart-required"
			} else {
				connection.Status = "applied"
			}
			connections = append(connections, connection)
		}
		status := "partial"
		if len(failures) == len(daemons) {
			status = "deferred"
		}

		return settingsRuntimeApply{
			Status:      status,
			AppliedKeys: []string{},
			PendingKeys: sortedSettingKeys(changes),
			Connections: connections,
		}
	}

	status := "applied"
	if len(pendingKeys) > 0 {
		status = "restart-required"
	}
	connections := make([]settingsConnectionApply, 0, len(daemons))
	for _, daemon := range daemons {
		connections = append(connections, settingsConnectionApply{
			ConnectionID: daemon.ConnectionID,
			Status:       status,
			AppliedKeys:  append([]string{}, liveKeys...),
			PendingKeys:  append([]string{}, pendingKeys...),
		})
	}
	server.clearTransmissionRestartKeys(liveKeys)

	return settingsRuntimeApply{
		Status:      status,
		AppliedKeys: liveKeys,
		PendingKeys: pendingKeys,
		Connections: connections,
	}
}

func sortedSettingKeys(changes storage.SettingChanges) []string {
	keys := make([]string, 0, len(changes))
	for key := range changes {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	return keys
}

// handleUpdateSettings validates and commits an optimistic settings transaction.
//
// A conflicting revision or host-managed lock returns a recoverable conflict instead
// of silently overwriting another configuration source.
//
// Since: 2.0.0
func (server *Server) handleUpdateSettings(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		ExpectedRevision *int64                 `json:"expectedRevision"`
		Changes          storage.SettingChanges `json:"changes"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	if input.ExpectedRevision == nil || *input.ExpectedRevision < 0 {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "expectedRevision", "expectedRevision must be a non-negative integer.")

		return
	}

	if input.Changes == nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "changes", "changes must be a JSON object.")

		return
	}
	if len(input.Changes) == 0 || len(input.Changes) > 256 {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"changes",
			"changes must contain between 1 and 256 settings.",
		)

		return
	}
	for _, key := range []string{
		"transmission.downloadDirectory",
		"transmission.incompleteDirectory",
	} {
		rawValue, found := input.Changes[key]
		if !found {
			continue
		}
		var pathValue string
		if json.Unmarshal(rawValue, &pathValue) != nil {
			continue
		}
		normalizedPath, normalizeError := settings.NormalizeDataPath(pathValue)
		if normalizeError != nil || normalizedPath == pathValue {
			continue
		}
		input.Changes[key], _ = json.Marshal(normalizedPath)
	}
	if rawValue, found := input.Changes["rpc.compatibilityEnabled"]; found {
		var enabled bool
		if json.Unmarshal(rawValue, &enabled) == nil && enabled {
			connections, err := server.store.ListVPNConnections(request.Context())
			if err != nil {
				server.logInternalError("list VPN connections for RPC proxy", err)
				writeInternalError(responseWriter)

				return
			}
			if len(connections) == 0 {
				writeError(
					responseWriter,
					http.StatusConflict,
					"vpn_connection_required",
					"Add a VPN connection before turning on the RPC proxy.",
				)

				return
			}
		}
	}

	requestPrincipal := principalFromContext(request.Context())
	actor := requestPrincipal.Kind + ":" + requestPrincipal.Identifier
	server.transmissionSettingsMutex.Lock()
	defer server.transmissionSettingsMutex.Unlock()

	_, err := server.store.UpdateSettings(
		request.Context(),
		server.registry,
		*input.ExpectedRevision,
		input.Changes,
		actor,
	)
	if errors.Is(err, storage.ErrRevisionConflict) {
		writeError(responseWriter, http.StatusConflict, "revision_conflict", "Settings changed since this revision. Refresh and try again.")

		return
	}

	if errors.Is(err, storage.ErrSettingLocked) {
		writeError(responseWriter, http.StatusConflict, "setting_locked", "A changed setting is locked by managed configuration.")

		return
	}
	var folderConflict *storage.TorrentProfileFolderConflict
	if errors.As(err, &folderConflict) {
		writeFieldError(
			responseWriter,
			http.StatusConflict,
			"profile_folder_taken",
			"changes.transmission.downloadDirectory",
			torrentProfileFolderConflictMessage(folderConflict),
		)

		return
	}

	if errors.Is(err, storage.ErrVPNConnectionRequired) {
		writeError(
			responseWriter,
			http.StatusConflict,
			"vpn_connection_required",
			"Add a VPN connection before turning on the RPC proxy.",
		)

		return
	}

	if err != nil {
		if isSettingValidationError(err) {
			writeIssues(responseWriter, []validationIssue{settingIssue(err)})

			return
		}

		server.logInternalError("update settings", err)
		writeError(responseWriter, http.StatusInternalServerError, "settings_failed", "Settings could not be updated.")

		return
	}
	server.rememberTransmissionRestartKeys(request.Context(), input.Changes)

	snapshot, err := server.store.EffectiveConfiguration(request.Context(), server.registry)
	if err != nil {
		server.logInternalError("read updated settings", err)
		writeError(responseWriter, http.StatusInternalServerError, "settings_unavailable", "Updated settings are unavailable.")

		return
	}
	rpcCompatibilityAllowed, err := rpcCompatibilitySetting(snapshot)
	if err != nil {
		server.logInternalError("refresh compatible RPC setting", err)
		writeError(responseWriter, http.StatusInternalServerError, "settings_unavailable", "Updated settings are unavailable.")

		return
	}
	server.rpcCompatibilityAllowed.Store(rpcCompatibilityAllowed)
	if storageDirectorySettingsChanged(input.Changes) {
		server.ensureConfiguredStorageDirectories(context.WithoutCancel(request.Context()), snapshot)
	}
	if err := server.publishTransmissionConfiguration(request.Context()); err != nil {
		server.logInternalError("publish Transmission configuration after settings save", err)
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"settings_update_deferred",
			"The settings were saved, but the Transmission runtime update could not be published.",
		)

		return
	}

	runtimeApply := server.applyLiveTransmissionSettings(request, input.Changes)
	writeJSON(responseWriter, http.StatusOK, struct {
		storage.ConfigurationSnapshot
		RuntimeApply       settingsRuntimeApply `json:"runtimeApply"`
		PendingRestartKeys []string             `json:"pendingRestartKeys"`
	}{
		ConfigurationSnapshot: snapshot,
		RuntimeApply:          runtimeApply,
		PendingRestartKeys:    server.transmissionRestartKeys(request.Context()),
	})
}

// rpcCompatibilitySetting reads the managed-aware compatibility switch from a snapshot.
//
// Startup and successful settings saves use the same decoder so RPC requests can check
// the current value without querying SQLite before authentication.
func rpcCompatibilitySetting(snapshot storage.ConfigurationSnapshot) (bool, error) {
	for _, setting := range snapshot.Settings {
		if setting.Key != "rpc.compatibilityEnabled" {
			continue
		}

		var enabled bool
		if err := json.Unmarshal(setting.Value, &enabled); err != nil {
			return false, err
		}

		return enabled, nil
	}

	return false, errors.New("compatible RPC setting is not registered")
}

// rememberTransmissionRestartKeys accumulates restart-impact keys from a saved request.
//
// With no running daemon, the published configuration is sufficient for the next
// start and there is no restart action to offer.
//
// Since: 2.0.0
func (server *Server) rememberTransmissionRestartKeys(
	ctx context.Context,
	changes storage.SettingChanges,
) {
	if len(server.transmissionDaemons(ctx)) == 0 {
		server.clearAllTransmissionRestartKeys()

		return
	}

	server.pendingRestartMutex.Lock()
	defer server.pendingRestartMutex.Unlock()

	for key := range changes {
		definition, found := server.registry.Definition(key)
		if found && definition.ApplyImpact == settings.ApplyImpactTransmissionRestart {
			server.pendingRestartKeys[key] = struct{}{}
		}
	}
}

// addTransmissionPendingKeys retains live keys that one or more daemons missed.
//
// Since: 2.0.0
func (server *Server) addTransmissionPendingKeys(ctx context.Context, keys []string) {
	if len(server.transmissionDaemons(ctx)) == 0 {
		server.clearAllTransmissionRestartKeys()

		return
	}

	server.pendingRestartMutex.Lock()
	for _, key := range keys {
		server.pendingRestartKeys[key] = struct{}{}
	}
	server.pendingRestartMutex.Unlock()
}

// transmissionRestartKeys returns the current set in deterministic API order.
//
// An empty daemon set also clears stale process-local state so later reads cannot
// offer a restart that has no running target.
//
// Since: 2.0.0
func (server *Server) transmissionRestartKeys(ctx context.Context) []string {
	if len(server.transmissionDaemons(ctx)) == 0 {
		server.clearAllTransmissionRestartKeys()

		return []string{}
	}

	server.pendingRestartMutex.RLock()
	defer server.pendingRestartMutex.RUnlock()

	keys := make([]string, 0, len(server.pendingRestartKeys))
	for key := range server.pendingRestartKeys {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	return keys
}

// clearTransmissionRestartKeys records the pending keys included in one restart.
//
// Since: 2.0.0
func (server *Server) clearTransmissionRestartKeys(keys []string) {
	server.pendingRestartMutex.Lock()
	for _, key := range keys {
		delete(server.pendingRestartKeys, key)
	}
	server.pendingRestartMutex.Unlock()
}

// clearAllTransmissionRestartKeys removes restart work with no running target.
//
// Saved configuration remains authoritative for daemons that start later, so these
// process-local keys no longer represent pending administrator action.
//
// Since: 2.0.0
func (server *Server) clearAllTransmissionRestartKeys() {
	server.pendingRestartMutex.Lock()
	for key := range server.pendingRestartKeys {
		delete(server.pendingRestartKeys, key)
	}
	server.pendingRestartMutex.Unlock()
}

// settingIssue points the validation issue at the setting that failed, which the
// storage error names as "setting <key>: <reason>".
func settingIssue(err error) validationIssue {
	key, message, found := strings.Cut(strings.TrimPrefix(err.Error(), "setting "), ": ")
	if !found || strings.Contains(key, " ") {
		return newFieldIssue("changes", err.Error())
	}

	return validationIssue{
		Field:   "changes." + key,
		Path:    []string{"changes", key},
		Message: message,
	}
}

// isSettingValidationError distinguishes input validation from storage failures.
//
// Registry failures are currently wrapped with the setting key; this conservative
// check keeps internal SQL details out of client-visible responses.
func isSettingValidationError(err error) bool {
	return strings.HasPrefix(err.Error(), "setting ") &&
		!errors.Is(err, storage.ErrSettingLocked)
}
