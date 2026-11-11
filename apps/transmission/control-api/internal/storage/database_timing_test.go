package storage

import (
	"bytes"
	"context"
	"log/slog"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// lockedBuffer collects log output written from the test and from timer goroutines.
type lockedBuffer struct {
	mutex  sync.Mutex
	buffer bytes.Buffer
}

func (output *lockedBuffer) Write(data []byte) (int, error) {
	output.mutex.Lock()
	defer output.mutex.Unlock()

	return output.buffer.Write(data)
}

func (output *lockedBuffer) String() string {
	output.mutex.Lock()
	defer output.mutex.Unlock()

	return output.buffer.String()
}

// openTimedStore opens a store whose timing logs to the returned buffer at level.
func openTimedStore(testingObject *testing.T, level slog.Level) (*Store, *lockedBuffer) {
	testingObject.Helper()

	store, err := Open(context.Background(), filepath.Join(testingObject.TempDir(), "control.db"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	testingObject.Cleanup(func() { _ = store.Close() })

	output := &lockedBuffer{}
	store.SetLogger(slog.New(slog.NewJSONHandler(output, &slog.HandlerOptions{Level: level})))
	store.timing.slowAfter = 20 * time.Millisecond
	store.timing.stillAfter = time.Hour

	return store, output
}

// TestDatabaseTimingReportsSlowTransactions names a transaction that held the
// connection past the threshold, once, without its statements on their own.
func TestDatabaseTimingReportsSlowTransactions(testingObject *testing.T) {
	store, output := openTimedStore(testingObject, slog.LevelDebug)
	ctx := context.Background()

	transaction, err := store.database.BeginTx(ctx, nil)
	if err != nil {
		testingObject.Fatalf("begin: %v", err)
	}
	if _, err := transaction.ExecContext(ctx, "SELECT 1"); err != nil {
		testingObject.Fatalf("exec: %v", err)
	}
	time.Sleep(40 * time.Millisecond)
	if err := transaction.Commit(); err != nil {
		testingObject.Fatalf("commit: %v", err)
	}

	logs := output.String()
	if strings.Count(logs, `"msg":"slow database use"`) != 1 || !strings.Contains(logs, `"kind":"transaction"`) {
		testingObject.Fatalf("want one slow transaction report, got:\n%s", logs)
	}
	if !strings.Contains(logs, `"operation":"storage.TestDatabaseTimingReportsSlowTransactions"`) {
		testingObject.Fatalf("report does not name the holder:\n%s", logs)
	}
}

// TestDatabaseTimingReportsRowsHeldOpen times a query until its rows close.
func TestDatabaseTimingReportsRowsHeldOpen(testingObject *testing.T) {
	store, output := openTimedStore(testingObject, slog.LevelDebug)

	rows, err := store.database.QueryContext(context.Background(), "SELECT 1")
	if err != nil {
		testingObject.Fatalf("query: %v", err)
	}
	time.Sleep(40 * time.Millisecond)
	if err := rows.Close(); err != nil {
		testingObject.Fatalf("close rows: %v", err)
	}

	if logs := output.String(); !strings.Contains(logs, `"kind":"query"`) {
		testingObject.Fatalf("want a slow query report, got:\n%s", logs)
	}
}

// TestDatabaseTimingReportsUnfinishedHolds names a holder that hasn't let go yet.
func TestDatabaseTimingReportsUnfinishedHolds(testingObject *testing.T) {
	store, output := openTimedStore(testingObject, slog.LevelDebug)
	store.timing.stillAfter = 20 * time.Millisecond

	transaction, err := store.database.BeginTx(context.Background(), nil)
	if err != nil {
		testingObject.Fatalf("begin: %v", err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for !strings.Contains(output.String(), `"msg":"database still in use"`) {
		if time.Now().After(deadline) {
			testingObject.Fatalf("no report while the transaction was open:\n%s", output.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err := transaction.Rollback(); err != nil {
		testingObject.Fatalf("rollback: %v", err)
	}
}

// TestDatabaseTimingStaysQuietWithoutDebug reports nothing at the normal log level.
func TestDatabaseTimingStaysQuietWithoutDebug(testingObject *testing.T) {
	store, output := openTimedStore(testingObject, slog.LevelInfo)
	store.timing.stillAfter = 10 * time.Millisecond

	transaction, err := store.database.BeginTx(context.Background(), nil)
	if err != nil {
		testingObject.Fatalf("begin: %v", err)
	}
	time.Sleep(40 * time.Millisecond)
	if err := transaction.Commit(); err != nil {
		testingObject.Fatalf("commit: %v", err)
	}

	if logs := output.String(); logs != "" {
		testingObject.Fatalf("want no output without debug logging, got:\n%s", logs)
	}
}

// TestDescribeCallers names the outermost store frame and the code that called it.
func TestDescribeCallers(testingObject *testing.T) {
	apiPrefix := strings.TrimSuffix(storagePackagePrefix, "storage.") + "api."
	functions := []string{
		storagePackagePrefix + "(*databaseTiming).start",
		storagePackagePrefix + "(*timedConn).startStatement",
		storagePackagePrefix + "(*timedConn).QueryContext",
		"database/sql.ctxDriverQuery",
		"database/sql.(*DB).queryDC",
		"database/sql.(*DB).QueryContext",
		storagePackagePrefix + "(*Store).notificationRows",
		storagePackagePrefix + "(*Store).ListNotificationTargets",
		apiPrefix + "(*notifier).wantedEvents",
		apiPrefix + "(*notificationWatcher).check",
	}

	operation, caller := describeCallers(functions)
	if operation != "storage.(*Store).ListNotificationTargets" {
		testingObject.Fatalf("operation = %q", operation)
	}
	if caller != "api.(*notifier).wantedEvents" {
		testingObject.Fatalf("caller = %q", caller)
	}
}
