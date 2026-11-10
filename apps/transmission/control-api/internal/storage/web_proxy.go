package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	// ErrWebProxyUsernameTaken reports that another login already uses a username,
	// ignoring letter case.
	//
	// The API maps this conflict to the username field without exposing the unique
	// database index that enforces it.
	//
	// Since: 2.0.0
	ErrWebProxyUsernameTaken = errors.New("web proxy username is already in use")
)

// WebProxy contains the one-row proxy switch and its last persisted change time.
//
// The API combines this durable setting with runtime status written by the separate
// proxy process, keeping desired and observed state distinct.
//
// Since: 2.0.0
type WebProxy struct {
	Enabled   bool
	UpdatedAt time.Time
}

// WebProxyLogin is one independently revocable proxy credential.
//
// PasswordHash is passed only to the permission-restricted runtime configuration file;
// read APIs shape a separate response that never contains it.
//
// Since: 2.0.0
type WebProxyLogin struct {
	ID           string
	Username     string
	PasswordHash string
	ConnectionID *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// WebProxyLoginChanges contains the editable fields of one proxy login.
//
// Nil PasswordHash preserves the verifier. ConnectionIDSet distinguishes an omitted
// edit from an explicit null that returns the login to the default connection.
//
// Since: 2.0.0
type WebProxyLoginChanges struct {
	Username        string
	PasswordHash    *string
	ConnectionID    *string
	ConnectionIDSet bool
}

const webProxyLoginColumns = `id, username, password_hash, connection_id, created_at, updated_at`

// WebProxyConfiguration returns the proxy switch and every login in creation order.
//
// One read transaction provides a consistent hand-off snapshot for the proxy process,
// so a concurrent mutation cannot mix an old switch with a new login list.
//
// Since: 2.0.0
func (store *Store) WebProxyConfiguration(ctx context.Context) (WebProxy, []WebProxyLogin, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return WebProxy{}, nil, fmt.Errorf("begin web proxy read: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	proxy, err := scanWebProxy(transaction.QueryRowContext(
		ctx,
		"SELECT enabled, updated_at FROM web_proxy WHERE id = 1",
	))
	if err != nil {
		return WebProxy{}, nil, err
	}

	rows, err := transaction.QueryContext(
		ctx,
		"SELECT "+webProxyLoginColumns+" FROM web_proxy_logins ORDER BY created_at, username",
	)
	if err != nil {
		return WebProxy{}, nil, fmt.Errorf("list web proxy logins: %w", err)
	}

	logins := []WebProxyLogin{}
	for rows.Next() {
		login, scanError := scanWebProxyLogin(rows)
		if scanError != nil {
			_ = rows.Close()

			return WebProxy{}, nil, scanError
		}

		logins = append(logins, login)
	}
	if err := rows.Close(); err != nil {
		return WebProxy{}, nil, fmt.Errorf("close web proxy logins: %w", err)
	}
	if err := rows.Err(); err != nil {
		return WebProxy{}, nil, fmt.Errorf("list web proxy logins: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return WebProxy{}, nil, fmt.Errorf("commit web proxy read: %w", err)
	}

	return proxy, logins, nil
}

// SetWebProxyEnabled saves the desired proxy switch.
//
// Enabling is rejected inside the transaction when no VPN connection exists.
// Login changes remain independent from the desired proxy state.
//
// Since: 2.0.0
func (store *Store) SetWebProxyEnabled(ctx context.Context, enabled bool) (WebProxy, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return WebProxy{}, fmt.Errorf("begin web proxy update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if enabled {
		if err := requireVPNConnection(ctx, transaction); err != nil {
			return WebProxy{}, err
		}
	}

	now := time.Now().UTC()
	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE web_proxy SET enabled = ?, updated_at = ? WHERE id = 1",
		enabled,
		formatTime(now),
	); err != nil {
		return WebProxy{}, fmt.Errorf("update web proxy: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return WebProxy{}, fmt.Errorf("commit web proxy update: %w", err)
	}

	return WebProxy{Enabled: enabled, UpdatedAt: now}, nil
}

// CreateWebProxyLogin stores a new proxy login with an already-derived verifier.
//
// Username uniqueness is checked without regard to case before insertion so callers
// receive a stable conflict instead of a driver-specific constraint error.
//
// Since: 2.0.0
func (store *Store) CreateWebProxyLogin(
	ctx context.Context,
	login WebProxyLogin,
) (WebProxyLogin, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return WebProxyLogin{}, fmt.Errorf("begin web proxy login creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := verifyOptionalVPNConnectionReference(ctx, transaction, login.ConnectionID); err != nil {
		return WebProxyLogin{}, err
	}
	if err := checkWebProxyUsername(ctx, transaction, login.Username, login.ID); err != nil {
		return WebProxyLogin{}, err
	}

	now := time.Now().UTC()
	login.CreatedAt = now
	login.UpdatedAt = now

	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO web_proxy_logins (
		   id, username, password_hash, connection_id, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?)`,
		login.ID,
		login.Username,
		login.PasswordHash,
		optionalString(login.ConnectionID),
		formatTime(now),
		formatTime(now),
	); err != nil {
		return WebProxyLogin{}, fmt.Errorf("create web proxy login: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return WebProxyLogin{}, fmt.Errorf("commit web proxy login creation: %w", err)
	}

	return login, nil
}

// FindWebProxyLogin returns one proxy login, or ErrNotFound.
//
// Internal callers receive the complete stored verifier; API responses always shape a
// separate safe view without this field.
//
// Since: 2.0.0
func (store *Store) FindWebProxyLogin(ctx context.Context, id string) (WebProxyLogin, error) {
	login, err := scanWebProxyLogin(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+webProxyLoginColumns+" FROM web_proxy_logins WHERE id = ?",
		id,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return WebProxyLogin{}, ErrNotFound
	}

	return login, err
}

// UpdateWebProxyLogin saves an edited username and optional replacement verifier.
//
// Leaving PasswordHash nil keeps the current password, which lets the API distinguish
// an omitted password from an explicitly invalid empty value.
//
// Since: 2.0.0
func (store *Store) UpdateWebProxyLogin(
	ctx context.Context,
	id string,
	changes WebProxyLoginChanges,
) (WebProxyLogin, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return WebProxyLogin{}, fmt.Errorf("begin web proxy login update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if changes.ConnectionIDSet {
		if err := verifyOptionalVPNConnectionReference(
			ctx,
			transaction,
			changes.ConnectionID,
		); err != nil {
			return WebProxyLogin{}, err
		}
	}
	if err := checkWebProxyUsername(ctx, transaction, changes.Username, id); err != nil {
		return WebProxyLogin{}, err
	}

	now := time.Now().UTC()
	sets := []string{"username = ?"}
	arguments := []any{changes.Username}
	if changes.PasswordHash != nil {
		sets = append(sets, "password_hash = ?")
		arguments = append(arguments, *changes.PasswordHash)
	}
	if changes.ConnectionIDSet {
		sets = append(sets, "connection_id = ?")
		arguments = append(arguments, optionalString(changes.ConnectionID))
	}
	sets = append(sets, "updated_at = ?")
	arguments = append(arguments, formatTime(now), id)
	query := "UPDATE web_proxy_logins SET " + strings.Join(sets, ", ") + " WHERE id = ?"

	result, err := transaction.ExecContext(ctx, query, arguments...)
	if err != nil {
		return WebProxyLogin{}, fmt.Errorf("update web proxy login: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return WebProxyLogin{}, fmt.Errorf("inspect web proxy login update: %w", err)
	}
	if affectedRows == 0 {
		return WebProxyLogin{}, ErrNotFound
	}

	login, err := scanWebProxyLogin(transaction.QueryRowContext(
		ctx,
		"SELECT "+webProxyLoginColumns+" FROM web_proxy_logins WHERE id = ?",
		id,
	))
	if err != nil {
		return WebProxyLogin{}, err
	}

	if err := transaction.Commit(); err != nil {
		return WebProxyLogin{}, fmt.Errorf("commit web proxy login update: %w", err)
	}

	return login, nil
}

// DeleteWebProxyLogin removes one proxy login.
//
// The credential is independently revocable regardless of the proxy switch.
// Removing the final login leaves an enabled proxy unable to authenticate anyone.
//
// Since: 2.0.0
func (store *Store) DeleteWebProxyLogin(ctx context.Context, id string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin web proxy login deletion: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var exists int
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM web_proxy_logins WHERE id = ?",
		id,
	).Scan(&exists); err != nil {
		return fmt.Errorf("find web proxy login for deletion: %w", err)
	}
	if exists == 0 {
		return ErrNotFound
	}

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM web_proxy_logins WHERE id = ?",
		id,
	); err != nil {
		return fmt.Errorf("delete web proxy login: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit web proxy login deletion: %w", err)
	}

	return nil
}

// checkWebProxyUsername returns ErrWebProxyUsernameTaken when another login uses name.
func checkWebProxyUsername(ctx context.Context, transaction *sql.Tx, username string, id string) error {
	var otherID string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT id FROM web_proxy_logins WHERE username = ? COLLATE NOCASE AND id <> ?",
		username,
		id,
	).Scan(&otherID)
	if err == nil {
		return ErrWebProxyUsernameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check web proxy username: %w", err)
	}

	return nil
}

// scanWebProxy reads the one-row proxy switch.
func scanWebProxy(scanner rowScanner) (WebProxy, error) {
	var proxy WebProxy
	var updatedAtText string
	if err := scanner.Scan(&proxy.Enabled, &updatedAtText); err != nil {
		return WebProxy{}, fmt.Errorf("read web proxy: %w", err)
	}

	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return WebProxy{}, err
	}
	proxy.UpdatedAt = updatedAt

	return proxy, nil
}

// scanWebProxyLogin reads one login from a row or query result.
func scanWebProxyLogin(scanner rowScanner) (WebProxyLogin, error) {
	var login WebProxyLogin
	var connectionID sql.NullString
	var createdAtText, updatedAtText string
	if err := scanner.Scan(
		&login.ID,
		&login.Username,
		&login.PasswordHash,
		&connectionID,
		&createdAtText,
		&updatedAtText,
	); err != nil {
		return WebProxyLogin{}, err
	}

	createdAt, err := parseTime(createdAtText)
	if err != nil {
		return WebProxyLogin{}, err
	}
	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return WebProxyLogin{}, err
	}

	if connectionID.Valid {
		login.ConnectionID = &connectionID.String
	}
	login.CreatedAt = createdAt
	login.UpdatedAt = updatedAt

	return login, nil
}

// optionalString stores a missing string pointer as SQL NULL.
func optionalString(value *string) any {
	if value == nil {
		return nil
	}

	return *value
}
