package storage

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestNamedTokensMigration upgrades a database from before token names were unique.
//
// Rows revoked under the old behavior go away, later copies of a name get a number,
// and a numbered name that still collides also gets its token's identifier.
func TestNamedTokensMigration(testingObject *testing.T) {
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

	longName := strings.Repeat("x", 80)
	for _, token := range []struct {
		id        string
		name      string
		createdAt string
		revokedAt any
	}{
		{"token-a", "Laptop", "2026-01-01T00:00:00Z", nil},
		{"token-b", "laptop", "2026-01-02T00:00:00Z", nil},
		{"token-c", "LAPTOP", "2026-01-03T00:00:00Z", nil},
		{"token-d", "Laptop 2", "2026-01-04T00:00:00Z", nil},
		{"token-e", "Old script", "2026-01-05T00:00:00Z", "2026-02-01T00:00:00Z"},
		{"token-f", longName, "2026-01-06T00:00:00Z", nil},
		{"token-g", strings.ToUpper(longName), "2026-01-07T00:00:00Z", nil},
	} {
		execute(
			`INSERT INTO api_tokens (id, administrator_id, name, token_digest, scopes_json, created_at, revoked_at)
			 VALUES (?, 1, ?, ?, '["vpn:read"]', ?, ?)`,
			token.id,
			token.name,
			[]byte(token.id),
			token.createdAt,
			token.revokedAt,
		)
	}

	if err := database.Close(); err != nil {
		testingObject.Fatalf("close old database: %v", err)
	}

	store, err := Open(ctx, path)
	if err != nil {
		testingObject.Fatalf("open and migrate store: %v", err)
	}
	defer store.Close()

	listed, err := store.ListAPITokens(ctx)
	if err != nil {
		testingObject.Fatalf("list migrated tokens: %v", err)
	}

	names := map[string]string{}
	for _, token := range listed {
		names[token.ID] = token.Name
	}

	expected := map[string]string{
		"token-a": "Laptop",
		"token-b": "laptop 2",
		"token-c": "LAPTOP 3",
		"token-d": "Laptop 2 token-d",
		"token-f": longName,
		"token-g": strings.Repeat("X", 78) + " 2",
	}
	if len(names) != len(expected) {
		testingObject.Fatalf("migrated tokens = %v, want %v", names, expected)
	}
	for id, name := range expected {
		if names[id] != name {
			testingObject.Fatalf("token %s name = %q, want %q (all: %v)", id, names[id], name, names)
		}
	}

	if _, err := store.databaseHandle().ExecContext(ctx, "SELECT revoked_at FROM api_tokens"); err == nil {
		testingObject.Fatal("the revoked_at column should be gone")
	}

	if _, err := store.CreateAPIToken(ctx, "token-h", 1, "OLD SCRIPT", []byte("token-h"), []string{"vpn:read"}, nil); err != nil {
		testingObject.Fatalf("a revoked token's name should be free again: %v", err)
	}

	if _, err := store.CreateAPIToken(ctx, "token-i", 1, "laptop", []byte("token-i"), []string{"vpn:read"}, nil); !errors.Is(err, ErrTokenNameTaken) {
		testingObject.Fatalf("a repeated name error = %v, want ErrTokenNameTaken", err)
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO api_tokens (id, administrator_id, name, token_digest, scopes_json, created_at)
		 VALUES ('token-j', 1, 'LAPTOP 2', ?, '["vpn:read"]', ?)`,
		[]byte("token-j"),
		formatTime(time.Now()),
	); err == nil {
		testingObject.Fatal("the database itself should refuse a repeated name")
	}

	if _, err := store.UpdateAPIToken(ctx, "token-a", APITokenChanges{
		Name:           "LAPTOP",
		Scopes:         []string{"vpn:read"},
		KeepExpiration: true,
	}); err != nil {
		testingObject.Fatalf("a token should keep its own name in another letter case: %v", err)
	}

	if _, err := store.UpdateAPIToken(ctx, "token-a", APITokenChanges{
		Name:           "Laptop 3",
		Scopes:         []string{"vpn:read"},
		KeepExpiration: true,
	}); !errors.Is(err, ErrTokenNameTaken) {
		testingObject.Fatalf("renaming onto another token's name error = %v, want ErrTokenNameTaken", err)
	}

	if _, err := store.UpdateAPIToken(ctx, "token-missing", APITokenChanges{
		Name:           "Anything",
		Scopes:         []string{"vpn:read"},
		KeepExpiration: true,
	}); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("editing a missing token error = %v, want ErrNotFound", err)
	}

	if err := store.DeleteAPIToken(ctx, "token-a"); err != nil {
		testingObject.Fatalf("delete token: %v", err)
	}

	if err := store.DeleteAPIToken(ctx, "token-a"); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("deleting a deleted token error = %v, want ErrNotFound", err)
	}
}
