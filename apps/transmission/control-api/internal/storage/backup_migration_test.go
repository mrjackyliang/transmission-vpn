package storage

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
)

// TestBackupImportSourceMigration preserves old jobs and accepts mounted configs.
func TestBackupImportSourceMigration(testingObject *testing.T) {
	ctx := context.Background()
	path := filepath.Join(testingObject.TempDir(), "state.sqlite3")
	database, err := sql.Open("sqlite", "file:"+filepath.ToSlash(path))
	if err != nil {
		testingObject.Fatalf("open database: %v", err)
	}
	execute := func(statement string, arguments ...any) {
		testingObject.Helper()
		if _, err := database.ExecContext(ctx, statement, arguments...); err != nil {
			testingObject.Fatalf("prepare old database: %v\n%s", err, statement)
		}
	}
	execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT")
	for index, name := range []string{
		"001_initial.sql",
		"002_vpn_profiles.sql",
		"003_torrent_organization.sql",
		"004_vpn_endpoint_pools.sql",
		"005_account_security.sql",
		"006_named_tokens.sql",
		"007_removed_secrets.sql",
		"008_notifications.sql",
		"009_vpn_tunnels.sql",
		"010_web_proxy.sql",
		"011_torrent_profiles.sql",
		"012_rpc_logins.sql",
		"013_vpn_connections.sql",
		"014_download_subdirectories.sql",
		"015_default_torrent_profile_name.sql",
		"016_torrent_profile_labels.sql",
		"017_backup_imports.sql",
	} {
		content, readError := migrations.ReadFile("migrations/" + name)
		if readError != nil {
			testingObject.Fatalf("read migration %s: %v", name, readError)
		}
		execute(string(content))
		execute(
			"INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
			index+1,
			name,
			"2026-01-01T00:00:00Z",
		)
	}
	execute(`INSERT INTO backup_import_jobs (
		id, source, status, payload_nonce, payload_ciphertext, total_torrents,
		completed_torrents, summary_json, created_at, updated_at, completed_at
	) VALUES (?, 'transmission-vpn-export', 'completed', NULL, NULL, 1, 1, '{}', ?, ?, ?)`,
		"old-import",
		"2026-01-01T00:00:00Z",
		"2026-01-01T00:01:00Z",
		"2026-01-01T00:01:00Z",
	)
	execute(`INSERT INTO backup_import_items (
		job_id, position, hash, name, profile_name, folder, state, progress, detail, updated_at
	) VALUES (?, 0, ?, ?, ?, ?, 'seeding', 1, '', ?)`,
		"old-import",
		"0123456789abcdef0123456789abcdef01234567",
		"Existing torrent",
		"Default profile",
		"/data/downloads",
		"2026-01-01T00:01:00Z",
	)
	if err := database.Close(); err != nil {
		testingObject.Fatalf("close old database: %v", err)
	}

	store, err := Open(ctx, path)
	if err != nil {
		testingObject.Fatalf("apply source migration: %v", err)
	}
	defer store.Close()
	oldJob, err := store.BackupImportJobByID(ctx, "old-import")
	if err != nil || len(oldJob.Items) != 1 || oldJob.Items[0].State != "seeding" {
		testingObject.Fatalf("preserved job = %+v, %v", oldJob, err)
	}
	newJob, err := store.CreateBackupImportJob(ctx, BackupImportJob{
		ID:                "mounted-import",
		Source:            "another-transmission",
		PayloadNonce:      []byte("nonce"),
		PayloadCiphertext: []byte("ciphertext"),
		Summary:           map[string]any{},
		Items:             []BackupImportItem{},
	})
	if err != nil || newJob.Source != "another-transmission" {
		testingObject.Fatalf("create mounted import = %+v, %v", newJob, err)
	}
}
