package transmissionconfig

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestSlotBindAddressIPv4 verifies the closed permanent daemon source mapping.
func TestSlotBindAddressIPv4(testingObject *testing.T) {
	for _, testCase := range []struct {
		slot int
		want string
	}{
		{slot: 0, want: "198.18.0.1"},
		{slot: 63, want: "198.18.63.1"},
	} {
		address, err := SlotBindAddressIPv4(testCase.slot)
		if err != nil || address != testCase.want {
			testingObject.Fatalf("slot %d bind address = %q, %v", testCase.slot, address, err)
		}
	}
	if _, err := SlotBindAddressIPv4(64); err == nil {
		testingObject.Fatal("slot 64 received a bind address")
	}
}

// TestRenderOmitsPerDaemonKeys verifies the runner owns connection-specific values.
//
// Slot addresses and ports remain per daemon, while the native blocklist URL stays
// empty so Transmission cannot bypass the application merger.
//
// Since: UNRELEASED
func TestRenderOmitsPerDaemonKeys(testingObject *testing.T) {
	store, err := storage.Open(
		context.Background(),
		filepath.Join(testingObject.TempDir(), "state.sqlite3"),
	)
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	snapshot, err := store.EffectiveConfiguration(context.Background(), settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read effective configuration: %v", err)
	}
	content, err := Render(snapshot)
	if err != nil {
		testingObject.Fatalf("render settings: %v", err)
	}

	var nativeSettings map[string]any
	if err := json.Unmarshal(content, &nativeSettings); err != nil {
		testingObject.Fatalf("decode rendered settings: %v", err)
	}

	expectations := map[string]any{
		"blocklist-url":               "",
		"download-dir":                "/data/downloads",
		"peer-port-random-high":       float64(65535),
		"peer-port-random-low":        float64(49152),
		"rpc-authentication-required": false,
		"port-forwarding-enabled":     false,
		"lpd-enabled":                 false,
	}
	for key, expected := range expectations {
		if actual := nativeSettings[key]; actual != expected {
			testingObject.Fatalf("%s = %#v, want %#v", key, actual, expected)
		}
	}
	for _, key := range []string{
		"bind-address-ipv4",
		"peer-limit-per-torrent",
		"peer-port",
		"rpc-bind-address",
		"rpc-port",
		"ratio-limit",
		"ratio-limit-enabled",
	} {
		if _, found := nativeSettings[key]; found {
			testingObject.Fatalf("per-daemon key %s was rendered in base settings", key)
		}
	}
}

// TestLiveSessionArgumentsMapsDownloadDirectory covers the Default profile folder.
//
// A saved folder reaches session-set immediately while the incomplete folder keeps
// its controlled-restart boundary.
//
// Since: UNRELEASED
func TestLiveSessionArgumentsMapsDownloadDirectory(testingObject *testing.T) {
	arguments, pendingKeys, err := LiveSessionArguments(
		settings.NewRegistry(),
		storage.SettingChanges{
			"transmission.downloadDirectory":   json.RawMessage(`"/data/new-downloads"`),
			"transmission.incompleteDirectory": json.RawMessage(`"/data/new-incomplete"`),
		},
	)
	if err != nil {
		testingObject.Fatalf("map live session arguments: %v", err)
	}
	if arguments["download-dir"] != "/data/new-downloads" {
		testingObject.Fatalf("download-dir = %#v, want /data/new-downloads", arguments["download-dir"])
	}
	if len(pendingKeys) != 1 || pendingKeys[0] != "transmission.incompleteDirectory" {
		testingObject.Fatalf("pending keys = %#v, want the incomplete folder", pendingKeys)
	}
}

// TestRuntimeSessionArgumentsOmitRunnerPeerPorts keeps runtime ownership separate.
//
// Runner peer ports remain absent and blocklist-url remains empty during controlled
// restarts, preventing native fetching from escaping merger policy.
//
// Since: UNRELEASED
func TestRuntimeSessionArgumentsOmitRunnerPeerPorts(testingObject *testing.T) {
	store, err := storage.Open(
		context.Background(),
		filepath.Join(testingObject.TempDir(), "state.sqlite3"),
	)
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	snapshot, err := store.EffectiveConfiguration(context.Background(), settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read effective configuration: %v", err)
	}
	arguments, err := RuntimeSessionArguments(snapshot)
	if err != nil {
		testingObject.Fatalf("map runtime session arguments: %v", err)
	}
	for _, key := range []string{
		"peer-limit-per-torrent",
		"peer-port",
		"peer-port-random-high",
		"peer-port-random-low",
		"peer-port-random-on-start",
		"seedRatioLimit",
		"seedRatioLimited",
	} {
		if _, found := arguments[key]; found {
			testingObject.Fatalf("runner-owned key %s was sent through session-set", key)
		}
	}
	if arguments["blocklist-url"] != "" {
		testingObject.Fatalf("blocklist-url = %#v, want empty", arguments["blocklist-url"])
	}
}

// TestBlocklistURLStaysEmptyWithConfiguredSources protects merger ownership.
//
// Both generated settings.json and restart-time session arguments must keep native
// Transmission from downloading the first source outside the runner merger.
//
// Since: UNRELEASED
func TestBlocklistURLStaysEmptyWithConfiguredSources(testingObject *testing.T) {
	store, err := storage.Open(
		context.Background(),
		filepath.Join(testingObject.TempDir(), "state.sqlite3"),
	)
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()
	snapshot, err := store.EffectiveConfiguration(context.Background(), settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read effective configuration: %v", err)
	}
	for index := range snapshot.Settings {
		switch snapshot.Settings[index].Key {
		case "transmission.blocklistEnabled":
			snapshot.Settings[index].Value = json.RawMessage(`true`)
		case "transmission.blocklistSources":
			snapshot.Settings[index].Value = json.RawMessage(`[
  "https://one.example/list",
  "https://two.example/list"
]`)
		}
	}

	content, err := Render(snapshot)
	if err != nil {
		testingObject.Fatalf("render configured blocklists: %v", err)
	}
	var nativeSettings map[string]any
	if err := json.Unmarshal(content, &nativeSettings); err != nil {
		testingObject.Fatalf("decode configured blocklists: %v", err)
	}
	if nativeSettings["blocklist-url"] != "" || nativeSettings["blocklist-enabled"] != true {
		testingObject.Fatalf("rendered blocklist settings = %#v", nativeSettings)
	}
	arguments, err := RuntimeSessionArguments(snapshot)
	if err != nil {
		testingObject.Fatalf("map configured blocklists: %v", err)
	}
	if arguments["blocklist-url"] != "" || arguments["blocklist-enabled"] != true {
		testingObject.Fatalf("runtime blocklist arguments = %#v", arguments)
	}
}

// TestReadDirectoriesRejectsPathsOutsideData protects host mount boundaries.
func TestReadDirectoriesRejectsPathsOutsideData(testingObject *testing.T) {
	settingsPath := filepath.Join(testingObject.TempDir(), "settings.json")
	content := []byte(`{
  "download-dir": "/etc",
  "incomplete-dir": "/data/incomplete",
  "incomplete-dir-enabled": true
}`)
	if err := os.WriteFile(settingsPath, content, 0o600); err != nil {
		testingObject.Fatalf("write settings fixture: %v", err)
	}

	if _, err := ReadDirectories(settingsPath); err == nil {
		testingObject.Fatal("ReadDirectories accepted a path outside /data")
	}
}
