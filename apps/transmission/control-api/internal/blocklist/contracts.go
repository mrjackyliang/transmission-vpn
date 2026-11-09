// Package blocklist defines the file contract shared by the control API and runner.
//
// The API publishes desired sources while the unprivileged runner reports the copy
// currently in use, keeping download ownership out of the HTTP process.
package blocklist

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	// ConfigurationFileName is the API-to-runner desired-state artifact.
	//
	// It lives in the existing group-readable Transmission hand-off directory and is
	// replaced atomically with every relevant settings change or manual request.
	//
	// Since: UNRELEASED
	ConfigurationFileName = "blocklists.json"

	// StatusFileName is the runner-to-API observed-state artifact.
	//
	// It lives in the existing Transmission-owned state directory and is replaced
	// atomically whenever the merger's externally visible state changes.
	//
	// Since: UNRELEASED
	StatusFileName = "blocklists.json"
)

// Configuration is the complete blocklist configuration published to the runner.
//
// UpdateRequestedAt is preserved across ordinary settings publication and changes
// only when an API or compatible RPC caller explicitly requests an update.
//
// Since: UNRELEASED
type Configuration struct {
	Enabled             bool       `json:"enabled"`
	Sources             []string   `json:"sources"`
	UpdateIntervalHours int        `json:"updateIntervalHours"`
	UpdateRequestedAt   *time.Time `json:"updateRequestedAt,omitempty"`
}

// SourceStatus describes the last usable copy for one configured source.
//
// A failed refresh can retain ranges and UpdatedAt from the last good copy while
// CopyFrom makes that fallback explicit to API clients.
//
// Since: UNRELEASED
type SourceStatus struct {
	URL       string     `json:"url"`
	State     string     `json:"state"`
	Ranges    int        `json:"ranges"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
	Error     string     `json:"error,omitempty"`
	CopyFrom  *time.Time `json:"copyFrom,omitempty"`
}

// Status is the runner's complete blocklist merger state.
//
// Its timestamps describe attempts and successful merged copies, while TotalRanges
// counts exactly the normalized ranges left in use across configured sources.
//
// Since: UNRELEASED
type Status struct {
	State             string         `json:"state"`
	LastAttemptAt     *time.Time     `json:"lastAttemptAt,omitempty"`
	LastSuccessAt     *time.Time     `json:"lastSuccessAt,omitempty"`
	NextUpdateAt      *time.Time     `json:"nextUpdateAt,omitempty"`
	UpdateRequestedAt *time.Time     `json:"updateRequestedAt,omitempty"`
	Error             string         `json:"error,omitempty"`
	TotalRanges       int            `json:"totalRanges"`
	Sources           []SourceStatus `json:"sources"`
}

// ReadConfiguration decodes one complete API-published configuration artifact.
//
// A missing or malformed file is returned as an error so the runner cannot act on a
// partial desired state.
//
// Since: UNRELEASED
func ReadConfiguration(path string) (Configuration, error) {
	var configuration Configuration
	if err := readJSON(path, &configuration); err != nil {
		return Configuration{}, fmt.Errorf("read blocklist configuration: %w", err)
	}
	if configuration.Sources == nil {
		return Configuration{}, fmt.Errorf("blocklist sources must be a JSON array")
	}
	if configuration.UpdateIntervalHours < 1 || configuration.UpdateIntervalHours > 168 {
		return Configuration{}, fmt.Errorf("blocklist update interval must be between 1 and 168 hours")
	}

	return configuration, nil
}

// ReadStatus decodes one complete runner-published status artifact.
//
// Callers receive the original filesystem error when no first status exists, allowing
// the API to translate that startup window into pending sources.
//
// Since: UNRELEASED
func ReadStatus(path string) (Status, error) {
	var status Status
	if err := readJSON(path, &status); err != nil {
		return Status{}, err
	}
	if status.Sources == nil {
		status.Sources = []SourceStatus{}
	}

	return status, nil
}

// SourceFileName returns the stable runner-owned filename for one source URL.
//
// Hashing avoids leaking path syntax into daemon directories while preserving the
// same last-good copy across restarts and source reordering.
//
// Since: UNRELEASED
func SourceFileName(sourceURL string) string {
	digest := sha256.Sum256([]byte(sourceURL))

	return "tvpn-" + hex.EncodeToString(digest[:8]) + ".txt"
}

// WriteJSON atomically publishes a shared blocklist contract with the requested mode.
//
// The temporary file is created beside its destination so rename never crosses a
// filesystem boundary, and incomplete content is removed on every failure.
//
// Since: UNRELEASED
func WriteJSON(path string, value any, mode os.FileMode) error {
	content, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode blocklist artifact: %w", err)
	}
	content = append(content, '\n')

	directory := filepath.Dir(path)
	temporaryFile, err := os.CreateTemp(directory, ".blocklists-*")
	if err != nil {
		return fmt.Errorf("create blocklist artifact: %w", err)
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
		return fmt.Errorf("set blocklist artifact permissions: %w", err)
	}
	if _, err := temporaryFile.Write(content); err != nil {
		return fmt.Errorf("write blocklist artifact: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync blocklist artifact: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close blocklist artifact: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish blocklist artifact: %w", err)
	}
	committed = true

	return nil
}

// readJSON decodes one JSON artifact and rejects trailing non-whitespace content.
//
// File contracts are replaced atomically, so any decode failure represents an invalid
// complete artifact rather than an in-progress writer.
//
// Since: UNRELEASED
func readJSON(path string, destination any) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(content, destination); err != nil {
		return fmt.Errorf("decode %s: %w", filepath.Base(path), err)
	}

	return nil
}
