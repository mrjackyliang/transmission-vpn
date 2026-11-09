package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestBlocklistEndpointsEnforceAuthCSRFConflictsAndOrdering covers the HTTP contract.
//
// Disabled and empty-source updates return their distinct conflicts, valid updates
// return 202, and status output follows saved source order with unseen sources pending.
//
// Since: UNRELEASED
func TestBlocklistEndpointsEnforceAuthCSRFConflictsAndOrdering(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	unauthenticated := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/blocklists",
		"",
		nil,
		"",
	)
	if unauthenticated.Code != http.StatusUnauthorized {
		testingObject.Fatalf("unauthenticated status = %d", unauthenticated.Code)
	}

	disabled := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/blocklists/update",
		"{}",
		cookies,
		csrfToken,
	)
	expectError(
		testingObject,
		disabled,
		http.StatusConflict,
		"blocklists_disabled",
		"Turn on blocklists before updating them.",
	)
	withoutCSRF := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/blocklists/update",
		"{}",
		cookies,
		"",
	)
	if withoutCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("missing-CSRF status = %d: %s", withoutCSRF.Code, withoutCSRF.Body.String())
	}

	setBlocklistSettingsForTest(testingObject, server, true, []string{}, 24)
	empty := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/blocklists/update",
		"{}",
		cookies,
		csrfToken,
	)
	expectError(
		testingObject,
		empty,
		http.StatusConflict,
		"blocklist_sources_empty",
		"Add a blocklist source before updating.",
	)

	sources := []string{
		"https://one.example/list",
		"https://two.example/list.gz",
		"https://three.example/list.zip",
	}
	setBlocklistSettingsForTest(testingObject, server, true, sources, 12)
	updatedAt := time.Date(2026, 11, 5, 18, 0, 0, 0, time.UTC)
	if err := blocklist.WriteJSON(filepath.Join(
		server.runtimeDirectory,
		"transmission-state",
		blocklist.StatusFileName,
	), blocklist.Status{
		State: "idle",
		Sources: []blocklist.SourceStatus{{
			URL: sources[1], State: "ok", Ranges: 42, UpdatedAt: &updatedAt,
		}},
		TotalRanges: 42,
	}, 0o640); err != nil {
		testingObject.Fatalf("write blocklist status: %v", err)
	}
	_, torrentsToken := createTestToken(
		testingObject,
		server,
		cookies,
		csrfToken,
		`{"name":"Torrent reader","scopes":["torrents:read"]}`,
	)
	expectError(
		testingObject,
		bearerRequest(server, http.MethodGet, "/api/v1/blocklists", torrentsToken),
		http.StatusForbidden,
		"scope_required",
		"This token doesn't have the settings:read scope.",
	)
	_, settingsToken := createTestToken(
		testingObject,
		server,
		cookies,
		csrfToken,
		`{"name":"Settings reader","scopes":["settings:read"]}`,
	)
	if scopedStatus := bearerRequest(
		server,
		http.MethodGet,
		"/api/v1/blocklists",
		settingsToken,
	); scopedStatus.Code != http.StatusOK {
		testingObject.Fatalf(
			"settings-scoped blocklist status = %d: %s",
			scopedStatus.Code,
			scopedStatus.Body.String(),
		)
	}
	statusResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/blocklists",
		"",
		cookies,
		"",
	)
	if statusResponse.Code != http.StatusOK {
		testingObject.Fatalf("status response = %d: %s", statusResponse.Code, statusResponse.Body.String())
	}
	var status blocklist.Status
	decodeBody(testingObject, statusResponse, &status)
	if len(status.Sources) != 3 ||
		status.Sources[0].URL != sources[0] || status.Sources[0].State != "pending" ||
		status.Sources[1].URL != sources[1] || status.Sources[1].Ranges != 42 ||
		status.Sources[2].URL != sources[2] || status.Sources[2].State != "pending" {
		testingObject.Fatalf("ordered status sources = %#v", status.Sources)
	}

	requestTime := time.Date(2026, 11, 5, 18, 1, 0, 0, time.UTC)
	server.blocklistClock = func() time.Time { return requestTime }
	accepted := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/blocklists/update",
		"{}",
		cookies,
		csrfToken,
	)
	if accepted.Code != http.StatusAccepted {
		testingObject.Fatalf("accepted update = %d: %s", accepted.Code, accepted.Body.String())
	}
	configuration, err := blocklist.ReadConfiguration(filepath.Join(
		server.runtimeDirectory,
		"transmission-config",
		blocklist.ConfigurationFileName,
	))
	if err != nil {
		testingObject.Fatalf("read requested configuration: %v", err)
	}
	if configuration.UpdateRequestedAt == nil ||
		!configuration.UpdateRequestedAt.Equal(requestTime) ||
		configuration.UpdateIntervalHours != 12 {
		testingObject.Fatalf("requested configuration = %#v", configuration)
	}
}

// TestRPCFacadeReportsInterruptedBlocklistUpdate covers the VPN-loss result contract.
//
// A waiting status carrying the current manual marker must return a Transmission result
// error and no zero blocklist-size success payload to compatible remote applications.
//
// Since: UNRELEASED
func TestRPCFacadeReportsInterruptedBlocklistUpdate(testingObject *testing.T) {
	server, _, _ := newClaimedTestServer(testingObject)
	source := "https://blocklist.example/list"
	setBlocklistSettingsForTest(testingObject, server, true, []string{source}, 24)
	server.blocklistPollInterval = time.Millisecond
	server.blocklistUpdateTimeout = time.Second
	statusWritten := make(chan error, 1)
	go func() {
		configurationPath := filepath.Join(
			server.runtimeDirectory,
			"transmission-config",
			blocklist.ConfigurationFileName,
		)
		deadline := time.Now().Add(time.Second)
		for time.Now().Before(deadline) {
			configuration, err := blocklist.ReadConfiguration(configurationPath)
			if err == nil && configuration.UpdateRequestedAt != nil {
				requestedAt := configuration.UpdateRequestedAt.UTC()
				statusWritten <- blocklist.WriteJSON(filepath.Join(
					server.runtimeDirectory,
					"transmission-state",
					blocklist.StatusFileName,
				), blocklist.Status{
					State:             "waiting-for-vpn",
					UpdateRequestedAt: &requestedAt,
					Sources: []blocklist.SourceStatus{{
						URL: source, State: "pending",
					}},
				}, 0o640)

				return
			}
			time.Sleep(time.Millisecond)
		}
		statusWritten <- fmt.Errorf("blocklist request marker was not published")
	}()

	arguments, result := server.callRPCFacade(
		context.Background(),
		"blocklist-update",
		map[string]any{},
	)
	if err := <-statusWritten; err != nil {
		testingObject.Fatalf("publish interrupted blocklist status: %v", err)
	}
	if result != "blocklist update failed: VPN protection was lost before the blocklist update completed" {
		testingObject.Fatalf("interrupted facade result = %q", result)
	}
	if response, ok := arguments.(map[string]any); !ok {
		testingObject.Fatalf("interrupted facade arguments = %#v", arguments)
	} else if _, found := response["blocklist-size"]; found {
		testingObject.Fatalf("interrupted facade returned a blocklist size: %#v", response)
	}
}

// setBlocklistSettingsForTest commits and republishes one complete merger setting set.
//
// Direct storage mutation keeps endpoint tests focused while still exercising the
// production publisher that hands desired state to the runner.
//
// Since: UNRELEASED
func setBlocklistSettingsForTest(
	testingObject *testing.T,
	server *Server,
	enabled bool,
	sources []string,
	interval int,
) {
	testingObject.Helper()
	snapshot, err := server.store.EffectiveConfiguration(context.Background(), server.registry)
	if err != nil {
		testingObject.Fatalf("read settings for blocklist test: %v", err)
	}
	enabledValue, _ := json.Marshal(enabled)
	sourcesValue, _ := json.Marshal(sources)
	intervalValue, _ := json.Marshal(interval)
	_, err = server.store.UpdateSettings(
		context.Background(),
		server.registry,
		snapshot.Revision,
		storage.SettingChanges{
			"transmission.blocklistEnabled":             enabledValue,
			"transmission.blocklistSources":             sourcesValue,
			"transmission.blocklistUpdateIntervalHours": intervalValue,
		},
		"test:blocklists",
	)
	if err != nil {
		testingObject.Fatalf("save blocklist settings: %v", err)
	}
	if err := server.publishTransmissionConfiguration(context.Background()); err != nil {
		testingObject.Fatalf("publish blocklist settings: %v", err)
	}
}
