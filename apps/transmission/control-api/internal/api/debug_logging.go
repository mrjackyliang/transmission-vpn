package api

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// debugLoggingKey is the setting that switches the control API's log to debug lines.
const debugLoggingKey = "diagnostics.debugLogging"

// debugLoggingSetting reads the managed-aware debug logging switch from a snapshot.
//
// Startup, settings saves, and backup imports share this decoder. A registry without
// the switch reads as off.
//
// Since: 2.1.0
func debugLoggingSetting(snapshot storage.ConfigurationSnapshot) (bool, error) {
	for _, setting := range snapshot.Settings {
		if setting.Key != debugLoggingKey {
			continue
		}

		var enabled bool
		if err := json.Unmarshal(setting.Value, &enabled); err != nil {
			return false, fmt.Errorf("read debug logging setting: %w", err)
		}

		return enabled, nil
	}

	return false, nil
}

// applyDebugLogging moves the shared log level between Info and Debug.
//
// Every switch is logged at Info, so the log shows where the extra detail starts and
// stops. Without a level to move, as in tests, it does nothing.
//
// Since: 2.1.0
func (server *Server) applyDebugLogging(enabled bool) {
	if server.logLevel == nil {
		return
	}

	level := slog.LevelInfo
	if enabled {
		level = slog.LevelDebug
	}
	if server.logLevel.Level() == level {
		return
	}

	server.logLevel.Set(level)
	if enabled {
		server.logger.Info("debug logging is on")
	} else {
		server.logger.Info("debug logging is off")
	}
}
