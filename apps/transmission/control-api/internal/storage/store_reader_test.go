package storage

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"modernc.org/sqlite"
)

// partialStore wraps a database a test migrates by hand in a Store with the same
// read-only connections and activity writer Open gives it.
func partialStore(testingObject *testing.T, database *sql.DB, path string) *Store {
	testingObject.Helper()

	readerConnector, err := sqlite.NewConnector("file:" + filepath.ToSlash(path) + "?" + readerPragmas)
	if err != nil {
		testingObject.Fatalf("open read connections: %v", err)
	}

	return &Store{
		database: database,
		reader:   sql.OpenDB(readerConnector),
		timing:   newDatabaseTiming(),
		activity: newActivityWriter(database),
	}
}

// TestReadsDoNotWaitForTheWriter keeps sign-in checks, lists, and the health check
// answering while a write still holds the writing connection.
//
// On a busy NAS disk one commit can take many seconds to flush. The open transaction
// here stands in for that commit: every read must finish well inside the deadline,
// and the last-activity saves they queue must land once the write is done.
func TestReadsDoNotWaitForTheWriter(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"INSERT INTO administrators (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)",
		"administrator",
		"unused",
		"2026-01-01T00:00:00Z",
		"2026-01-01T00:00:00Z",
	); err != nil {
		testingObject.Fatalf("add administrator: %v", err)
	}
	if err := store.CreateSession(
		ctx,
		"session-a",
		1,
		[]byte("session-a"),
		[]byte("csrf-a"),
		time.Now().Add(time.Hour),
	); err != nil {
		testingObject.Fatalf("create session: %v", err)
	}
	if _, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000003",
		Username:     "media-apps",
		SecretDigest: []byte("digest"),
	}); err != nil {
		testingObject.Fatalf("create RPC login: %v", err)
	}
	twoMinutesAgo := formatTime(time.Now().Add(-2 * time.Minute))
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE sessions SET last_seen_at = ? WHERE id = ?",
		twoMinutesAgo,
		"session-a",
	); err != nil {
		testingObject.Fatalf("age session: %v", err)
	}

	heldWrite, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		testingObject.Fatalf("begin held write: %v", err)
	}
	if _, err := heldWrite.ExecContext(
		ctx,
		"UPDATE rpc_logins SET updated_at = ? WHERE id = ?",
		formatTime(time.Now()),
		"rpl-0000000000000003",
	); err != nil {
		testingObject.Fatalf("hold the writer: %v", err)
	}

	readContext, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	reads := []struct {
		name string
		read func(context.Context) error
	}{
		{name: "browser session check", read: func(ctx context.Context) error {
			_, err := store.FindSession(ctx, []byte("session-a"))
			return err
		}},
		{name: "RPC login lookup", read: func(ctx context.Context) error {
			_, err := store.FindRPCLoginByUsername(ctx, "media-apps")
			return err
		}},
		{name: "RPC login use", read: func(ctx context.Context) error {
			return store.RecordRPCLoginUsed(ctx, "rpl-0000000000000003")
		}},
		{name: "RPC login list", read: func(ctx context.Context) error {
			_, err := store.ListRPCLogins(ctx)
			return err
		}},
		{name: "notification targets", read: func(ctx context.Context) error {
			_, err := store.ListNotificationTargets(ctx)
			return err
		}},
		{name: "health check", read: store.Ping},
		{name: "schema version", read: func(ctx context.Context) error {
			_, err := store.SchemaVersion(ctx)
			return err
		}},
	}
	for _, read := range reads {
		testingObject.Run(read.name, func(subtest *testing.T) {
			if err := read.read(readContext); err != nil {
				subtest.Fatalf("read while a write held the writer: %v", err)
			}
		})
	}

	if err := heldWrite.Commit(); err != nil {
		testingObject.Fatalf("commit held write: %v", err)
	}
	store.flushActivity()

	var lastSeenText string
	if err := store.readHandle().QueryRowContext(
		ctx,
		"SELECT last_seen_at FROM sessions WHERE id = ?",
		"session-a",
	).Scan(&lastSeenText); err != nil {
		testingObject.Fatalf("read saved session time: %v", err)
	}
	if lastSeenAt, err := parseTime(lastSeenText); err != nil || activityWriteDue(lastSeenAt, time.Now()) {
		testingObject.Fatalf("session last_seen_at = %q, want the queued save inside the last minute", lastSeenText)
	}
	login, err := store.FindRPCLogin(ctx, "rpl-0000000000000003")
	if err != nil || login.LastUsedAt == nil {
		testingObject.Fatalf("RPC login after the queued save = %+v, %v", login, err)
	}
}

// TestReadConnectionsRefuseWrites keeps writes on the single writing connection.
//
// A write sent to the read-only connections by mistake must fail instead of slipping
// past the writer that serializes every change.
func TestReadConnectionsRefuseWrites(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.readHandle().ExecContext(
		ctx,
		"INSERT INTO administrators (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)",
		"administrator",
		"unused",
		"2026-01-01T00:00:00Z",
		"2026-01-01T00:00:00Z",
	); err == nil {
		testingObject.Fatal("a read-only connection accepted a write")
	}
}
