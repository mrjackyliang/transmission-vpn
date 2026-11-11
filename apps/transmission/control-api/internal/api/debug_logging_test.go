package api

import (
	"bytes"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestSettingsSaveSwitchesDebugLogging moves the shared log level with the switch and
// logs each move once.
func TestSettingsSaveSwitchesDebugLogging(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	var logOutput bytes.Buffer
	server.logLevel = new(slog.LevelVar)
	server.logger = slog.New(slog.NewJSONHandler(&logOutput, &slog.HandlerOptions{Level: server.logLevel}))

	saveDebugLogging := func(revision string, enabled string) {
		testingObject.Helper()

		response := performRequest(
			testingObject,
			server,
			http.MethodPut,
			"/api/v1/settings",
			`{"expectedRevision":`+revision+`,"changes":{"diagnostics.debugLogging":`+enabled+`}}`,
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusOK {
			testingObject.Fatalf("save debug logging %s status %d: %s", enabled, response.Code, response.Body.String())
		}
	}

	saveDebugLogging("0", "true")
	if server.logLevel.Level() != slog.LevelDebug {
		testingObject.Fatalf("level after turning debug logging on = %v", server.logLevel.Level())
	}
	server.applyDebugLogging(true)
	if count := strings.Count(logOutput.String(), "debug logging is on"); count != 1 {
		testingObject.Fatalf("logged the switch on %d times:\n%s", count, logOutput.String())
	}

	saveDebugLogging("1", "false")
	if server.logLevel.Level() != slog.LevelInfo {
		testingObject.Fatalf("level after turning debug logging off = %v", server.logLevel.Level())
	}
	if !strings.Contains(logOutput.String(), "debug logging is off") {
		testingObject.Fatalf("did not log the switch off:\n%s", logOutput.String())
	}
}

// TestDebugLoggingSettingReadsOffWhenMissing treats a registry without the switch as off.
func TestDebugLoggingSettingReadsOffWhenMissing(testingObject *testing.T) {
	enabled, err := debugLoggingSetting(storage.ConfigurationSnapshot{})
	if err != nil || enabled {
		testingObject.Fatalf("debugLoggingSetting() = %t, %v; want false, nil", enabled, err)
	}
}
