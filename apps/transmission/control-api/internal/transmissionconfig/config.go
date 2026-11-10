package transmissionconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// Directories are the daemon-owned storage paths that must exist before startup.
type Directories struct {
	Download          string
	Incomplete        string
	IncompleteEnabled bool
}

// Render converts the effective application configuration into Transmission's native
// settings.json contract.
//
// Security-owned keys keep RPC on loopback, disable executable hooks and router port
// mapping, and leave native blocklist fetching empty. The protected runner merger is
// therefore the only component allowed to download sources.
//
// Since: 2.0.0
func Render(snapshot storage.ConfigurationSnapshot) ([]byte, error) {
	values := make(map[string]json.RawMessage, len(snapshot.Settings))
	for _, setting := range snapshot.Settings {
		values[setting.Key] = setting.Value
	}

	downloadDirectory, err := decodeString(values, "transmission.downloadDirectory")
	if err != nil {
		return nil, err
	}
	incompleteDirectory, err := decodeString(values, "transmission.incompleteDirectory")
	if err != nil {
		return nil, err
	}
	incompleteDirectoryEnabled, err := decodeBoolean(
		values,
		"transmission.incompleteDirectoryEnabled",
	)
	if err != nil {
		return nil, err
	}
	downloadQueueEnabled, err := decodeBoolean(values, "transmission.downloadQueueEnabled")
	if err != nil {
		return nil, err
	}
	downloadQueueSize, err := decodeInteger(values, "transmission.downloadQueueSize")
	if err != nil {
		return nil, err
	}
	peerLimitGlobal, err := decodeInteger(values, "transmission.peerLimitGlobal")
	if err != nil {
		return nil, err
	}
	peerPortRandomOnStart, err := decodeBoolean(
		values,
		"transmission.peerPortRandomOnStart",
	)
	if err != nil {
		return nil, err
	}
	peerPortRandomLow, err := decodeInteger(values, "transmission.peerPortRandomLow")
	if err != nil {
		return nil, err
	}
	peerPortRandomHigh, err := decodeInteger(values, "transmission.peerPortRandomHigh")
	if err != nil {
		return nil, err
	}
	blocklistEnabled, err := decodeBoolean(values, "transmission.blocklistEnabled")
	if err != nil {
		return nil, err
	}
	blocklistSources, err := decodeStringList(values, "transmission.blocklistSources")
	if err != nil {
		return nil, err
	}

	if len(blocklistSources) == 0 {
		blocklistEnabled = false
	}

	nativeSettings := map[string]any{
		"bind-address-ipv6":                   "::1",
		"blocklist-enabled":                   blocklistEnabled,
		"blocklist-url":                       "",
		"dht-enabled":                         true,
		"download-dir":                        downloadDirectory,
		"download-queue-enabled":              downloadQueueEnabled,
		"download-queue-size":                 downloadQueueSize,
		"incomplete-dir":                      incompleteDirectory,
		"incomplete-dir-enabled":              incompleteDirectoryEnabled,
		"lpd-enabled":                         false,
		"peer-limit-global":                   peerLimitGlobal,
		"peer-port-random-high":               peerPortRandomHigh,
		"peer-port-random-low":                peerPortRandomLow,
		"peer-port-random-on-start":           peerPortRandomOnStart,
		"pex-enabled":                         true,
		"port-forwarding-enabled":             false,
		"rpc-authentication-required":         false,
		"rpc-enabled":                         true,
		"rpc-host-whitelist":                  "127.0.0.1,localhost",
		"rpc-host-whitelist-enabled":          true,
		"rpc-password":                        "",
		"rpc-url":                             "/transmission/",
		"rpc-username":                        "",
		"rpc-whitelist":                       "127.0.0.1,::1",
		"rpc-whitelist-enabled":               true,
		"script-torrent-added-enabled":        false,
		"script-torrent-done-enabled":         false,
		"script-torrent-done-seeding-enabled": false,
		"utp-enabled":                         true,
	}

	content, err := json.MarshalIndent(nativeSettings, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode Transmission settings: %w", err)
	}

	return append(content, '\n'), nil
}

// SlotBindAddressIPv4 returns the permanent source address for one daemon slot.
//
// The runner writes this address before every daemon start. It does not depend on
// provider state, so a reconnect or provider-address change never restarts a daemon.
//
// Since: 2.0.0
func SlotBindAddressIPv4(slot int) (string, error) {
	if slot < 0 || slot > 63 {
		return "", fmt.Errorf("Transmission slot %d is outside 0 to 63", slot)
	}

	return fmt.Sprintf("198.18.%d.1", slot), nil
}

// Write atomically publishes generated settings with owner-only permissions.
func Write(path string, content []byte) error {
	return write(path, content, 0o600)
}

// WriteShared atomically publishes settings readable by the Transmission group.
//
// The control API uses this for the runner hand-off directory, whose setgid group
// grants the unprivileged Transmission runner read access without making it public.
//
// Since: 2.0.0
func WriteShared(path string, content []byte) error {
	return write(path, content, 0o640)
}

// write publishes generated settings with the requested restrictive permissions.
func write(path string, content []byte, mode os.FileMode) error {
	directory := filepath.Dir(path)
	temporaryFile, err := os.CreateTemp(directory, ".transmission-settings-*")
	if err != nil {
		return fmt.Errorf("create generated Transmission settings: %w", err)
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
		return fmt.Errorf("set generated Transmission settings permissions: %w", err)
	}
	if _, err := temporaryFile.Write(content); err != nil {
		return fmt.Errorf("write generated Transmission settings: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync generated Transmission settings: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close generated Transmission settings: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish generated Transmission settings: %w", err)
	}

	committed = true

	return nil
}

// ReadDirectories validates daemon storage paths from the generated native settings.
func ReadDirectories(path string) (Directories, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Directories{}, fmt.Errorf("read Transmission settings: %w", err)
	}

	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.UseNumber()
	var nativeSettings map[string]json.RawMessage
	if err := decoder.Decode(&nativeSettings); err != nil {
		return Directories{}, fmt.Errorf("decode Transmission settings: %w", err)
	}

	downloadDirectory, err := decodeString(nativeSettings, "download-dir")
	if err != nil {
		return Directories{}, err
	}
	incompleteDirectory, err := decodeString(nativeSettings, "incomplete-dir")
	if err != nil {
		return Directories{}, err
	}
	incompleteEnabled, err := decodeBoolean(nativeSettings, "incomplete-dir-enabled")
	if err != nil {
		return Directories{}, err
	}

	if err := settings.ValidateDataPath(downloadDirectory); err != nil {
		return Directories{}, fmt.Errorf("download directory: %w", err)
	}
	if err := settings.ValidateDataPath(incompleteDirectory); err != nil {
		return Directories{}, fmt.Errorf("incomplete folder: %w", err)
	}

	return Directories{
		Download:          downloadDirectory,
		Incomplete:        incompleteDirectory,
		IncompleteEnabled: incompleteEnabled,
	}, nil
}

// LiveSessionArguments maps application settings that can safely reach a running
// Transmission session without a controlled restart.
//
// Runner-owned live settings are accepted without native RPC arguments because the
// API has already published their complete desired state through the file hand-off.
//
// Since: 2.0.0
func LiveSessionArguments(
	registry settings.Registry,
	changes storage.SettingChanges,
) (map[string]any, []string, error) {
	arguments := map[string]any{}
	pendingKeys := []string{}

	mappings := map[string]string{
		"transmission.blocklistEnabled":           "blocklist-enabled",
		"transmission.downloadDirectory":          "download-dir",
		"transmission.downloadQueueEnabled":       "download-queue-enabled",
		"transmission.downloadQueueSize":          "download-queue-size",
		"transmission.incompleteDirectoryEnabled": "incomplete-dir-enabled",
		"transmission.peerLimitGlobal":            "peer-limit-global",
	}
	applicationLive := map[string]struct{}{
		"transmission.blocklistSources":             {},
		"transmission.blocklistUpdateIntervalHours": {},
	}

	for key, rawValue := range changes {
		definition, found := registry.Definition(key)
		if !found || definition.ApplyImpact != settings.ApplyImpactLive {
			pendingKeys = append(pendingKeys, key)
			continue
		}

		rpcKey, mapped := mappings[key]
		if !mapped {
			if _, handled := applicationLive[key]; handled {
				continue
			}
			pendingKeys = append(pendingKeys, key)
			continue
		}

		var decodedValue any
		decoder := json.NewDecoder(bytes.NewReader(rawValue))
		decoder.UseNumber()
		if err := decoder.Decode(&decodedValue); err != nil {
			return nil, nil, fmt.Errorf("decode live setting %s: %w", key, err)
		}
		arguments[rpcKey] = decodedValue
	}

	return arguments, pendingKeys, nil
}

// RuntimeSessionArguments maps the complete supported Transmission configuration to
// session-set names before a confirmed daemon restart.
//
// Applying the snapshot before session-close lets Transmission persist its own native
// file gracefully; the s6-supervised runner then starts from the same accepted state.
//
// Since: 2.0.0
func RuntimeSessionArguments(
	snapshot storage.ConfigurationSnapshot,
) (map[string]any, error) {
	values := make(map[string]json.RawMessage, len(snapshot.Settings))
	for _, setting := range snapshot.Settings {
		values[setting.Key] = setting.Value
	}

	arguments := map[string]any{}
	mappings := map[string]string{
		"transmission.blocklistEnabled":           "blocklist-enabled",
		"transmission.downloadDirectory":          "download-dir",
		"transmission.downloadQueueEnabled":       "download-queue-enabled",
		"transmission.downloadQueueSize":          "download-queue-size",
		"transmission.incompleteDirectory":        "incomplete-dir",
		"transmission.incompleteDirectoryEnabled": "incomplete-dir-enabled",
		"transmission.peerLimitGlobal":            "peer-limit-global",
	}
	for settingKey, rpcKey := range mappings {
		rawValue, found := values[settingKey]
		if !found {
			return nil, fmt.Errorf("required setting %s is missing", settingKey)
		}

		var decodedValue any
		decoder := json.NewDecoder(bytes.NewReader(rawValue))
		decoder.UseNumber()
		if err := decoder.Decode(&decodedValue); err != nil {
			return nil, fmt.Errorf("decode setting %s: %w", settingKey, err)
		}
		arguments[rpcKey] = decodedValue
	}

	blocklistSources, err := decodeStringList(values, "transmission.blocklistSources")
	if err != nil {
		return nil, err
	}
	arguments["blocklist-url"] = ""
	if len(blocklistSources) == 0 {
		arguments["blocklist-enabled"] = false
	}

	arguments["lpd-enabled"] = false
	arguments["port-forwarding-enabled"] = false

	return arguments, nil
}

// ValidateDataPath exposes the storage-root rule to app-facing RPC validation.
func ValidateDataPath(path string) error {
	return settings.ValidateDataPath(path)
}

// NormalizeDataPath exposes trailing-slash normalization to app-facing RPC routes.
func NormalizeDataPath(path string) (string, error) {
	return settings.NormalizeDataPath(path)
}

func decodeString(values map[string]json.RawMessage, key string) (string, error) {
	value, found := values[key]
	if !found {
		return "", fmt.Errorf("required setting %s is missing", key)
	}

	var decoded string
	if err := json.Unmarshal(value, &decoded); err != nil {
		return "", fmt.Errorf("setting %s must be a string", key)
	}

	return decoded, nil
}

func decodeBoolean(values map[string]json.RawMessage, key string) (bool, error) {
	value, found := values[key]
	if !found {
		return false, fmt.Errorf("required setting %s is missing", key)
	}

	var decoded bool
	if err := json.Unmarshal(value, &decoded); err != nil {
		return false, fmt.Errorf("setting %s must be a boolean", key)
	}

	return decoded, nil
}

func decodeInteger(values map[string]json.RawMessage, key string) (int64, error) {
	value, found := values[key]
	if !found {
		return 0, fmt.Errorf("required setting %s is missing", key)
	}

	var decoded json.Number
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	if err := decoder.Decode(&decoded); err != nil {
		return 0, fmt.Errorf("setting %s must be an integer", key)
	}

	integer, err := decoded.Int64()
	if err != nil {
		return 0, fmt.Errorf("setting %s must be an integer", key)
	}

	return integer, nil
}

func decodeNumber(values map[string]json.RawMessage, key string) (float64, error) {
	value, found := values[key]
	if !found {
		return 0, fmt.Errorf("required setting %s is missing", key)
	}

	var decoded json.Number
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	if err := decoder.Decode(&decoded); err != nil {
		return 0, fmt.Errorf("setting %s must be a number", key)
	}

	number, err := decoded.Float64()
	if err != nil {
		return 0, fmt.Errorf("setting %s must be a number", key)
	}

	return number, nil
}

func decodeStringList(values map[string]json.RawMessage, key string) ([]string, error) {
	value, found := values[key]
	if !found {
		return nil, fmt.Errorf("required setting %s is missing", key)
	}

	var decoded []string
	if err := json.Unmarshal(value, &decoded); err != nil || decoded == nil {
		return nil, fmt.Errorf("setting %s must be an array of strings", key)
	}

	return decoded, nil
}
