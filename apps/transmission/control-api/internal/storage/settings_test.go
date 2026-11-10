package storage

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
)

// TestSettingsTransactionsAndManagedPrecedence verifies revision and lock semantics.
//
// A lock must override without destroying the administrator's persisted value, which
// becomes effective again after the managed document releases the setting.
func TestSettingsTransactionsAndManagedPrecedence(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	registry := settings.NewRegistry()
	snapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		testingObject.Fatalf("read defaults: %v", err)
	}
	if snapshot.Revision != 0 {
		testingObject.Fatalf("fresh revision = %d, want 0", snapshot.Revision)
	}

	newRevision, err := store.UpdateSettings(
		ctx,
		registry,
		0,
		SettingChanges{
			"transmission.downloadQueueSize": json.RawMessage(`7`),
		},
		"test",
	)
	if err != nil {
		testingObject.Fatalf("update setting: %v", err)
	}
	if newRevision != 1 {
		testingObject.Fatalf("updated revision = %d, want 1", newRevision)
	}

	if _, err := store.UpdateSettings(
		ctx,
		registry,
		0,
		SettingChanges{"transmission.downloadQueueSize": json.RawMessage(`8`)},
		"stale-test",
	); !errors.Is(err, ErrRevisionConflict) {
		testingObject.Fatalf("stale update error = %v, want revision conflict", err)
	}

	managedDocument := &settings.ManagedDocument{
		Version: 1,
		Settings: map[string]settings.ManagedValue{
			"transmission.downloadQueueSize": {
				Mode:  settings.ManagedModeLock,
				Value: json.RawMessage(`5`),
			},
		},
	}
	managedRevision, err := store.ApplyManagedConfiguration(ctx, registry, managedDocument)
	if err != nil {
		testingObject.Fatalf("apply managed lock: %v", err)
	}

	lockedSnapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		testingObject.Fatalf("read locked settings: %v", err)
	}
	lockedSetting := findEffectiveSetting(testingObject, lockedSnapshot, "transmission.downloadQueueSize")
	if string(lockedSetting.Value) != "5" || !lockedSetting.Locked ||
		lockedSetting.Source != "managed-lock" {
		testingObject.Fatalf("unexpected locked setting: %+v", lockedSetting)
	}

	if _, err := store.UpdateSettings(
		ctx,
		registry,
		managedRevision,
		SettingChanges{"transmission.downloadQueueSize": json.RawMessage(`9`)},
		"locked-test",
	); !errors.Is(err, ErrSettingLocked) {
		testingObject.Fatalf("locked update error = %v, want locked", err)
	}

	if _, err := store.ApplyManagedConfiguration(ctx, registry, nil); err != nil {
		testingObject.Fatalf("release managed lock: %v", err)
	}

	releasedSnapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		testingObject.Fatalf("read released settings: %v", err)
	}
	releasedSetting := findEffectiveSetting(testingObject, releasedSnapshot, "transmission.downloadQueueSize")
	if string(releasedSetting.Value) != "7" || releasedSetting.Locked {
		testingObject.Fatalf("persisted value was not restored: %+v", releasedSetting)
	}
}

// TestManagedSeedDoesNotOverwrite verifies one-time managed initialization.
//
// After a seed is consumed, later documents and restarts must not erase a value that
// the administrator changed through the UI.
func TestManagedSeedDoesNotOverwrite(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	registry := settings.NewRegistry()
	document := &settings.ManagedDocument{
		Version: 1,
		Settings: map[string]settings.ManagedValue{
			"transmission.downloadQueueEnabled": {
				Mode:  settings.ManagedModeSeed,
				Value: json.RawMessage(`false`),
			},
		},
	}
	revision, err := store.ApplyManagedConfiguration(ctx, registry, document)
	if err != nil {
		testingObject.Fatalf("apply managed seed: %v", err)
	}

	revision, err = store.UpdateSettings(
		ctx,
		registry,
		revision,
		SettingChanges{"transmission.downloadQueueEnabled": json.RawMessage(`true`)},
		"test",
	)
	if err != nil {
		testingObject.Fatalf("change seeded value: %v", err)
	}

	if _, err := store.ApplyManagedConfiguration(ctx, registry, document); err != nil {
		testingObject.Fatalf("reapply managed seed: %v", err)
	}

	snapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		testingObject.Fatalf("read seeded setting: %v", err)
	}
	setting := findEffectiveSetting(
		testingObject,
		snapshot,
		"transmission.downloadQueueEnabled",
	)
	if string(setting.Value) != "true" || setting.Source != "user" {
		testingObject.Fatalf("seed overwrote user state at revision %d: %+v", revision, setting)
	}
}

// TestEffectiveConfigurationReadsLegacyDataRootSetting keeps startup compatible.
//
// A stored value written by an older release remains readable even though every
// new settings transaction must choose a child folder.
//
// Since: 2.0.0
func TestEffectiveConfigurationReadsLegacyDataRootSetting(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
		 VALUES ('transmission.downloadDirectory', '"/data"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
	); err != nil {
		testingObject.Fatalf("seed legacy setting: %v", err)
	}

	snapshot, err := store.EffectiveConfiguration(ctx, settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read legacy setting: %v", err)
	}
	setting := findEffectiveSetting(
		testingObject,
		snapshot,
		"transmission.downloadDirectory",
	)
	if string(setting.Value) != `"/data"` {
		testingObject.Fatalf("legacy download directory = %s", setting.Value)
	}
}

// TestEffectiveConfigurationReadsStoredIncompleteClash keeps reads lenient.
//
// Relationship rules apply to new writes only; an old clash can never prevent
// startup or the Settings API from exposing the value for cleanup.
//
// Since: 2.0.0
func TestEffectiveConfigurationReadsStoredIncompleteClash(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
		 VALUES ('transmission.downloadDirectory', '"/data/incomplete/legacy"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
	); err != nil {
		testingObject.Fatalf("seed clashing setting: %v", err)
	}

	snapshot, err := store.EffectiveConfiguration(ctx, settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read clashing setting: %v", err)
	}
	setting := findEffectiveSetting(
		testingObject,
		snapshot,
		"transmission.downloadDirectory",
	)
	if string(setting.Value) != `"/data/incomplete/legacy"` {
		testingObject.Fatalf("stored Download directory = %s", setting.Value)
	}
}

// TestManagedStoragePathsUseRelationshipRules covers both declarative modes.
//
// Seeds and locks may differ in precedence, but neither can introduce a Download
// destination inside the incomplete folder or make it contain the default folder.
//
// Since: 2.0.0
func TestManagedStoragePathsUseRelationshipRules(testingObject *testing.T) {
	for _, mode := range []settings.ManagedMode{
		settings.ManagedModeSeed,
		settings.ManagedModeLock,
	} {
		for _, testCase := range []struct {
			name  string
			key   string
			value json.RawMessage
			want  string
		}{
			{
				name:  "Download folder inside incomplete folder",
				key:   "transmission.downloadDirectory",
				value: json.RawMessage(`"/data/incomplete/managed"`),
				want:  "Choose a folder outside the incomplete folder, /data/incomplete.",
			},
			{
				name:  "incomplete folder contains Download folder",
				key:   "transmission.incompleteDirectory",
				value: json.RawMessage(`"/data/downloads"`),
				want:  "“downloads” is the Default profile's folder, so it can't be the incomplete folder.",
			},
		} {
			testingObject.Run(string(mode)+" "+testCase.name, func(testingObject *testing.T) {
				ctx := context.Background()
				store, err := Open(
					ctx,
					filepath.Join(testingObject.TempDir(), "state.sqlite3"),
				)
				if err != nil {
					testingObject.Fatalf("open store: %v", err)
				}
				defer store.Close()

				document := &settings.ManagedDocument{
					Version: 1,
					Settings: map[string]settings.ManagedValue{
						testCase.key: {Mode: mode, Value: testCase.value},
					},
				}
				_, err = store.ApplyManagedConfiguration(
					ctx,
					settings.NewRegistry(),
					document,
				)
				if err == nil || !strings.Contains(err.Error(), testCase.want) {
					testingObject.Fatalf("managed path error = %v", err)
				}
			})
		}
	}
}

// TestDefaultDownloadFolderCannotReuseANamedProfileFolder covers every settings writer.
func TestDefaultDownloadFolderCannotReuseANamedProfileFolder(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000088",
		"Movies",
		"/data/Movies",
	)); err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}
	registry := settings.NewRegistry()
	_, err = store.UpdateSettings(
		ctx,
		registry,
		0,
		SettingChanges{
			"transmission.downloadDirectory": json.RawMessage(`"/data/movies"`),
		},
		"test",
	)
	var conflict *TorrentProfileFolderConflict
	if !errors.As(err, &conflict) || conflict.ProfileName != "Movies" {
		testingObject.Fatalf("settings folder conflict = %#v, %v", conflict, err)
	}

	for _, mode := range []settings.ManagedMode{
		settings.ManagedModeSeed,
		settings.ManagedModeLock,
	} {
		document := &settings.ManagedDocument{
			Version: 1,
			Settings: map[string]settings.ManagedValue{
				"transmission.downloadDirectory": {
					Mode:  mode,
					Value: json.RawMessage(`"/data/MOVIES"`),
				},
			},
		}
		_, err := store.ApplyManagedConfiguration(ctx, registry, document)
		if !errors.As(err, &conflict) || conflict.ProfileName != "Movies" {
			testingObject.Fatalf("managed %s folder conflict = %#v, %v", mode, conflict, err)
		}
	}
}

// TestManagedConfigurationRejectsRetiredPerTorrentDefaults keeps profiles authoritative.
func TestManagedConfigurationRejectsRetiredPerTorrentDefaults(testingObject *testing.T) {
	ctx := context.Background()
	for _, key := range []string{
		"transmission.ratioLimitEnabled",
		"transmission.ratioLimit",
		"transmission.peerLimitPerTorrent",
	} {
		testingObject.Run(key, func(testingObject *testing.T) {
			store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
			if err != nil {
				testingObject.Fatalf("open store: %v", err)
			}
			defer store.Close()

			_, err = store.ApplyManagedConfiguration(
				ctx,
				settings.NewRegistry(),
				&settings.ManagedDocument{
					Version: 1,
					Settings: map[string]settings.ManagedValue{
						key: {Mode: settings.ManagedModeLock, Value: json.RawMessage(`1`)},
					},
				},
			)
			if err == nil || !strings.Contains(err.Error(), "unknown setting") {
				testingObject.Fatalf("retired managed setting error = %v", err)
			}
		})
	}
}

// findEffectiveSetting returns one named setting or fails the current test.
//
// Focused assertions stay readable while a missing registry entry still produces a
// clear test failure.
func findEffectiveSetting(
	testingObject *testing.T,
	snapshot ConfigurationSnapshot,
	key string,
) EffectiveSetting {
	testingObject.Helper()

	for _, setting := range snapshot.Settings {
		if setting.Key == key {
			return setting
		}
	}

	testingObject.Fatalf("setting %s was not found", key)

	return EffectiveSetting{}
}
