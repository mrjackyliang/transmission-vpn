package storage

import (
	"context"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
)

// TestDownloadSubdirectoriesMigrationRewritesDataRootDestinations upgrades v13 data.
//
// Settings return to defaults and profiles keep a usable folder without moving any
// existing torrent data.
//
// Since: 2.0.0
func TestDownloadSubdirectoriesMigrationRewritesDataRootDestinations(testingObject *testing.T) {
	ctx := context.Background()
	store := openVersion12Store(testingObject)
	defer store.Close()

	if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
		testingObject.Fatalf("apply migration 13: %v", err)
	}

	statements := []string{
		`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
		 VALUES ('transmission.downloadDirectory', '"/data"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
		`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
		 VALUES ('transmission.incompleteDirectory', '"/data"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
		`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
		 VALUES ('transmission.downloadQueueSize', '7', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
		`INSERT INTO torrent_profiles (
		   id, name, download_directory, labels_json, start_paused,
		   options_json, match_patterns_json, connection_id, created_at, updated_at
		 ) VALUES (
		   'tpr-root', 'Root profile', '/data', '[]', 0,
		   '{}', '[]', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
		 )`,
		`INSERT INTO torrent_profiles (
		   id, name, download_directory, labels_json, start_paused,
		   options_json, match_patterns_json, connection_id, created_at, updated_at
		 ) VALUES (
		   'tpr-child', 'Child profile', '/data/media', '[]', 0,
		   '{}', '[]', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
		 )`,
	}
	for _, statement := range statements {
		if _, err := store.databaseHandle().ExecContext(ctx, statement); err != nil {
			testingObject.Fatalf("seed version 13 store: %v", err)
		}
	}

	if err := store.applyMigration(ctx, "014_download_subdirectories.sql"); err != nil {
		testingObject.Fatalf("apply migration 14: %v", err)
	}

	snapshot, err := store.EffectiveConfiguration(ctx, settings.NewRegistry())
	if err != nil {
		testingObject.Fatalf("read migrated settings: %v", err)
	}
	for key, expectedValue := range map[string]string{
		"transmission.downloadDirectory":   `"/data/downloads"`,
		"transmission.incompleteDirectory": `"/data/incomplete"`,
	} {
		setting := findEffectiveSetting(testingObject, snapshot, key)
		if string(setting.Value) != expectedValue || setting.Source != "default" {
			testingObject.Fatalf("migrated %s = %+v", key, setting)
		}
	}

	var rootSettingCount int
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM settings
		 WHERE key IN ('transmission.downloadDirectory', 'transmission.incompleteDirectory')`,
	).Scan(&rootSettingCount); err != nil || rootSettingCount != 0 {
		testingObject.Fatalf("root settings count = %d, %v", rootSettingCount, err)
	}

	var queueSize string
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT value_json FROM settings WHERE key = 'transmission.downloadQueueSize'",
	).Scan(&queueSize); err != nil || queueSize != "7" {
		testingObject.Fatalf("preserved queue size = %q, %v", queueSize, err)
	}

	profileDirectories := map[string]string{}
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT id, download_directory FROM torrent_profiles ORDER BY id",
	)
	if err != nil {
		testingObject.Fatalf("read migrated profiles: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var directory string
		if err := rows.Scan(&id, &directory); err != nil {
			testingObject.Fatalf("scan migrated profile: %v", err)
		}
		profileDirectories[id] = directory
	}
	if err := rows.Err(); err != nil {
		testingObject.Fatalf("iterate migrated profiles: %v", err)
	}
	if profileDirectories["tpr-root"] != "/data/downloads" ||
		profileDirectories["tpr-child"] != "/data/media" {
		testingObject.Fatalf("migrated profile directories = %v", profileDirectories)
	}

	version, err := store.SchemaVersion(ctx)
	if err != nil || version != 14 {
		testingObject.Fatalf("schema version = %d, %v", version, err)
	}
}

// TestDownloadSubdirectoriesMigrationCleansIncompleteDirectoryTargets covers v13 clashes.
//
// The effective Download setting resets first, profile destinations follow that
// effective value.
//
// Since: 2.0.0
func TestDownloadSubdirectoriesMigrationCleansIncompleteDirectoryTargets(testingObject *testing.T) {
	testingObject.Run("default remains outside incomplete folder", func(testingObject *testing.T) {
		ctx := context.Background()
		store := openVersion12Store(testingObject)
		defer store.Close()
		if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
			testingObject.Fatalf("apply migration 13: %v", err)
		}

		statements := []string{
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES ('transmission.downloadDirectory', '"/data/staging/complete"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES ('transmission.incompleteDirectory', '"/data/staging"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
			`INSERT INTO torrent_profiles (
			   id, name, download_directory, labels_json, start_paused,
			   options_json, match_patterns_json, connection_id, created_at, updated_at
			 ) VALUES (
			   'tpr-inside', 'Inside', '/data/staging/profile', '[]', 0,
			   '{}', '[]', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
			 )`,
			`INSERT INTO torrent_profiles (
			   id, name, download_directory, labels_json, start_paused,
			   options_json, match_patterns_json, connection_id, created_at, updated_at
			 ) VALUES (
			   'tpr-sibling', 'Sibling', '/data/staging-old/profile', '[]', 0,
			   '{}', '[]', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
			 )`,
		}
		for _, statement := range statements {
			if _, err := store.databaseHandle().ExecContext(ctx, statement); err != nil {
				testingObject.Fatalf("seed version 13 store: %v", err)
			}
		}

		if err := store.applyMigration(ctx, "014_download_subdirectories.sql"); err != nil {
			testingObject.Fatalf("apply migration 14: %v", err)
		}

		snapshot, err := store.EffectiveConfiguration(ctx, settings.NewRegistry())
		if err != nil {
			testingObject.Fatalf("read migrated settings: %v", err)
		}
		downloadSetting := findEffectiveSetting(
			testingObject,
			snapshot,
			"transmission.downloadDirectory",
		)
		if string(downloadSetting.Value) != `"/data/downloads"` ||
			downloadSetting.Source != "default" {
			testingObject.Fatalf("migrated Download directory = %+v", downloadSetting)
		}

		profiles, err := store.ListTorrentProfiles(ctx)
		if err != nil || len(profiles) != 2 {
			testingObject.Fatalf("migrated profiles = %+v, %v", profiles, err)
		}
		profileDirectories := map[string]string{}
		for _, profile := range profiles {
			profileDirectories[profile.ID] = profile.DownloadDirectory
		}
		if profileDirectories["tpr-inside"] != "/data/downloads" ||
			profileDirectories["tpr-sibling"] != "/data/staging-old/profile" {
			testingObject.Fatalf("migrated profile directories = %v", profileDirectories)
		}

	})

	testingObject.Run("default also lies inside incomplete folder", func(testingObject *testing.T) {
		ctx := context.Background()
		store := openVersion12Store(testingObject)
		defer store.Close()
		if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
			testingObject.Fatalf("apply migration 13: %v", err)
		}
		for _, statement := range []string{
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES ('transmission.downloadDirectory', '"/data/downloads/finished"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES ('transmission.incompleteDirectory', '"/data/downloads"', 'user', 0, 1, '2026-01-01T00:00:00Z')`,
		} {
			if _, err := store.databaseHandle().ExecContext(ctx, statement); err != nil {
				testingObject.Fatalf("seed version 13 store: %v", err)
			}
		}

		if err := store.applyMigration(ctx, "014_download_subdirectories.sql"); err != nil {
			testingObject.Fatalf("apply migration 14: %v", err)
		}
		var persistedDownloadDirectory string
		if err := store.databaseHandle().QueryRowContext(
			ctx,
			"SELECT value_json FROM settings WHERE key = 'transmission.downloadDirectory'",
		).Scan(&persistedDownloadDirectory); err != nil ||
			persistedDownloadDirectory != `"/data/downloads/finished"` {
			testingObject.Fatalf(
				"preserved Download directory = %q, %v",
				persistedDownloadDirectory,
				err,
			)
		}
	})
}
