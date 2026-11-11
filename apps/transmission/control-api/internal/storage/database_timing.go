package storage

import (
	"context"
	"database/sql/driver"
	"log/slog"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

const (
	// slowDatabaseUse is how long one hold on the connection must last to be reported.
	slowDatabaseUse = 250 * time.Millisecond

	// databaseStillInUse is when an unfinished hold is reported: the five seconds the
	// console's background checks wait for the database before they give up.
	databaseStillInUse = 5 * time.Second
)

// storagePackagePrefix is the prefix of every function name this package puts on a
// stack, such as "github.com/…/internal/storage.".
var storagePackagePrefix = packagePrefix()

// packagePrefix derives storagePackagePrefix from this function's own name.
func packagePrefix() string {
	programCounter, _, _, _ := runtime.Caller(0)
	name := runtime.FuncForPC(programCounter).Name()

	return name[:strings.LastIndex(name, ".")+1]
}

// databaseTiming reports long holds on the store's single SQLite connection.
//
// Every other caller waits while one operation holds the connection, so a slow
// holder shows up elsewhere as a timeout. With debug logging on, each transaction and
// each statement outside one is timed, and the store method holding it is named.
// Otherwise the only cost is one level check per statement.
//
// Since: 2.1.0
type databaseTiming struct {
	logger     atomic.Pointer[slog.Logger]
	slowAfter  time.Duration
	stillAfter time.Duration
}

// newDatabaseTiming returns timing with the production thresholds and no logger.
func newDatabaseTiming() *databaseTiming {
	return &databaseTiming{
		slowAfter:  slowDatabaseUse,
		stillAfter: databaseStillInUse,
	}
}

// databaseUse is one timed hold: a transaction, or a statement outside one.
type databaseUse struct {
	timing    *databaseTiming
	logger    *slog.Logger
	kind      string
	operation string
	caller    string
	startedAt time.Time
	watchdog  *time.Timer
}

// start begins timing one hold, or returns nil when debug logging is off.
//
// A hold that hasn't finished when stillAfter passes is reported once right away, so
// a stuck holder is named even if it never lets go.
func (timing *databaseTiming) start(kind string) *databaseUse {
	logger := timing.logger.Load()
	if logger == nil || !logger.Enabled(context.Background(), slog.LevelDebug) {
		return nil
	}

	operation, caller := describeCallers(callerFunctions())
	use := &databaseUse{
		timing:    timing,
		logger:    logger,
		kind:      kind,
		operation: operation,
		caller:    caller,
		startedAt: time.Now(),
	}
	use.watchdog = time.AfterFunc(timing.stillAfter, func() {
		logger.Debug("database still in use", use.fields(time.Since(use.startedAt))...)
	})

	return use
}

// finish stops timing and reports the hold when it was slow. A nil use does nothing.
func (use *databaseUse) finish() {
	if use == nil {
		return
	}

	use.watchdog.Stop()
	held := time.Since(use.startedAt)
	if held < use.timing.slowAfter {
		return
	}

	use.logger.Debug("slow database use", use.fields(held)...)
}

// fields lists one hold's log attributes.
func (use *databaseUse) fields(held time.Duration) []any {
	return []any{
		"operation", use.operation,
		"caller", use.caller,
		"kind", use.kind,
		"held", held.Round(time.Millisecond).String(),
	}
}

// callerFunctions lists the function names on the current stack, innermost first.
func callerFunctions() []string {
	programCounters := make([]uintptr, 64)
	count := runtime.Callers(2, programCounters)
	frames := runtime.CallersFrames(programCounters[:count])
	names := make([]string, 0, count)
	for {
		frame, more := frames.Next()
		names = append(names, frame.Function)
		if !more {
			return names
		}
	}
}

// describeCallers names the store method holding the connection and the code that
// called it.
//
// The stack runs from the timing wrapper through database/sql into this package. The
// outermost frame of that first run of store frames is the store method, and the frame
// after the run is its caller. Both drop the module path, as in
// "storage.(*Store).ListNotificationTargets" and "api.(*notifier).wantedEvents".
func describeCallers(functions []string) (string, string) {
	operation := ""
	for _, function := range functions {
		if strings.HasPrefix(function, storagePackagePrefix) && !timingFunction(function) {
			operation = shortFunctionName(function)

			continue
		}
		if operation != "" {
			return operation, shortFunctionName(function)
		}
	}

	return operation, ""
}

// timingFunction reports whether a frame belongs to the timing wrapper itself.
func timingFunction(function string) bool {
	name := strings.TrimPrefix(function, storagePackagePrefix)

	return strings.HasPrefix(name, "(*timed") ||
		strings.HasPrefix(name, "(*databaseTiming)") ||
		name == "callerFunctions"
}

// shortFunctionName drops the module path, leaving package.Function.
func shortFunctionName(function string) string {
	return function[strings.LastIndex(function, "/")+1:]
}

// timedConnector opens SQLite connections that time how long each use holds them.
type timedConnector struct {
	base   driver.Connector
	timing *databaseTiming
}

// Connect opens one wrapped connection.
func (connector *timedConnector) Connect(ctx context.Context) (driver.Conn, error) {
	connection, err := connector.base.Connect(ctx)
	if err != nil {
		return nil, err
	}

	return &timedConn{base: connection, timing: connector.timing}, nil
}

// Driver returns the SQLite driver.
func (connector *timedConnector) Driver() driver.Driver {
	return connector.base.Driver()
}

// timedConn passes every call to SQLite, timing transactions and statements run
// outside one.
//
// database/sql never uses one connection from two goroutines at once, so
// inTransaction needs no lock.
type timedConn struct {
	base          driver.Conn
	timing        *databaseTiming
	inTransaction bool
}

// Prepare passes through untimed; the store runs statements directly.
func (connection *timedConn) Prepare(query string) (driver.Stmt, error) {
	return connection.base.Prepare(query)
}

// PrepareContext passes through untimed; the store runs statements directly.
func (connection *timedConn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	if preparer, ok := connection.base.(driver.ConnPrepareContext); ok {
		return preparer.PrepareContext(ctx, query)
	}

	return connection.base.Prepare(query)
}

// Close closes the SQLite connection.
func (connection *timedConn) Close() error {
	return connection.base.Close()
}

// Begin starts a transaction without a context.
func (connection *timedConn) Begin() (driver.Tx, error) {
	return connection.BeginTx(context.Background(), driver.TxOptions{})
}

// BeginTx starts a transaction and times it until Commit or Rollback.
func (connection *timedConn) BeginTx(ctx context.Context, options driver.TxOptions) (driver.Tx, error) {
	use := connection.timing.start("transaction")

	var (
		transaction driver.Tx
		err         error
	)
	if beginner, ok := connection.base.(driver.ConnBeginTx); ok {
		transaction, err = beginner.BeginTx(ctx, options)
	} else {
		transaction, err = connection.base.Begin()
	}
	if err != nil {
		use.finish()

		return nil, err
	}

	connection.inTransaction = true

	return &timedTx{base: transaction, connection: connection, use: use}, nil
}

// ExecContext runs one statement, timing it unless a transaction already is.
func (connection *timedConn) ExecContext(
	ctx context.Context,
	query string,
	arguments []driver.NamedValue,
) (driver.Result, error) {
	execer, ok := connection.base.(driver.ExecerContext)
	if !ok {
		return nil, driver.ErrSkip
	}

	use := connection.startStatement("statement")
	result, err := execer.ExecContext(ctx, query, arguments)
	use.finish()

	return result, err
}

// QueryContext runs one query, timing it until its rows close unless a transaction
// already is.
func (connection *timedConn) QueryContext(
	ctx context.Context,
	query string,
	arguments []driver.NamedValue,
) (driver.Rows, error) {
	queryer, ok := connection.base.(driver.QueryerContext)
	if !ok {
		return nil, driver.ErrSkip
	}

	use := connection.startStatement("query")
	rows, err := queryer.QueryContext(ctx, query, arguments)
	if err != nil {
		use.finish()

		return nil, err
	}
	if use == nil {
		return rows, nil
	}

	return &timedRows{Rows: rows, use: use}, nil
}

// startStatement times one statement unless a transaction already covers it.
func (connection *timedConn) startStatement(kind string) *databaseUse {
	if connection.inTransaction {
		return nil
	}

	return connection.timing.start(kind)
}

// Ping checks the SQLite connection.
func (connection *timedConn) Ping(ctx context.Context) error {
	if pinger, ok := connection.base.(driver.Pinger); ok {
		return pinger.Ping(ctx)
	}

	return nil
}

// ResetSession prepares the SQLite connection for its next use.
func (connection *timedConn) ResetSession(ctx context.Context) error {
	if resetter, ok := connection.base.(driver.SessionResetter); ok {
		return resetter.ResetSession(ctx)
	}

	return nil
}

// IsValid reports whether the SQLite connection can be reused.
func (connection *timedConn) IsValid() bool {
	if validator, ok := connection.base.(driver.Validator); ok {
		return validator.IsValid()
	}

	return true
}

// timedTx ends a transaction's timing when it commits or rolls back.
type timedTx struct {
	base       driver.Tx
	connection *timedConn
	use        *databaseUse
}

// Commit commits the transaction and ends its timing.
func (transaction *timedTx) Commit() error {
	err := transaction.base.Commit()
	transaction.end()

	return err
}

// Rollback rolls the transaction back and ends its timing.
func (transaction *timedTx) Rollback() error {
	err := transaction.base.Rollback()
	transaction.end()

	return err
}

// end reports the transaction once and lets later statements be timed on their own.
func (transaction *timedTx) end() {
	transaction.connection.inTransaction = false
	transaction.use.finish()
	transaction.use = nil
}

// timedRows ends a query's timing when its rows close.
type timedRows struct {
	driver.Rows
	use *databaseUse
}

// Close closes the rows and reports the query once.
func (rows *timedRows) Close() error {
	err := rows.Rows.Close()
	rows.use.finish()
	rows.use = nil

	return err
}

var (
	_ driver.Connector          = (*timedConnector)(nil)
	_ driver.Conn               = (*timedConn)(nil)
	_ driver.ConnBeginTx        = (*timedConn)(nil)
	_ driver.ConnPrepareContext = (*timedConn)(nil)
	_ driver.ExecerContext      = (*timedConn)(nil)
	_ driver.QueryerContext     = (*timedConn)(nil)
	_ driver.Pinger             = (*timedConn)(nil)
	_ driver.SessionResetter    = (*timedConn)(nil)
	_ driver.Validator          = (*timedConn)(nil)
	_ driver.Tx                 = (*timedTx)(nil)
	_ driver.Rows               = (*timedRows)(nil)
)
