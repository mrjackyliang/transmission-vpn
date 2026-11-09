package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var (
	// ErrRPCLoginUsernameTaken reports that another RPC login already uses a username,
	// ignoring letter case.
	//
	// The API maps this conflict to the username field without exposing the database
	// constraint that enforces it.
	//
	// Since: UNRELEASED
	ErrRPCLoginUsernameTaken = errors.New("RPC login username is already in use")
)

// RPCLogin is one independently revocable compatible-RPC credential.
//
// SecretDigest is available only to the authentication boundary. API handlers shape
// separate responses that never serialize it.
//
// Since: UNRELEASED
type RPCLogin struct {
	ID           string
	Username     string
	SecretDigest []byte
	CreatedAt    time.Time
	UpdatedAt    time.Time
	LastUsedAt   *time.Time
}

// RPCLoginChanges contains the editable fields of one compatible-RPC login.
//
// A nil SecretDigest preserves the existing generated password, while a non-nil
// digest replaces it after password regeneration.
//
// Since: UNRELEASED
type RPCLoginChanges struct {
	Username     string
	SecretDigest []byte
}

// rpcLoginColumns lists the columns scanRPCLogin reads, in order.
const rpcLoginColumns = "id, username, secret_digest, created_at, updated_at, last_used_at"

// CreateRPCLogin stores a generated compatible-RPC credential.
//
// Username uniqueness is checked without regard to case before insertion so callers
// receive a stable conflict instead of a driver-specific constraint error.
//
// Since: UNRELEASED
func (store *Store) CreateRPCLogin(ctx context.Context, login RPCLogin) (RPCLogin, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return RPCLogin{}, fmt.Errorf("begin RPC login creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkRPCLoginUsername(ctx, transaction, login.Username, login.ID); err != nil {
		return RPCLogin{}, err
	}

	now := time.Now().UTC()
	login.CreatedAt = now
	login.UpdatedAt = now
	login.LastUsedAt = nil

	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO rpc_logins (
		   id, username, secret_digest, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?)`,
		login.ID,
		login.Username,
		login.SecretDigest,
		formatTime(now),
		formatTime(now),
	); err != nil {
		return RPCLogin{}, fmt.Errorf("create RPC login: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return RPCLogin{}, fmt.Errorf("commit RPC login creation: %w", err)
	}

	return login, nil
}

// ListRPCLogins returns every compatible-RPC login, newest first.
//
// The returned storage records include their digests for internal callers. HTTP
// handlers must convert them to the safe response type before serialization.
//
// Since: UNRELEASED
func (store *Store) ListRPCLogins(ctx context.Context) ([]RPCLogin, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT "+rpcLoginColumns+" FROM rpc_logins ORDER BY created_at DESC, username",
	)
	if err != nil {
		return nil, fmt.Errorf("list RPC logins: %w", err)
	}
	defer rows.Close()

	logins := []RPCLogin{}
	for rows.Next() {
		login, scanError := scanRPCLogin(rows)
		if scanError != nil {
			return nil, scanError
		}

		logins = append(logins, login)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate RPC logins: %w", err)
	}

	return logins, nil
}

// FindRPCLogin returns one compatible-RPC login by identifier, or ErrNotFound.
//
// Management handlers use this lookup to preserve omitted update fields without
// accepting a reusable digest from the request.
//
// Since: UNRELEASED
func (store *Store) FindRPCLogin(ctx context.Context, id string) (RPCLogin, error) {
	login, err := scanRPCLogin(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+rpcLoginColumns+" FROM rpc_logins WHERE id = ?",
		id,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return RPCLogin{}, ErrNotFound
	}

	return login, err
}

// FindRPCLoginByUsername returns one login using a case-insensitive username lookup.
//
// The RPC authentication boundary compares the returned digest in constant time and
// never includes it in a response or log entry.
//
// Since: UNRELEASED
func (store *Store) FindRPCLoginByUsername(ctx context.Context, username string) (RPCLogin, error) {
	login, err := scanRPCLogin(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+rpcLoginColumns+" FROM rpc_logins WHERE username = ? COLLATE NOCASE",
		username,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return RPCLogin{}, ErrNotFound
	}

	return login, err
}

// UpdateRPCLogin saves an edited username and optional replacement digest.
//
// Leaving SecretDigest nil keeps the generated password unchanged. A regenerated
// password is supplied only as its digest and never reaches this method in plaintext.
//
// Since: UNRELEASED
func (store *Store) UpdateRPCLogin(
	ctx context.Context,
	id string,
	changes RPCLoginChanges,
) (RPCLogin, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return RPCLogin{}, fmt.Errorf("begin RPC login update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkRPCLoginUsername(ctx, transaction, changes.Username, id); err != nil {
		return RPCLogin{}, err
	}

	now := time.Now().UTC()
	statement := "UPDATE rpc_logins SET username = ?, updated_at = ? WHERE id = ?"
	arguments := []any{changes.Username, formatTime(now), id}
	if changes.SecretDigest != nil {
		statement = "UPDATE rpc_logins SET username = ?, secret_digest = ?, updated_at = ? WHERE id = ?"
		arguments = []any{changes.Username, changes.SecretDigest, formatTime(now), id}
	}

	result, err := transaction.ExecContext(ctx, statement, arguments...)
	if err != nil {
		return RPCLogin{}, fmt.Errorf("update RPC login: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return RPCLogin{}, fmt.Errorf("inspect RPC login update: %w", err)
	}
	if affectedRows == 0 {
		return RPCLogin{}, ErrNotFound
	}

	login, err := scanRPCLogin(transaction.QueryRowContext(
		ctx,
		"SELECT "+rpcLoginColumns+" FROM rpc_logins WHERE id = ?",
		id,
	))
	if err != nil {
		return RPCLogin{}, err
	}

	if err := transaction.Commit(); err != nil {
		return RPCLogin{}, fmt.Errorf("commit RPC login update: %w", err)
	}

	return login, nil
}

// DeleteRPCLogin removes one compatible-RPC credential.
//
// Its next request fails authentication because the username and digest no longer
// exist, and the login disappears from the management list.
//
// Since: UNRELEASED
func (store *Store) DeleteRPCLogin(ctx context.Context, id string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin RPC login deletion: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var loginCount int
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM rpc_logins WHERE id = ?",
		id,
	).Scan(&loginCount); err != nil {
		return fmt.Errorf("find RPC login for deletion: %w", err)
	}
	if loginCount == 0 {
		return ErrNotFound
	}

	result, err := transaction.ExecContext(
		ctx,
		"DELETE FROM rpc_logins WHERE id = ?",
		id,
	)
	if err != nil {
		return fmt.Errorf("delete RPC login: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect RPC login deletion: %w", err)
	}
	if affectedRows == 0 {
		return ErrNotFound
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit RPC login deletion: %w", err)
	}

	return nil
}

// RecordRPCLoginUsed records a successful sign-in at most once per minute.
//
// The read and conditional write share one transaction, so concurrent successful
// requests cannot turn the bounded activity timestamp into a write per RPC call.
//
// Since: UNRELEASED
func (store *Store) RecordRPCLoginUsed(ctx context.Context, id string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin RPC login use update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var lastUsedAtText sql.NullString
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT last_used_at FROM rpc_logins WHERE id = ?",
		id,
	).Scan(&lastUsedAtText); errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return fmt.Errorf("read RPC login use: %w", err)
	}

	now := time.Now().UTC()
	if lastUsedAtText.Valid {
		lastUsedAt, err := parseTime(lastUsedAtText.String)
		if err != nil {
			return err
		}
		if lastUsedAt.Add(time.Minute).After(now) {
			if err := transaction.Commit(); err != nil {
				return fmt.Errorf("commit unchanged RPC login use: %w", err)
			}

			return nil
		}
	}

	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE rpc_logins SET last_used_at = ? WHERE id = ?",
		formatTime(now),
		id,
	); err != nil {
		return fmt.Errorf("record RPC login use: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit RPC login use: %w", err)
	}

	return nil
}

// checkRPCLoginUsername returns ErrRPCLoginUsernameTaken when another login uses name.
func checkRPCLoginUsername(ctx context.Context, transaction *sql.Tx, username string, id string) error {
	var otherID string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT id FROM rpc_logins WHERE username = ? COLLATE NOCASE AND id <> ?",
		username,
		id,
	).Scan(&otherID)
	if err == nil {
		return ErrRPCLoginUsernameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check RPC login username: %w", err)
	}

	return nil
}

// scanRPCLogin reads one compatible-RPC login from a row or query result.
func scanRPCLogin(scanner rowScanner) (RPCLogin, error) {
	var login RPCLogin
	var createdAtText, updatedAtText string
	var lastUsedAtText sql.NullString
	if err := scanner.Scan(
		&login.ID,
		&login.Username,
		&login.SecretDigest,
		&createdAtText,
		&updatedAtText,
		&lastUsedAtText,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return RPCLogin{}, err
		}

		return RPCLogin{}, fmt.Errorf("read RPC login: %w", err)
	}

	createdAt, err := parseTime(createdAtText)
	if err != nil {
		return RPCLogin{}, err
	}
	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return RPCLogin{}, err
	}

	login.CreatedAt = createdAt
	login.UpdatedAt = updatedAt
	if lastUsedAtText.Valid {
		lastUsedAt, err := parseTime(lastUsedAtText.String)
		if err != nil {
			return RPCLogin{}, err
		}
		login.LastUsedAt = &lastUsedAt
	}

	return login, nil
}
