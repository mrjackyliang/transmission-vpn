package storage

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"
)

// Administrator represents the single local appliance administrator.
//
// Password hashes never leave the storage layer except for the narrowly scoped login
// verifier, and no API response serializes this type directly.
type Administrator struct {
	ID           int64
	Username     string
	PasswordHash string
	CreatedAt    time.Time
}

// SetupClaimStatus reports whether and until when an installation may be claimed.
//
// The digest itself is deliberately omitted so unauthenticated status checks reveal
// only the minimum state needed by the first-run experience.
type SetupClaimStatus struct {
	Required  bool
	ExpiresAt time.Time
}

// Session is a persisted browser authentication session.
//
// Only token and CSRF digests are stored, so a database copy cannot be used directly
// as an active browser credential.
type Session struct {
	ID              string
	AdministratorID int64
	Username        string
	CSRFDigest      []byte
	ExpiresAt       time.Time
}

// ErrTokenNameTaken reports that another API token already uses a name, ignoring
// letter case.
var ErrTokenNameTaken = errors.New("token name is already in use")

// APIToken is the safe metadata view of a scoped automation token.
//
// The plaintext credential is generated outside storage and returned exactly once;
// list operations expose only this metadata.
type APIToken struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Scopes     []string   `json:"scopes"`
	ExpiresAt  *time.Time `json:"expiresAt"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

// APITokenChanges is one edit to an API token's name, scopes, and expiry.
//
// The token's value never changes. KeepExpiration leaves the current expiry in place;
// otherwise ExpiresAt replaces it, and nil removes it.
type APITokenChanges struct {
	Name           string
	Scopes         []string
	ExpiresAt      *time.Time
	KeepExpiration bool
}

// IsClaimed reports whether the local administrator already exists.
//
// First-run claim generation and setup status use this method to ensure a claimed
// installation can never mint another setup credential.
func (store *Store) IsClaimed(ctx context.Context) (bool, error) {
	var count int
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM administrators",
	).Scan(&count); err != nil {
		return false, fmt.Errorf("inspect administrator state: %w", err)
	}

	return count > 0, nil
}

// ReplaceSetupClaim invalidates any previous claim and stores one fresh digest.
//
// Restarting an unclaimed appliance therefore rotates generated claim codes while a
// successful claim permanently removes the setup credential.
func (store *Store) ReplaceSetupClaim(
	ctx context.Context,
	claimDigest []byte,
	expiresAt time.Time,
) error {
	claimed, err := store.IsClaimed(ctx)
	if err != nil {
		return err
	}

	if claimed {
		if _, err := store.databaseHandle().ExecContext(ctx, "DELETE FROM setup_claims"); err != nil {
			return fmt.Errorf("remove stale setup claim: %w", err)
		}

		return nil
	}

	now := formatTime(time.Now())
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO setup_claims (id, claim_digest, expires_at, created_at)
		 VALUES (1, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   claim_digest = excluded.claim_digest,
		   expires_at = excluded.expires_at,
		   created_at = excluded.created_at`,
		claimDigest,
		formatTime(expiresAt),
		now,
	); err != nil {
		return fmt.Errorf("store setup claim: %w", err)
	}

	return nil
}

// SetupClaimStatus returns the minimum state required by the public setup screen.
//
// A claimed installation always reports that no claim is required, even if a stale
// row were left behind by an interrupted older process.
func (store *Store) SetupClaimStatus(ctx context.Context) (SetupClaimStatus, error) {
	claimed, err := store.IsClaimed(ctx)
	if err != nil {
		return SetupClaimStatus{}, err
	}

	if claimed {
		return SetupClaimStatus{Required: false}, nil
	}

	var expirationText string
	err = store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT expires_at FROM setup_claims WHERE id = 1",
	).Scan(&expirationText)
	if errors.Is(err, sql.ErrNoRows) {
		return SetupClaimStatus{Required: true}, nil
	}

	if err != nil {
		return SetupClaimStatus{}, fmt.Errorf("read setup claim status: %w", err)
	}

	expiresAt, err := parseTime(expirationText)
	if err != nil {
		return SetupClaimStatus{}, err
	}

	return SetupClaimStatus{Required: true, ExpiresAt: expiresAt}, nil
}

// ClaimInstallation atomically consumes a valid claim and creates the administrator.
//
// Digest comparison, expiration, singleton creation, and claim deletion occur inside
// one transaction so concurrent claim attempts cannot create ambiguous ownership.
func (store *Store) ClaimInstallation(
	ctx context.Context,
	claimDigest []byte,
	username string,
	passwordHash string,
) (Administrator, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return Administrator{}, fmt.Errorf("begin installation claim: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	var storedDigest []byte
	var expirationText string
	err = transaction.QueryRowContext(
		ctx,
		"SELECT claim_digest, expires_at FROM setup_claims WHERE id = 1",
	).Scan(&storedDigest, &expirationText)
	if errors.Is(err, sql.ErrNoRows) {
		return Administrator{}, ErrClaimInvalid
	}

	if err != nil {
		return Administrator{}, fmt.Errorf("read setup claim: %w", err)
	}

	expiresAt, err := parseTime(expirationText)
	if err != nil {
		return Administrator{}, err
	}

	if time.Now().After(expiresAt) ||
		subtle.ConstantTimeCompare(storedDigest, claimDigest) != 1 {
		return Administrator{}, ErrClaimInvalid
	}

	now := time.Now().UTC()
	result, err := transaction.ExecContext(
		ctx,
		`INSERT INTO administrators (id, username, password_hash, created_at, updated_at)
		 VALUES (1, ?, ?, ?, ?)`,
		username,
		passwordHash,
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return Administrator{}, fmt.Errorf("create administrator: %w", err)
	}

	administratorID, err := result.LastInsertId()
	if err != nil {
		return Administrator{}, fmt.Errorf("read administrator identifier: %w", err)
	}

	if _, err := transaction.ExecContext(ctx, "DELETE FROM setup_claims"); err != nil {
		return Administrator{}, fmt.Errorf("consume setup claim: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return Administrator{}, fmt.Errorf("commit installation claim: %w", err)
	}

	committed = true

	return Administrator{
		ID:           administratorID,
		Username:     username,
		PasswordHash: passwordHash,
		CreatedAt:    now,
	}, nil
}

// FindAdministratorByUsername returns login material for the one local account.
//
// The caller performs constant-cost password verification and maps absence to the same
// generic authentication response as an incorrect password.
func (store *Store) FindAdministratorByUsername(
	ctx context.Context,
	username string,
) (Administrator, error) {
	var administrator Administrator
	var createdAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, username, password_hash, created_at
		 FROM administrators
		 WHERE username = ? COLLATE NOCASE`,
		username,
	).Scan(
		&administrator.ID,
		&administrator.Username,
		&administrator.PasswordHash,
		&createdAtText,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Administrator{}, ErrNotFound
	}

	if err != nil {
		return Administrator{}, fmt.Errorf("find administrator: %w", err)
	}

	administrator.CreatedAt, err = parseTime(createdAtText)
	if err != nil {
		return Administrator{}, err
	}

	return administrator, nil
}

// CreateSession persists digests for a newly issued browser session.
//
// The plaintext session and CSRF tokens remain only in the response cookies and are
// never recoverable from SQLite.
func (store *Store) CreateSession(
	ctx context.Context,
	sessionID string,
	administratorID int64,
	tokenDigest []byte,
	csrfDigest []byte,
	expiresAt time.Time,
) error {
	now := formatTime(time.Now())
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO sessions (
		   id, administrator_id, token_digest, csrf_digest, expires_at, created_at, last_seen_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sessionID,
		administratorID,
		tokenDigest,
		csrfDigest,
		formatTime(expiresAt),
		now,
		now,
	); err != nil {
		return fmt.Errorf("create browser session: %w", err)
	}

	return nil
}

// FindSession authenticates a browser token digest and returns its CSRF boundary.
//
// Expired sessions are treated as absent and opportunistically removed without
// extending their lifetime during reads.
func (store *Store) FindSession(ctx context.Context, tokenDigest []byte) (Session, error) {
	var session Session
	var expirationText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT sessions.id,
		        sessions.administrator_id,
		        administrators.username,
		        sessions.csrf_digest,
		        sessions.expires_at
		 FROM sessions
		 JOIN administrators ON administrators.id = sessions.administrator_id
		 WHERE sessions.token_digest = ?`,
		tokenDigest,
	).Scan(
		&session.ID,
		&session.AdministratorID,
		&session.Username,
		&session.CSRFDigest,
		&expirationText,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrNotFound
	}

	if err != nil {
		return Session{}, fmt.Errorf("find browser session: %w", err)
	}

	session.ExpiresAt, err = parseTime(expirationText)
	if err != nil {
		return Session{}, err
	}

	if time.Now().After(session.ExpiresAt) {
		_, _ = store.databaseHandle().ExecContext(
			ctx,
			"DELETE FROM sessions WHERE id = ?",
			session.ID,
		)

		return Session{}, ErrNotFound
	}

	_, _ = store.databaseHandle().ExecContext(
		ctx,
		"UPDATE sessions SET last_seen_at = ? WHERE id = ?",
		formatTime(time.Now()),
		session.ID,
	)

	return session, nil
}

// DeleteSession revokes one browser session by its stable identifier.
//
// Logout remains idempotent so a repeated browser request does not expose whether the
// credential was already removed.
func (store *Store) DeleteSession(ctx context.Context, sessionID string) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM sessions WHERE id = ?",
		sessionID,
	); err != nil {
		return fmt.Errorf("delete browser session: %w", err)
	}

	return nil
}

// apiTokenColumns lists the safe metadata columns in the order scanAPIToken reads them.
const apiTokenColumns = "id, name, scopes_json, expires_at, created_at, last_used_at"

// CreateAPIToken stores a one-way token digest and its explicit scopes.
//
// Plaintext tokens are generated by the security package and returned once by the
// calling API handler after this transaction succeeds.
func (store *Store) CreateAPIToken(
	ctx context.Context,
	tokenID string,
	administratorID int64,
	name string,
	tokenDigest []byte,
	scopes []string,
	expiresAt *time.Time,
) (APIToken, error) {
	scopesJSON, err := json.Marshal(scopes)
	if err != nil {
		return APIToken{}, fmt.Errorf("encode API token scopes: %w", err)
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return APIToken{}, fmt.Errorf("begin API token creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkAPITokenName(ctx, transaction, name, tokenID); err != nil {
		return APIToken{}, err
	}

	createdAt := time.Now().UTC()
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO api_tokens (
		   id, administrator_id, name, token_digest, scopes_json, expires_at, created_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tokenID,
		administratorID,
		name,
		tokenDigest,
		string(scopesJSON),
		optionalTime(expiresAt),
		formatTime(createdAt),
	); err != nil {
		return APIToken{}, fmt.Errorf("create API token: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return APIToken{}, fmt.Errorf("commit API token creation: %w", err)
	}

	return APIToken{
		ID:        tokenID,
		Name:      name,
		Scopes:    scopes,
		ExpiresAt: expiresAt,
		CreatedAt: createdAt,
	}, nil
}

// FindAPIToken authenticates one active token digest and returns its scopes.
//
// Expired tokens are indistinguishable from unknown credentials at the API boundary,
// and a revoked token no longer exists at all.
func (store *Store) FindAPIToken(ctx context.Context, tokenDigest []byte) (APIToken, error) {
	token, err := store.scanAPIToken(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+apiTokenColumns+" FROM api_tokens WHERE token_digest = ?",
		tokenDigest,
	))
	if err != nil {
		return APIToken{}, err
	}

	if token.ExpiresAt != nil && time.Now().After(*token.ExpiresAt) {
		return APIToken{}, ErrNotFound
	}

	now := time.Now().UTC()
	_, _ = store.databaseHandle().ExecContext(
		ctx,
		"UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
		formatTime(now),
		token.ID,
	)
	token.LastUsedAt = &now

	return token, nil
}

// ListAPITokens returns safe metadata for every token, newest first.
//
// Expired tokens stay listed until they are revoked, and no response ever includes
// plaintext or reusable token digests.
func (store *Store) ListAPITokens(ctx context.Context) ([]APIToken, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT "+apiTokenColumns+" FROM api_tokens ORDER BY created_at DESC, id",
	)
	if err != nil {
		return nil, fmt.Errorf("list API tokens: %w", err)
	}
	defer rows.Close()

	tokens := []APIToken{}
	for rows.Next() {
		token, scanError := store.scanAPIToken(rows)
		if scanError != nil {
			return nil, scanError
		}

		tokens = append(tokens, token)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate API tokens: %w", err)
	}

	// Stored times drop trailing zeros, so their text can misorder tokens created
	// within the same second.
	sort.SliceStable(tokens, func(leftIndex int, rightIndex int) bool {
		return tokens[leftIndex].CreatedAt.After(tokens[rightIndex].CreatedAt)
	})

	return tokens, nil
}

// UpdateAPIToken renames a token and replaces its scopes and, unless kept, its expiry.
//
// The digest is untouched, so apps keep using the same token value, and the new name
// must not belong to another token.
func (store *Store) UpdateAPIToken(
	ctx context.Context,
	tokenID string,
	changes APITokenChanges,
) (APIToken, error) {
	scopesJSON, err := json.Marshal(changes.Scopes)
	if err != nil {
		return APIToken{}, fmt.Errorf("encode API token scopes: %w", err)
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return APIToken{}, fmt.Errorf("begin API token update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkAPITokenName(ctx, transaction, changes.Name, tokenID); err != nil {
		return APIToken{}, err
	}

	statement := "UPDATE api_tokens SET name = ?, scopes_json = ?, expires_at = ? WHERE id = ?"
	arguments := []any{changes.Name, string(scopesJSON), optionalTime(changes.ExpiresAt), tokenID}
	if changes.KeepExpiration {
		statement = "UPDATE api_tokens SET name = ?, scopes_json = ? WHERE id = ?"
		arguments = []any{changes.Name, string(scopesJSON), tokenID}
	}

	result, err := transaction.ExecContext(ctx, statement, arguments...)
	if err != nil {
		return APIToken{}, fmt.Errorf("update API token: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return APIToken{}, fmt.Errorf("inspect API token update: %w", err)
	}

	if affectedRows == 0 {
		return APIToken{}, ErrNotFound
	}

	token, err := store.scanAPIToken(transaction.QueryRowContext(
		ctx,
		"SELECT "+apiTokenColumns+" FROM api_tokens WHERE id = ?",
		tokenID,
	))
	if err != nil {
		return APIToken{}, err
	}

	if err := transaction.Commit(); err != nil {
		return APIToken{}, fmt.Errorf("commit API token update: %w", err)
	}

	return token, nil
}

// DeleteAPIToken revokes one token by deleting it.
//
// Its next request fails authentication because the digest no longer exists, and the
// token disappears from the list.
func (store *Store) DeleteAPIToken(ctx context.Context, tokenID string) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM api_tokens WHERE id = ?",
		tokenID,
	)
	if err != nil {
		return fmt.Errorf("delete API token: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect API token deletion: %w", err)
	}

	if affectedRows == 0 {
		return ErrNotFound
	}

	return nil
}

// checkAPITokenName returns ErrTokenNameTaken when a token other than tokenID already
// uses name, ignoring letter case, so a token may keep its own name in any case.
func checkAPITokenName(ctx context.Context, transaction *sql.Tx, name string, tokenID string) error {
	var otherID string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT id FROM api_tokens WHERE name = ? COLLATE NOCASE AND id <> ?",
		name,
		tokenID,
	).Scan(&otherID)
	if err == nil {
		return ErrTokenNameTaken
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check API token name: %w", err)
	}

	return nil
}

// optionalTime stores a missing timestamp as SQL NULL.
func optionalTime(value *time.Time) any {
	if value == nil {
		return nil
	}

	return formatTime(*value)
}

// CleanupExpiredAuthentication removes credentials that cannot authenticate again.
//
// Startup invokes this bounded maintenance operation so stale sessions do not grow
// indefinitely between future scheduled maintenance passes. Expired API tokens stay
// listed so the administrator can extend or revoke them.
func (store *Store) CleanupExpiredAuthentication(ctx context.Context) error {
	now := formatTime(time.Now())
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM sessions WHERE expires_at <= ?",
		now,
	); err != nil {
		return fmt.Errorf("remove expired sessions: %w", err)
	}

	return store.cleanupExpiredAccountSecurity(ctx, now)
}

// rowScanner captures the common Scan method shared by SQL rows and single rows.
//
// One interface keeps API-token timestamp decoding consistent between lookup and list
// operations without exposing database implementation details.
type rowScanner interface {
	Scan(destinations ...any) error
}

// scanAPIToken decodes safe token metadata from a SQL row.
//
// Nullable timestamps are parsed explicitly so malformed persisted values fail loudly
// instead of appearing as valid credentials.
func (store *Store) scanAPIToken(scanner rowScanner) (APIToken, error) {
	var token APIToken
	var scopesText string
	var expirationText sql.NullString
	var createdAtText string
	var lastUsedAtText sql.NullString
	if err := scanner.Scan(
		&token.ID,
		&token.Name,
		&scopesText,
		&expirationText,
		&createdAtText,
		&lastUsedAtText,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return APIToken{}, ErrNotFound
		}

		return APIToken{}, fmt.Errorf("scan API token: %w", err)
	}

	if err := json.Unmarshal([]byte(scopesText), &token.Scopes); err != nil {
		return APIToken{}, fmt.Errorf("decode API token scopes: %w", err)
	}

	createdAt, err := parseTime(createdAtText)
	if err != nil {
		return APIToken{}, err
	}
	token.CreatedAt = createdAt

	if expirationText.Valid {
		expiresAt, parseError := parseTime(expirationText.String)
		if parseError != nil {
			return APIToken{}, parseError
		}
		token.ExpiresAt = &expiresAt
	}

	if lastUsedAtText.Valid {
		lastUsedAt, parseError := parseTime(lastUsedAtText.String)
		if parseError != nil {
			return APIToken{}, parseError
		}
		token.LastUsedAt = &lastUsedAt
	}

	return token, nil
}
