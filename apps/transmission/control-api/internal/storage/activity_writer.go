package storage

import (
	"context"
	"database/sql"
	"sync"
	"time"
)

const (
	// activitySaveTimeout bounds one batch of last-activity saves.
	//
	// A batch that can't finish on a stalled disk is dropped. The next request that
	// finds the time due queues it again.
	activitySaveTimeout = 30 * time.Second

	// activityCloseTimeout bounds the last batch written while the store closes, so a
	// stalled disk can't hold up shutdown.
	activityCloseTimeout = 5 * time.Second
)

// activitySave is one queued last-activity update: a fixed statement and its values.
type activitySave struct {
	query     string
	arguments []any
}

// activityWriter saves last-activity times on the writing connection in the background.
//
// Checking a browser session, API token, or RPC login is a read on the store's
// read-only connections. The once-a-minute save of when it was last used goes through
// this queue instead, so a request never waits behind a slow disk flush. Only the
// newest pending save for each row is kept, and each batch is one transaction, so a
// burst of requests costs one write.
//
// Since: 2.2.1
type activityWriter struct {
	database   *sql.DB
	mutex      sync.Mutex
	pending    map[string]activitySave
	writeMutex sync.Mutex
	wake       chan struct{}
	stop       chan struct{}
	stopOnce   sync.Once
	done       chan struct{}
}

// newActivityWriter starts the background writer for database.
func newActivityWriter(database *sql.DB) *activityWriter {
	writer := &activityWriter{
		database: database,
		pending:  map[string]activitySave{},
		wake:     make(chan struct{}, 1),
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
	go writer.run()

	return writer
}

// queue records a save for key, replacing any save for the same row still waiting.
//
// It never blocks on the database. Saves queued after close are dropped.
func (writer *activityWriter) queue(key string, save activitySave) {
	writer.mutex.Lock()
	writer.pending[key] = save
	writer.mutex.Unlock()

	select {
	case writer.wake <- struct{}{}:
	default:
	}
}

// run writes each batch as it is queued until close.
func (writer *activityWriter) run() {
	defer close(writer.done)

	for {
		select {
		case <-writer.wake:
			writer.writePending(activitySaveTimeout)
		case <-writer.stop:
			writer.writePending(activityCloseTimeout)

			return
		}
	}
}

// writePending saves every queued update in one transaction.
//
// The saves are best effort, as they were when requests made them: a failed batch is
// dropped, and the next due request queues its row again.
func (writer *activityWriter) writePending(timeout time.Duration) {
	writer.writeMutex.Lock()
	defer writer.writeMutex.Unlock()

	writer.mutex.Lock()
	batch := writer.pending
	writer.pending = map[string]activitySave{}
	writer.mutex.Unlock()
	if len(batch) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	transaction, err := writer.database.BeginTx(ctx, nil)
	if err != nil {
		return
	}
	defer func() { _ = transaction.Rollback() }()

	for _, save := range batch {
		if _, err := transaction.ExecContext(ctx, save.query, save.arguments...); err != nil {
			return
		}
	}

	_ = transaction.Commit()
}

// flush writes everything queued so far and waits for it, including a batch the
// background loop is already writing. Tests use it to read a save back.
func (writer *activityWriter) flush() {
	writer.writePending(activitySaveTimeout)
}

// close writes what is still queued and stops the background loop.
func (writer *activityWriter) close() {
	writer.stopOnce.Do(func() { close(writer.stop) })
	<-writer.done
}
