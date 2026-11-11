package storage

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"modernc.org/sqlite"
)

var (
	// ErrNotFound indicates that the requested persisted record does not exist.
	//
	// API handlers translate this sentinel into a stable not-found or unauthorized
	// response without exposing database details.
	ErrNotFound = errors.New("record not found")

	// ErrClaimInvalid indicates an expired, consumed, or incorrect setup claim.
	//
	// One shared error avoids revealing which claim validation check failed.
	ErrClaimInvalid = errors.New("setup claim is invalid or expired")

	// ErrRevisionConflict indicates an optimistic settings revision mismatch.
	//
	// Clients must refresh current effective settings before retrying their complete
	// transaction so concurrent changes are never overwritten silently.
	ErrRevisionConflict = errors.New("configuration revision conflict")

	// ErrSettingLocked indicates an attempted change to a host-managed lock.
	//
	// Locked values remain visible through the API but may change only in the mounted
	// managed configuration document.
	ErrSettingLocked = errors.New("setting is locked by managed configuration")
)

// migrations contains the ordered schema history compiled into the appliance.
//
// Embedding migrations makes every image self-contained and guarantees the exact
// migration inputs travel with the binary that applies them.
//
//go:embed migrations/*.sql
var migrations embed.FS

// Store owns durable control-plane state and transaction boundaries.
//
// A single SQLite connection serializes the appliance's small mutation workload and
// ensures connection-local PRAGMA settings are consistently enforced.
type Store struct {
	database *sql.DB
	timing   *databaseTiming
}

// Open initializes SQLite, applies migrations, and verifies the resulting store.
//
// The caller owns the returned store and must close it during graceful shutdown.
func Open(ctx context.Context, path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("database path is required")
	}

	if err := prepareDatabaseFile(path); err != nil {
		return nil, err
	}

	connector, err := sqlite.NewConnector("file:" + filepath.ToSlash(path))
	if err != nil {
		return nil, fmt.Errorf("open SQLite database: %w", err)
	}
	timing := newDatabaseTiming()
	database := sql.OpenDB(&timedConnector{base: connector, timing: timing})

	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	database.SetConnMaxLifetime(0)

	store := &Store{database: database, timing: timing}
	if err := store.initialize(ctx); err != nil {
		_ = database.Close()

		return nil, err
	}

	return store, nil
}

// SetLogger sends reports of slow database use to logger.
//
// The reports are debug lines, so they appear only while the logger's level allows
// them. Without a logger the store reports nothing.
func (store *Store) SetLogger(logger *slog.Logger) {
	store.timing.logger.Store(logger)
}

// prepareDatabaseFile creates the database file group-writable before SQLite opens it.
//
// SQLite gives its WAL and shared-memory files the database file's mode, so a 0660
// database keeps every state file usable by the PUID:PGID group the console shares.
func prepareDatabaseFile(path string) error {
	databaseFile, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o660)
	if err != nil {
		return fmt.Errorf("create SQLite database: %w", err)
	}

	information, err := databaseFile.Stat()
	if err != nil {
		_ = databaseFile.Close()

		return fmt.Errorf("inspect SQLite database: %w", err)
	}

	// Only the owner may change the mode, and the host may have given the file to
	// PUID:PGID, so an already group-writable database is left as it is.
	if information.Mode().Perm() != 0o660 {
		if err := databaseFile.Chmod(0o660); err != nil {
			_ = databaseFile.Close()

			return fmt.Errorf("set SQLite database permissions: %w", err)
		}
	}

	if err := databaseFile.Close(); err != nil {
		return fmt.Errorf("close SQLite database: %w", err)
	}

	return nil
}

// Close releases the underlying SQLite connection.
//
// Shutdown calls this only after the HTTP server has stopped accepting requests.
func (store *Store) Close() error {
	return store.database.Close()
}

// Ping verifies that SQLite can execute a minimal query.
//
// The liveness endpoint uses this check so a wedged or inaccessible persistent store
// makes the control plane unhealthy without conflating VPN readiness.
func (store *Store) Ping(ctx context.Context) error {
	return store.database.PingContext(ctx)
}

// SchemaVersion returns the highest successfully applied embedded migration.
//
// Status responses expose this value for diagnostics and upgrade verification.
func (store *Store) SchemaVersion(ctx context.Context) (int, error) {
	var version sql.NullInt64
	err := store.database.QueryRowContext(
		ctx,
		"SELECT MAX(version) FROM schema_migrations",
	).Scan(&version)
	if err != nil {
		return 0, fmt.Errorf("read schema version: %w", err)
	}

	if !version.Valid {
		return 0, nil
	}

	return int(version.Int64), nil
}

// Database returns the package-internal SQL handle for focused storage modules.
//
// Keeping access behind this unexported method centralizes connection ownership while
// allowing authentication and settings files to define cohesive transaction logic.
func (store *Store) databaseHandle() *sql.DB {
	return store.database
}

// initialize configures safe SQLite behavior before applying schema migrations.
//
// WAL supports concurrent status reads, foreign keys protect auth relationships, and
// the busy timeout bounds temporary lock contention instead of failing immediately.
func (store *Store) initialize(ctx context.Context) error {
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = FULL",
	}

	for _, pragma := range pragmas {
		if _, err := store.database.ExecContext(ctx, pragma); err != nil {
			return fmt.Errorf("apply SQLite configuration %q: %w", pragma, err)
		}
	}

	if _, err := store.database.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
		  version INTEGER PRIMARY KEY,
		  name TEXT NOT NULL,
		  applied_at TEXT NOT NULL
		) STRICT
	`); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}

	entries, err := fs.ReadDir(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}

	sort.Slice(entries, func(leftIndex int, rightIndex int) bool {
		return entries[leftIndex].Name() < entries[rightIndex].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		if err := store.applyMigration(ctx, entry.Name()); err != nil {
			return err
		}
	}

	return store.database.PingContext(ctx)
}

// applyMigration atomically applies one embedded migration when it is not recorded.
//
// Each filename begins with a numeric version, making ordering deterministic and
// preventing a partially applied schema from being marked successful.
func (store *Store) applyMigration(ctx context.Context, name string) error {
	versionText, _, found := strings.Cut(name, "_")
	if !found {
		return fmt.Errorf("migration filename has no numeric prefix: %s", name)
	}

	version, err := strconv.Atoi(versionText)
	if err != nil || version <= 0 {
		return fmt.Errorf("migration filename has invalid version: %s", name)
	}

	var existingName string
	err = store.database.QueryRowContext(
		ctx,
		"SELECT name FROM schema_migrations WHERE version = ?",
		version,
	).Scan(&existingName)
	if err == nil {
		if existingName != name {
			return fmt.Errorf(
				"migration version %d was applied as %s, not %s",
				version,
				existingName,
				name,
			)
		}

		return nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("inspect migration %s: %w", name, err)
	}

	content, err := migrations.ReadFile("migrations/" + name)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", name, err)
	}

	transaction, err := store.database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", name, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	if _, err := transaction.ExecContext(ctx, string(content)); err != nil {
		return fmt.Errorf("apply migration %s: %w", name, err)
	}
	if name == "014_download_subdirectories.sql" {
		if err := cleanupIncompleteDownloadTargets(ctx, transaction); err != nil {
			return fmt.Errorf("clean incomplete-directory destinations: %w", err)
		}
	}

	if _, err := transaction.ExecContext(
		ctx,
		"INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
		version,
		name,
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("record migration %s: %w", name, err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit migration %s: %w", name, err)
	}

	committed = true

	return nil
}

// formatTime serializes timestamps in a sortable, lossless UTC representation.
//
// Text timestamps remain easy to inspect while RFC3339 nanoseconds preserve ordering
// for rapid configuration and authentication events.
func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

// parseTime decodes the timestamp representation used throughout the schema.
//
// Corrupt persisted timestamps are returned as explicit errors instead of silently
// falling back to a zero time that could weaken expiration checks.
func parseTime(value string) (time.Time, error) {
	parsedValue, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse persisted timestamp: %w", err)
	}

	return parsedValue, nil
}
