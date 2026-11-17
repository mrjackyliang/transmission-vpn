// Package appstate resolves the persistent paths supplied by Nova's Docker contract.
//
// Container commands share this package so legacy /data fallback and the normal
// /config layout cannot drift between the control plane and Transmission services.
package appstate

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	defaultStateDirectory            = "/config"
	databaseDirectoryEnvironment     = "NOVA_DATABASE_DIRECTORY"
	installationKeyFileEnvironment   = "NOVA_INSTALLATION_KEY_FILE"
	novaStateDirectoryEnvironment    = "NOVA_STATE_DIRECTORY"
	projectStateDirectoryEnvironment = "TRANSMISSION_VPN_STATE_DIRECTORY"
)

// DatabaseDirectory returns the directory Nova prepared for SQLite state.
//
// Direct process runs fall back to the standard database folder beneath the
// resolved state root, while generated services receive the explicit Nova path.
//
// Since: 2.4.0
func DatabaseDirectory() string {
	if directory := strings.TrimSpace(os.Getenv(databaseDirectoryEnvironment)); directory != "" {
		return directory
	}

	return filepath.Join(StateDirectory(), "database")
}

// DatabaseFile returns the versioned application database path.
//
// Keeping the file name fixed lets the container migrate the former app folder
// without changing storage.Open or exposing a deployment setting.
//
// Since: 2.4.0
func DatabaseFile() string {
	return filepath.Join(DatabaseDirectory(), "state.sqlite3")
}

// InstallationKeyFile returns the key file Nova advertises to the application.
//
// The explicit environment value wins so the app never guesses a different key
// path from the one whose parent Nova owns and protects.
//
// Since: 2.4.0
func InstallationKeyFile() string {
	if path := strings.TrimSpace(os.Getenv(installationKeyFileEnvironment)); path != "" {
		return path
	}

	return filepath.Join(StateDirectory(), "keys", "installation.key")
}

// ManagedConfigFile returns the optional deployment document beneath app state.
//
// The managed document remains an application-specific file at the state root
// while keys and database files use Nova's standard subdirectories.
//
// Since: 2.4.0
func ManagedConfigFile() string {
	return filepath.Join(StateDirectory(), "managed.json")
}

// StateDirectory returns the active app-state root selected during initialization.
//
// Nova writes the project alias for generated services and also publishes its
// generic variable; /config remains the safe default for direct process runs.
//
// Since: 2.4.0
func StateDirectory() string {
	if directory := strings.TrimSpace(os.Getenv(projectStateDirectoryEnvironment)); directory != "" {
		return directory
	}
	if directory := strings.TrimSpace(os.Getenv(novaStateDirectoryEnvironment)); directory != "" {
		return directory
	}

	return defaultStateDirectory
}

// TransmissionDirectory returns the per-connection daemon state root.
//
// The directory follows Nova's resolved state location so an old /data-only run
// line remains usable until its host mount moves to /config.
//
// Since: 2.4.0
func TransmissionDirectory() string {
	return filepath.Join(StateDirectory(), "transmission")
}
