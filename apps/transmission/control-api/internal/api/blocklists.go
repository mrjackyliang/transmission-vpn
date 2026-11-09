package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

var (
	// errBlocklistsDisabled prevents requests that cannot affect native enforcement.
	//
	// Both the versioned API and compatible RPC facade translate this condition at
	// their own protocol boundaries.
	//
	// Since: UNRELEASED
	errBlocklistsDisabled = errors.New("blocklists are disabled")

	// errBlocklistSourcesEmpty prevents an update with no configured input.
	//
	// The runner owns removal for this state, while request callers receive a conflict
	// immediately instead of waiting for work that cannot start.
	//
	// Since: UNRELEASED
	errBlocklistSourcesEmpty = errors.New("blocklist sources are empty")
)

// handleGetBlocklists returns merger status in the saved source order.
//
// A newly saved source absent from the runner artifact is represented as pending, so
// clients never need to reconcile settings and status themselves.
//
// Since: UNRELEASED
func (server *Server) handleGetBlocklists(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	configuration, err := server.effectiveBlocklistConfiguration(request.Context())
	if err != nil {
		server.logInternalError("read blocklist configuration", err)
		writeError(responseWriter, http.StatusInternalServerError, "blocklists_unavailable", "Blocklist status is unavailable.")

		return
	}

	status, err := server.readBlocklistStatus()
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		server.logInternalError("read blocklist status", err)
		writeError(responseWriter, http.StatusInternalServerError, "blocklists_unavailable", "Blocklist status is unavailable.")

		return
	}
	status = translateBlocklistStatus(configuration, status)
	writeJSON(responseWriter, http.StatusOK, status)
}

// handleUpdateBlocklists publishes a new merger request timestamp.
//
// Session and CSRF enforcement happen in the route wrapper; this handler validates
// that useful work exists and answers before the runner begins downloading.
//
// Since: UNRELEASED
func (server *Server) handleUpdateBlocklists(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	requestedAt, err := server.requestBlocklistUpdate(request.Context())
	if err != nil {
		switch {
		case errors.Is(err, errBlocklistsDisabled):
			writeError(responseWriter, http.StatusConflict, "blocklists_disabled", "Turn on blocklists before updating them.")
		case errors.Is(err, errBlocklistSourcesEmpty):
			writeError(responseWriter, http.StatusConflict, "blocklist_sources_empty", "Add a blocklist source before updating.")
		default:
			server.logInternalError("request blocklist update", err)
			writeError(responseWriter, http.StatusInternalServerError, "blocklist_update_unavailable", "The blocklist update couldn't be requested.")
		}

		return
	}

	writeJSON(responseWriter, http.StatusAccepted, map[string]any{
		"updateRequestedAt": requestedAt,
	})
}

// effectiveBlocklistConfiguration renders settings without changing a request timestamp.
//
// The registry-backed snapshot is authoritative for enablement, sources, and interval;
// timestamp preservation is only needed when the artifact is written.
//
// Since: UNRELEASED
func (server *Server) effectiveBlocklistConfiguration(
	ctx context.Context,
) (blocklist.Configuration, error) {
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return blocklist.Configuration{}, err
	}

	return blocklistConfigurationFromSnapshot(snapshot)
}

// blocklistConfigurationFromSnapshot extracts runner settings from effective state.
//
// Keeping storage translation in the API prevents the runner's lightweight shared
// contract package from depending on SQLite-backed control-plane implementation code.
//
// Since: UNRELEASED
func blocklistConfigurationFromSnapshot(
	snapshot storage.ConfigurationSnapshot,
) (blocklist.Configuration, error) {
	configuration := blocklist.Configuration{Sources: []string{}}
	for _, setting := range snapshot.Settings {
		switch setting.Key {
		case "transmission.blocklistEnabled":
			if err := json.Unmarshal(setting.Value, &configuration.Enabled); err != nil {
				return blocklist.Configuration{}, fmt.Errorf("decode blocklist enabled setting: %w", err)
			}
		case "transmission.blocklistSources":
			if err := json.Unmarshal(setting.Value, &configuration.Sources); err != nil {
				return blocklist.Configuration{}, fmt.Errorf("decode blocklist source setting: %w", err)
			}
		case "transmission.blocklistUpdateIntervalHours":
			if err := json.Unmarshal(setting.Value, &configuration.UpdateIntervalHours); err != nil {
				return blocklist.Configuration{}, fmt.Errorf("decode blocklist interval setting: %w", err)
			}
		}
	}
	if configuration.Sources == nil {
		configuration.Sources = []string{}
	}
	if configuration.UpdateIntervalHours == 0 {
		return blocklist.Configuration{}, errors.New("blocklist update interval is missing")
	}

	return configuration, nil
}

// requestBlocklistUpdate atomically publishes a timestamp with current saved settings.
//
// The same mutex serializes ordinary Transmission publication, preventing a settings
// save from restoring an older request marker over this explicit update.
//
// Since: UNRELEASED
func (server *Server) requestBlocklistUpdate(ctx context.Context) (time.Time, error) {
	server.transmissionConfigMutex.Lock()
	defer server.transmissionConfigMutex.Unlock()

	configuration, err := server.effectiveBlocklistConfiguration(ctx)
	if err != nil {
		return time.Time{}, err
	}
	if !configuration.Enabled {
		return time.Time{}, errBlocklistsDisabled
	}
	if len(configuration.Sources) == 0 {
		return time.Time{}, errBlocklistSourcesEmpty
	}

	requestedAt := server.blocklistClock().UTC()
	configuration.UpdateRequestedAt = &requestedAt
	configurationPath := filepath.Join(
		server.runtimeDirectory,
		"transmission-config",
		blocklist.ConfigurationFileName,
	)
	if err := blocklist.WriteJSON(configurationPath, configuration, 0o640); err != nil {
		return time.Time{}, err
	}

	return requestedAt, nil
}

// readBlocklistStatus reads the runner-owned merger artifact.
//
// Keeping path construction inside the server ensures the API and RPC facade observe
// the same status file under tests and in the container.
//
// Since: UNRELEASED
func (server *Server) readBlocklistStatus() (blocklist.Status, error) {
	return blocklist.ReadStatus(filepath.Join(
		server.runtimeDirectory,
		"transmission-state",
		blocklist.StatusFileName,
	))
}

// translateBlocklistStatus overlays runner observations onto the saved source list.
//
// Removed sources disappear immediately, new sources remain pending, and disabled or
// empty configurations expose their effective state before the next runner poll.
//
// Since: UNRELEASED
func translateBlocklistStatus(
	configuration blocklist.Configuration,
	status blocklist.Status,
) blocklist.Status {
	if !configuration.Enabled {
		status.State = "disabled"
	} else if len(configuration.Sources) == 0 {
		status.State = "no-sources"
	} else if status.State == "" {
		status.State = "idle"
	}

	statusByURL := make(map[string]blocklist.SourceStatus, len(status.Sources))
	for _, sourceStatus := range status.Sources {
		statusByURL[sourceStatus.URL] = sourceStatus
	}
	orderedSources := make([]blocklist.SourceStatus, 0, len(configuration.Sources))
	totalRanges := 0
	countedURLs := make(map[string]struct{}, len(configuration.Sources))
	for _, sourceURL := range configuration.Sources {
		sourceStatus, found := statusByURL[sourceURL]
		if !found {
			sourceStatus = blocklist.SourceStatus{URL: sourceURL, State: "pending"}
		}
		orderedSources = append(orderedSources, sourceStatus)
		if _, counted := countedURLs[sourceURL]; !counted {
			totalRanges += sourceStatus.Ranges
			countedURLs[sourceURL] = struct{}{}
		}
	}
	status.Sources = orderedSources
	status.TotalRanges = totalRanges
	if !configuration.Enabled || len(configuration.Sources) == 0 {
		status.TotalRanges = 0
		status.NextUpdateAt = nil
	}

	return status
}

// waitForBlocklistUpdate waits for the runner to finish the requested attempt.
//
// It completes only for a status written at or after this request and returns the
// in-use range count, including retained copies, when every source succeeded.
//
// Since: UNRELEASED
func (server *Server) waitForBlocklistUpdate(
	ctx context.Context,
	requestedAt time.Time,
) (int, error) {
	timeout := time.NewTimer(server.blocklistUpdateTimeout)
	defer timeout.Stop()
	ticker := time.NewTicker(server.blocklistPollInterval)
	defer ticker.Stop()

	for {
		status, err := server.readBlocklistStatus()
		if err == nil && status.State == "disabled" {
			return 0, errBlocklistsDisabled
		}
		if err == nil && status.State == "no-sources" {
			return 0, errBlocklistSourcesEmpty
		}
		if err == nil && status.State == "waiting-for-vpn" &&
			(status.UpdateRequestedAt == nil || !status.UpdateRequestedAt.Before(requestedAt)) {
			return 0, errors.New("VPN protection was lost before the blocklist update completed")
		}
		if err == nil && status.LastAttemptAt != nil && !status.LastAttemptAt.Before(requestedAt) && status.State == "idle" {
			if status.Error != "" {
				return 0, errors.New(status.Error)
			}
			for _, sourceStatus := range status.Sources {
				if sourceStatus.State == "error" {
					message := sourceStatus.Error
					if message == "" {
						message = "one or more sources failed"
					}

					return 0, fmt.Errorf("%s", message)
				}
			}

			return status.TotalRanges, nil
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return 0, err
		}

		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-timeout.C:
			return 0, errors.New("update timed out")
		case <-ticker.C:
		}
	}
}
