package storage

import (
	"context"
	"reflect"
	"testing"
)

// TestTorrentProfileLabelsMigrationSavesExistingProfileLabels upgrades v15 data.
//
// Existing saved spellings win, Default profile labels precede named profiles, and
// one migration revision advertises every newly imported profile label.
func TestTorrentProfileLabelsMigrationSavesExistingProfileLabels(testingObject *testing.T) {
	ctx := context.Background()
	store := openVersion12Store(testingObject)
	defer store.Close()
	for _, migration := range []string{
		"013_vpn_connections.sql",
		"014_download_subdirectories.sql",
		"015_default_torrent_profile_name.sql",
	} {
		if err := store.applyMigration(ctx, migration); err != nil {
			testingObject.Fatalf("apply %s: %v", migration, err)
		}
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"INSERT INTO torrent_labels (name, created_at) VALUES ('Existing', '2026-01-01T00:00:00Z')",
	); err != nil {
		testingObject.Fatalf("seed saved label: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE torrent_default_profile SET labels_json = '[\"DefaultOnly\",\"PROFILEONLY\"]' WHERE id = 1",
	); err != nil {
		testingObject.Fatalf("seed Default profile labels: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO torrent_profiles (
		   id, name, download_directory, labels_json, start_paused,
		   options_json, match_patterns_json, connection_id, created_at, updated_at
		 ) VALUES (
		   'tpr-migration', 'Migration', '/data/migration', '["existing","ProfileOnly"]', 0,
		   '{}', '[]', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
		 )`,
	); err != nil {
		testingObject.Fatalf("seed named profile labels: %v", err)
	}

	if err := store.applyMigration(ctx, "016_torrent_profile_labels.sql"); err != nil {
		testingObject.Fatalf("apply migration 16: %v", err)
	}
	organization, err := store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read migrated organization: %v", err)
	}
	if organization.Revision != 1 || !reflect.DeepEqual(
		organization.Labels,
		[]string{"DefaultOnly", "Existing", "PROFILEONLY"},
	) {
		testingObject.Fatalf("migrated organization = %+v", organization)
	}
}
