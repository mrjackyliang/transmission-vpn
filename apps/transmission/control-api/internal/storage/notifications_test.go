package storage

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

// TestNotificationTargets stores, lists, edits, and removes destinations, and checks
// that names stay unique without regard to letter case.
func TestNotificationTargets(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	phone, err := store.CreateNotificationTarget(ctx, NotificationTarget{
		ID:       "ntf-0000000000000001",
		Name:     "Phone",
		Service:  "ntfy",
		Events:   []string{"vpn-dropped", "torrent-finished"},
		Settings: map[string]string{"url": "https://ntfy.sh/tvpn"},
	})
	if err != nil || len(phone.MissingSecrets) != 0 || phone.CreatedAt.IsZero() {
		testingObject.Fatalf("create phone = %+v, %v", phone, err)
	}

	chat, err := store.CreateNotificationTarget(ctx, NotificationTarget{
		ID:                "ntf-0000000000000002",
		Name:              "Homelab chat",
		Service:           "telegram",
		Events:            []string{"vpn-dropped"},
		Settings:          map[string]string{"chatId": "-100"},
		SecretFields:      []string{"botToken"},
		SecretsNonce:      []byte("nonce"),
		SecretsCiphertext: []byte("sealed"),
	})
	if err != nil {
		testingObject.Fatalf("create chat: %v", err)
	}

	if _, err := store.CreateNotificationTarget(ctx, NotificationTarget{
		ID:       "ntf-0000000000000003",
		Name:     "PHONE",
		Service:  "ntfy",
		Events:   []string{"vpn-dropped"},
		Settings: map[string]string{"url": "https://ntfy.sh/other"},
	}); !errors.Is(err, ErrNotificationNameTaken) {
		testingObject.Fatalf("a repeated name error = %v, want ErrNotificationNameTaken", err)
	}

	targets, err := store.ListNotificationTargets(ctx)
	if err != nil || len(targets) != 2 || targets[0].ID != chat.ID || targets[1].ID != phone.ID {
		testingObject.Fatalf("list = %+v, %v", targets, err)
	}

	if strings.Join(targets[0].SecretFields, ",") != "botToken" || string(targets[0].SecretsCiphertext) != "sealed" ||
		targets[1].Settings["url"] != "https://ntfy.sh/tvpn" || targets[1].LastAttemptAt != nil || targets[1].LastError != nil {
		testingObject.Fatalf("list = %+v", targets)
	}

	failure := "HTTP 502: Bad Gateway"
	if err := store.RecordNotificationAttempt(ctx, phone.ID, &failure); err != nil {
		testingObject.Fatalf("record failure: %v", err)
	}

	failed, err := store.FindNotificationTarget(ctx, phone.ID)
	if err != nil || failed.LastAttemptAt == nil || failed.LastError == nil || *failed.LastError != failure {
		testingObject.Fatalf("after a failed send = %+v, %v", failed, err)
	}

	if err := store.RecordNotificationAttempt(ctx, phone.ID, nil); err != nil {
		testingObject.Fatalf("record success: %v", err)
	}

	if delivered, _ := store.FindNotificationTarget(ctx, phone.ID); delivered.LastError != nil {
		testingObject.Fatalf("a delivered send kept the old error: %+v", delivered)
	}

	if _, err := store.UpdateNotificationTarget(ctx, phone.ID, NotificationTargetChanges{
		Name:     "homelab CHAT",
		Events:   []string{"vpn-dropped"},
		Settings: phone.Settings,
	}); !errors.Is(err, ErrNotificationNameTaken) {
		testingObject.Fatalf("renaming onto another destination's name error = %v", err)
	}

	renamed, err := store.UpdateNotificationTarget(ctx, phone.ID, NotificationTargetChanges{
		Name:     "PHONE",
		Events:   []string{"torrent-error"},
		Settings: map[string]string{"url": "https://ntfy.sh/renamed"},
	})
	if err != nil || renamed.Name != "PHONE" || strings.Join(renamed.Events, ",") != "torrent-error" || renamed.Settings["url"] != "https://ntfy.sh/renamed" {
		testingObject.Fatalf("rename in another case = %+v, %v", renamed, err)
	}

	if _, err := store.UpdateNotificationTarget(ctx, "ntf-ffffffffffffffff", NotificationTargetChanges{
		Name:   "Gone",
		Events: []string{"vpn-dropped"},
	}); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("editing a missing destination error = %v", err)
	}

	if err := store.DeleteNotificationTarget(ctx, phone.ID); err != nil {
		testingObject.Fatalf("delete phone: %v", err)
	}

	if err := store.DeleteNotificationTarget(ctx, phone.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("deleting twice error = %v", err)
	}

	if _, err := store.FindNotificationTarget(ctx, phone.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("finding a deleted destination error = %v", err)
	}
}

// TestReplaceInstallationKeyRemovesNotificationSecrets checks that a lost key takes a
// destination's secrets but keeps the destination, lists it in the notice until its
// secrets are entered again, and that removing it clears its notice entry.
func TestReplaceInstallationKeyRemovesNotificationSecrets(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	chat, err := store.CreateNotificationTarget(ctx, NotificationTarget{
		ID:                "ntf-00000000000000aa",
		Name:              "Homelab chat",
		Service:           "telegram",
		Events:            []string{"vpn-dropped"},
		Settings:          map[string]string{"chatId": "-100"},
		SecretFields:      []string{"botToken"},
		SecretsNonce:      []byte("nonce"),
		SecretsCiphertext: []byte("sealed"),
	})
	if err != nil {
		testingObject.Fatalf("create chat: %v", err)
	}

	if _, err := store.CreateNotificationTarget(ctx, NotificationTarget{
		ID:       "ntf-00000000000000bb",
		Name:     "Phone",
		Service:  "ntfy",
		Events:   []string{"secrets-removed"},
		Settings: map[string]string{"url": "https://ntfy.sh/tvpn"},
	}); err != nil {
		testingObject.Fatalf("create phone: %v", err)
	}

	report, err := store.ReplaceInstallationKey(ctx, []byte("check-nonce"), []byte("check"))
	if err != nil || strings.Join(report.NotificationNames, ",") != "Homelab chat" {
		testingObject.Fatalf("replace key = %+v, %v", report, err)
	}

	removed, err := store.FindNotificationTarget(ctx, chat.ID)
	if err != nil || removed.SecretsCiphertext != nil || len(removed.SecretFields) != 0 ||
		strings.Join(removed.MissingSecrets, ",") != "botToken" || removed.Settings["chatId"] != "-100" {
		testingObject.Fatalf("after the key was replaced = %+v, %v", removed, err)
	}

	listed, err := store.RemovedSecrets(ctx, 1)
	if err != nil || len(listed) != 1 || listed[0].Kind != "notification" || listed[0].Name != "Homelab chat" || listed[0].NotificationID != chat.ID {
		testingObject.Fatalf("removed secrets = %+v, %v", listed, err)
	}

	if _, err := store.UpdateNotificationTarget(ctx, chat.ID, NotificationTargetChanges{
		Name:              "Homelab chat",
		Events:            []string{"vpn-dropped"},
		Settings:          map[string]string{"chatId": "-100"},
		SecretFields:      []string{"botToken"},
		MissingSecrets:    []string{},
		SecretsNonce:      []byte("nonce-2"),
		SecretsCiphertext: []byte("sealed-2"),
	}); err != nil {
		testingObject.Fatalf("enter the bot token again: %v", err)
	}

	if listed, _ := store.RemovedSecrets(ctx, 1); len(listed) != 0 {
		testingObject.Fatalf("the notice still lists the destination: %+v", listed)
	}

	if _, err := store.ReplaceInstallationKey(ctx, []byte("check-nonce"), []byte("check")); err != nil {
		testingObject.Fatalf("replace key again: %v", err)
	}

	if err := store.DeleteNotificationTarget(ctx, chat.ID); err != nil {
		testingObject.Fatalf("delete chat: %v", err)
	}

	if listed, _ := store.RemovedSecrets(ctx, 1); len(listed) != 0 {
		testingObject.Fatalf("removing the destination kept its notice entry: %+v", listed)
	}
}

// TestNotificationsMigrationKeepsRemovedSecrets upgrades a database from before
// notifications and checks that the rebuilt removed-secrets table keeps its entries.
func TestNotificationsMigrationKeepsRemovedSecrets(testingObject *testing.T) {
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
	} {
		content, readError := migrations.ReadFile("migrations/" + name)
		if readError != nil {
			testingObject.Fatalf("read migration %s: %v", name, readError)
		}

		execute(string(content))
		execute("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", index+1, name, "2026-01-01T00:00:00Z")
	}

	execute(
		"INSERT INTO administrators (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)",
		"administrator",
		"unused",
		"2026-01-01T00:00:00Z",
		"2026-01-01T00:00:00Z",
	)
	execute("INSERT INTO removed_secrets (kind, administrator_id, removed_at) VALUES ('vpn', NULL, '2026-01-02T00:00:00Z')")
	execute("INSERT INTO removed_secrets (kind, administrator_id, removed_at) VALUES ('authenticator', 1, '2026-01-02T00:00:00Z')")

	if err := database.Close(); err != nil {
		testingObject.Fatalf("close old database: %v", err)
	}

	store, err := Open(ctx, path)
	if err != nil {
		testingObject.Fatalf("migrate database: %v", err)
	}
	defer store.Close()

	listed, err := store.RemovedSecrets(ctx, 1)
	if err != nil || len(listed) != 2 || listed[0].Kind != "authenticator" || listed[1].Kind != "vpn" || listed[0].Name != "" {
		testingObject.Fatalf("removed secrets after the migration = %+v, %v", listed, err)
	}

	if version, err := store.SchemaVersion(ctx); err != nil || version != 18 {
		testingObject.Fatalf("schema version = %d, %v", version, err)
	}
}
