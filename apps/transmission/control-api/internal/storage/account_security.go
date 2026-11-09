package storage

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrReplayed indicates that an authenticator code was already used.
var ErrReplayed = errors.New("authenticator code was already used")

// ErrUsernameTaken reports that another administrator already uses a username,
// compared without regard to letter case.
var ErrUsernameTaken = errors.New("username is already in use")

// AccountSecurity is the second-factor state of the administrator account.
//
// The encrypted TOTP secret stays inside storage and the API layer; responses only
// ever report whether it is enabled.
type AccountSecurity struct {
	TOTPEnabled            bool
	TOTPNonce              []byte
	TOTPCiphertext         []byte
	TOTPLastStep           int64
	RecoveryCodesRemaining int
}

// SignInChallenge is the half-finished sign-in after a correct password when a
// second factor is still required.
type SignInChallenge struct {
	ID              string
	AdministratorID int64
	Failures        int
	ExpiresAt       time.Time
}

// Passkey is one stored WebAuthn credential and the hostname it belongs to.
type Passkey struct {
	ID              string
	AdministratorID int64
	Name            string
	RPID            string
	CredentialJSON  string
	CreatedAt       time.Time
	LastUsedAt      *time.Time
}

// FindAdministratorByID returns the administrator with their password verifier.
func (store *Store) FindAdministratorByID(ctx context.Context, administratorID int64) (Administrator, error) {
	var administrator Administrator
	var createdAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, username, password_hash, created_at
		 FROM administrators
		 WHERE id = ?`,
		administratorID,
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
		return Administrator{}, fmt.Errorf("find administrator by id: %w", err)
	}

	administrator.CreatedAt, err = parseTime(createdAtText)
	if err != nil {
		return Administrator{}, err
	}

	return administrator, nil
}

// UpdateAdministratorPassword stores a new password verifier and signs out every
// other browser session, keeping only the session that made the change.
func (store *Store) UpdateAdministratorPassword(
	ctx context.Context,
	administratorID int64,
	passwordHash string,
	keepSessionID string,
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin password change: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE administrators SET password_hash = ?, updated_at = ? WHERE id = ?",
		passwordHash,
		formatTime(time.Now()),
		administratorID,
	); err != nil {
		return fmt.Errorf("update administrator password: %w", err)
	}

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM sessions WHERE administrator_id = ? AND id <> ?",
		administratorID,
		keepSessionID,
	); err != nil {
		return fmt.Errorf("sign out other sessions: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit password change: %w", err)
	}

	return nil
}

// UpdateAdministratorUsername renames the administrator. Usernames are unique without
// regard to letter case, and signed-in sessions pick up the new name on their next
// request because they read it from this table.
func (store *Store) UpdateAdministratorUsername(
	ctx context.Context,
	administratorID int64,
	username string,
) (Administrator, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return Administrator{}, fmt.Errorf("begin username change: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var otherID int64
	err = transaction.QueryRowContext(
		ctx,
		"SELECT id FROM administrators WHERE username = ? COLLATE NOCASE AND id <> ?",
		username,
		administratorID,
	).Scan(&otherID)
	if err == nil {
		return Administrator{}, ErrUsernameTaken
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return Administrator{}, fmt.Errorf("check username: %w", err)
	}

	result, err := transaction.ExecContext(
		ctx,
		"UPDATE administrators SET username = ?, updated_at = ? WHERE id = ?",
		username,
		formatTime(time.Now()),
		administratorID,
	)
	if err != nil {
		return Administrator{}, fmt.Errorf("update administrator username: %w", err)
	}

	changed, err := result.RowsAffected()
	if err != nil {
		return Administrator{}, fmt.Errorf("read username change result: %w", err)
	}

	if changed == 0 {
		return Administrator{}, ErrNotFound
	}

	if err := transaction.Commit(); err != nil {
		return Administrator{}, fmt.Errorf("commit username change: %w", err)
	}

	return store.FindAdministratorByID(ctx, administratorID)
}

// AccountSecurity loads the administrator's second-factor state.
func (store *Store) AccountSecurity(ctx context.Context, administratorID int64) (AccountSecurity, error) {
	var security AccountSecurity
	var enabledAt sql.NullString
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT totp_nonce, totp_ciphertext, totp_enabled_at, totp_last_step,
		        (SELECT COUNT(*) FROM recovery_codes
		         WHERE recovery_codes.administrator_id = administrators.id AND used_at IS NULL)
		 FROM administrators
		 WHERE id = ?`,
		administratorID,
	).Scan(
		&security.TOTPNonce,
		&security.TOTPCiphertext,
		&enabledAt,
		&security.TOTPLastStep,
		&security.RecoveryCodesRemaining,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return AccountSecurity{}, ErrNotFound
	}

	if err != nil {
		return AccountSecurity{}, fmt.Errorf("read account security: %w", err)
	}

	security.TOTPEnabled = enabledAt.Valid && len(security.TOTPCiphertext) > 0

	return security, nil
}

// SaveTOTPEnrollment keeps a not-yet-confirmed authenticator secret for a short time.
func (store *Store) SaveTOTPEnrollment(
	ctx context.Context,
	administratorID int64,
	nonce []byte,
	ciphertext []byte,
	expiresAt time.Time,
) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO totp_enrollments (administrator_id, nonce, ciphertext, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(administrator_id) DO UPDATE SET
		   nonce = excluded.nonce,
		   ciphertext = excluded.ciphertext,
		   expires_at = excluded.expires_at,
		   created_at = excluded.created_at`,
		administratorID,
		nonce,
		ciphertext,
		formatTime(expiresAt),
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("store authenticator enrollment: %w", err)
	}

	return nil
}

// TOTPEnrollment returns the pending authenticator secret if it has not expired.
func (store *Store) TOTPEnrollment(ctx context.Context, administratorID int64) ([]byte, []byte, error) {
	var nonce []byte
	var ciphertext []byte
	var expiresAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT nonce, ciphertext, expires_at FROM totp_enrollments WHERE administrator_id = ?",
		administratorID,
	).Scan(&nonce, &ciphertext, &expiresAtText)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, ErrNotFound
	}

	if err != nil {
		return nil, nil, fmt.Errorf("read authenticator enrollment: %w", err)
	}

	expiresAt, err := parseTime(expiresAtText)
	if err != nil {
		return nil, nil, err
	}

	if time.Now().After(expiresAt) {
		return nil, nil, ErrNotFound
	}

	return nonce, ciphertext, nil
}

// EnableTOTP turns on the authenticator and replaces the recovery codes in one
// transaction, so a crash can never leave TOTP on without a way back in. It also
// clears the notice about an authenticator removed with a lost installation key.
func (store *Store) EnableTOTP(
	ctx context.Context,
	administratorID int64,
	nonce []byte,
	ciphertext []byte,
	acceptedStep int64,
	recoveryCodeDigests [][]byte,
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin authenticator enable: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	now := formatTime(time.Now())
	if _, err := transaction.ExecContext(
		ctx,
		`UPDATE administrators
		 SET totp_nonce = ?, totp_ciphertext = ?, totp_enabled_at = ?, totp_last_step = ?, updated_at = ?
		 WHERE id = ?`,
		nonce,
		ciphertext,
		now,
		acceptedStep,
		now,
		administratorID,
	); err != nil {
		return fmt.Errorf("enable authenticator: %w", err)
	}

	if _, err := transaction.ExecContext(ctx, "DELETE FROM totp_enrollments WHERE administrator_id = ?", administratorID); err != nil {
		return fmt.Errorf("clear authenticator enrollment: %w", err)
	}

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM removed_secrets WHERE kind = 'authenticator' AND administrator_id = ?",
		administratorID,
	); err != nil {
		return fmt.Errorf("clear removed authenticator notice: %w", err)
	}

	if err := replaceRecoveryCodes(ctx, transaction, administratorID, recoveryCodeDigests); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit authenticator enable: %w", err)
	}

	return nil
}

// DisableTOTP removes the authenticator secret, pending enrollment and recovery codes.
func (store *Store) DisableTOTP(ctx context.Context, administratorID int64) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin authenticator disable: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if _, err := transaction.ExecContext(
		ctx,
		`UPDATE administrators
		 SET totp_nonce = NULL, totp_ciphertext = NULL, totp_enabled_at = NULL, totp_last_step = 0, updated_at = ?
		 WHERE id = ?`,
		formatTime(time.Now()),
		administratorID,
	); err != nil {
		return fmt.Errorf("disable authenticator: %w", err)
	}

	for _, statement := range []string{
		"DELETE FROM totp_enrollments WHERE administrator_id = ?",
		"DELETE FROM recovery_codes WHERE administrator_id = ?",
	} {
		if _, err := transaction.ExecContext(ctx, statement, administratorID); err != nil {
			return fmt.Errorf("clear authenticator state: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit authenticator disable: %w", err)
	}

	return nil
}

// RecordTOTPStep accepts an authenticator step only if it is newer than the last one,
// so the same code cannot be used twice even by two requests racing each other.
func (store *Store) RecordTOTPStep(ctx context.Context, administratorID int64, step int64) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE administrators SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?",
		step,
		administratorID,
		step,
	)
	if err != nil {
		return fmt.Errorf("record authenticator step: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect authenticator step: %w", err)
	}

	if affectedRows == 0 {
		return ErrReplayed
	}

	return nil
}

// ReplaceRecoveryCodes swaps in a new set of recovery code digests.
func (store *Store) ReplaceRecoveryCodes(ctx context.Context, administratorID int64, digests [][]byte) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin recovery code replacement: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := replaceRecoveryCodes(ctx, transaction, administratorID, digests); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit recovery code replacement: %w", err)
	}

	return nil
}

// ConsumeRecoveryCode marks one unused recovery code as used.
//
// It returns ErrNotFound for unknown or already-used codes.
func (store *Store) ConsumeRecoveryCode(ctx context.Context, administratorID int64, digest []byte) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		`UPDATE recovery_codes SET used_at = ?
		 WHERE code_digest = ? AND administrator_id = ? AND used_at IS NULL`,
		formatTime(time.Now()),
		digest,
		administratorID,
	)
	if err != nil {
		return fmt.Errorf("consume recovery code: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect recovery code: %w", err)
	}

	if affectedRows == 0 {
		return ErrNotFound
	}

	return nil
}

// CreateSignInChallenge stores the digest of a second-factor challenge token.
func (store *Store) CreateSignInChallenge(
	ctx context.Context,
	challengeID string,
	administratorID int64,
	challengeDigest []byte,
	expiresAt time.Time,
) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO sign_in_challenges (id, administrator_id, challenge_digest, failures, expires_at, created_at)
		 VALUES (?, ?, ?, 0, ?, ?)`,
		challengeID,
		administratorID,
		challengeDigest,
		formatTime(expiresAt),
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("store sign-in challenge: %w", err)
	}

	return nil
}

// FindSignInChallenge returns an unexpired challenge by its token digest.
func (store *Store) FindSignInChallenge(ctx context.Context, challengeDigest []byte) (SignInChallenge, error) {
	var challenge SignInChallenge
	var expiresAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT id, administrator_id, failures, expires_at FROM sign_in_challenges WHERE challenge_digest = ?",
		challengeDigest,
	).Scan(&challenge.ID, &challenge.AdministratorID, &challenge.Failures, &expiresAtText)
	if errors.Is(err, sql.ErrNoRows) {
		return SignInChallenge{}, ErrNotFound
	}

	if err != nil {
		return SignInChallenge{}, fmt.Errorf("find sign-in challenge: %w", err)
	}

	challenge.ExpiresAt, err = parseTime(expiresAtText)
	if err != nil {
		return SignInChallenge{}, err
	}

	if time.Now().After(challenge.ExpiresAt) {
		_ = store.DeleteSignInChallenge(ctx, challenge.ID)

		return SignInChallenge{}, ErrNotFound
	}

	return challenge, nil
}

// RecordSignInChallengeFailure counts a wrong code against one challenge.
func (store *Store) RecordSignInChallengeFailure(ctx context.Context, challengeID string) (int, error) {
	var failures int
	err := store.databaseHandle().QueryRowContext(
		ctx,
		"UPDATE sign_in_challenges SET failures = failures + 1 WHERE id = ? RETURNING failures",
		challengeID,
	).Scan(&failures)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}

	if err != nil {
		return 0, fmt.Errorf("record sign-in challenge failure: %w", err)
	}

	return failures, nil
}

// DeleteSignInChallenge removes a used or abandoned challenge.
func (store *Store) DeleteSignInChallenge(ctx context.Context, challengeID string) error {
	if _, err := store.databaseHandle().ExecContext(ctx, "DELETE FROM sign_in_challenges WHERE id = ?", challengeID); err != nil {
		return fmt.Errorf("delete sign-in challenge: %w", err)
	}

	return nil
}

// EnsureWebAuthnUserID returns the administrator's random passkey user handle,
// creating it on first use. Browsers store this handle with each passkey.
func (store *Store) EnsureWebAuthnUserID(ctx context.Context, administratorID int64) ([]byte, error) {
	var userID []byte
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT webauthn_user_id FROM administrators WHERE id = ?",
		administratorID,
	).Scan(&userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}

		return nil, fmt.Errorf("read passkey user handle: %w", err)
	}

	if len(userID) > 0 {
		return userID, nil
	}

	userID = make([]byte, 32)
	if _, err := rand.Read(userID); err != nil {
		return nil, fmt.Errorf("generate passkey user handle: %w", err)
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE administrators SET webauthn_user_id = ? WHERE id = ? AND webauthn_user_id IS NULL",
		userID,
		administratorID,
	); err != nil {
		return nil, fmt.Errorf("store passkey user handle: %w", err)
	}

	return store.EnsureWebAuthnUserID(ctx, administratorID)
}

// FindAdministratorByWebAuthnUserID resolves the user handle a passkey returns.
func (store *Store) FindAdministratorByWebAuthnUserID(ctx context.Context, userID []byte) (Administrator, error) {
	var administratorID int64
	err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT id FROM administrators WHERE webauthn_user_id = ?",
		userID,
	).Scan(&administratorID)
	if errors.Is(err, sql.ErrNoRows) {
		return Administrator{}, ErrNotFound
	}

	if err != nil {
		return Administrator{}, fmt.Errorf("find administrator by passkey user handle: %w", err)
	}

	return store.FindAdministratorByID(ctx, administratorID)
}

// CreatePasskey stores a newly registered passkey.
func (store *Store) CreatePasskey(ctx context.Context, passkey Passkey) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO passkeys (id, administrator_id, name, rp_id, credential_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		passkey.ID,
		passkey.AdministratorID,
		passkey.Name,
		passkey.RPID,
		passkey.CredentialJSON,
		formatTime(passkey.CreatedAt),
	); err != nil {
		return fmt.Errorf("store passkey: %w", err)
	}

	return nil
}

// ListPasskeys returns every passkey of the administrator, newest first. An empty
// rpID lists all hostnames; otherwise only passkeys made on that hostname are returned.
func (store *Store) ListPasskeys(ctx context.Context, administratorID int64, rpID string) ([]Passkey, error) {
	query := `SELECT id, administrator_id, name, rp_id, credential_json, created_at, last_used_at
	          FROM passkeys WHERE administrator_id = ?`
	arguments := []any{administratorID}
	if rpID != "" {
		query += " AND rp_id = ?"
		arguments = append(arguments, rpID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := store.databaseHandle().QueryContext(ctx, query, arguments...)
	if err != nil {
		return nil, fmt.Errorf("list passkeys: %w", err)
	}
	defer rows.Close()

	passkeys := []Passkey{}
	for rows.Next() {
		var passkey Passkey
		var createdAtText string
		var lastUsedAtText sql.NullString
		if err := rows.Scan(
			&passkey.ID,
			&passkey.AdministratorID,
			&passkey.Name,
			&passkey.RPID,
			&passkey.CredentialJSON,
			&createdAtText,
			&lastUsedAtText,
		); err != nil {
			return nil, fmt.Errorf("scan passkey: %w", err)
		}

		passkey.CreatedAt, err = parseTime(createdAtText)
		if err != nil {
			return nil, err
		}

		if lastUsedAtText.Valid {
			lastUsedAt, parseError := parseTime(lastUsedAtText.String)
			if parseError != nil {
				return nil, parseError
			}
			passkey.LastUsedAt = &lastUsedAt
		}

		passkeys = append(passkeys, passkey)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate passkeys: %w", err)
	}

	return passkeys, nil
}

// UpdatePasskeyUse stores the credential after a sign-in (its signature counter moves)
// and records when it was last used.
func (store *Store) UpdatePasskeyUse(ctx context.Context, passkeyID string, credentialJSON string) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE passkeys SET credential_json = ?, last_used_at = ? WHERE id = ?",
		credentialJSON,
		formatTime(time.Now()),
		passkeyID,
	); err != nil {
		return fmt.Errorf("update passkey use: %w", err)
	}

	return nil
}

// DeletePasskey removes one of the administrator's passkeys.
func (store *Store) DeletePasskey(ctx context.Context, administratorID int64, passkeyID string) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM passkeys WHERE id = ? AND administrator_id = ?",
		passkeyID,
		administratorID,
	)
	if err != nil {
		return fmt.Errorf("delete passkey: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect passkey removal: %w", err)
	}

	if affectedRows == 0 {
		return ErrNotFound
	}

	return nil
}

// CreateWebAuthnCeremony stores the server half of a passkey ceremony.
func (store *Store) CreateWebAuthnCeremony(
	ctx context.Context,
	ceremonyID string,
	kind string,
	administratorID *int64,
	sessionJSON string,
	expiresAt time.Time,
) error {
	var administratorValue any
	if administratorID != nil {
		administratorValue = *administratorID
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO webauthn_ceremonies (id, kind, administrator_id, session_json, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		ceremonyID,
		kind,
		administratorValue,
		sessionJSON,
		formatTime(expiresAt),
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("store passkey ceremony: %w", err)
	}

	return nil
}

// TakeWebAuthnCeremony returns and deletes a ceremony, so each one is used once.
//
// Ceremonies of another kind or past their expiry report ErrNotFound.
func (store *Store) TakeWebAuthnCeremony(
	ctx context.Context,
	ceremonyID string,
	kind string,
) (*int64, string, error) {
	var administratorID sql.NullInt64
	var sessionJSON string
	var expiresAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`DELETE FROM webauthn_ceremonies
		 WHERE id = ? AND kind = ?
		 RETURNING administrator_id, session_json, expires_at`,
		ceremonyID,
		kind,
	).Scan(&administratorID, &sessionJSON, &expiresAtText)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", ErrNotFound
	}

	if err != nil {
		return nil, "", fmt.Errorf("take passkey ceremony: %w", err)
	}

	expiresAt, err := parseTime(expiresAtText)
	if err != nil {
		return nil, "", err
	}

	if time.Now().After(expiresAt) {
		return nil, "", ErrNotFound
	}

	if !administratorID.Valid {
		return nil, sessionJSON, nil
	}

	value := administratorID.Int64

	return &value, sessionJSON, nil
}

// cleanupExpiredAccountSecurity deletes abandoned challenges, ceremonies and
// enrollments. It runs with the existing startup cleanup.
func (store *Store) cleanupExpiredAccountSecurity(ctx context.Context, now string) error {
	for _, statement := range []string{
		"DELETE FROM sign_in_challenges WHERE expires_at <= ?",
		"DELETE FROM webauthn_ceremonies WHERE expires_at <= ?",
		"DELETE FROM totp_enrollments WHERE expires_at <= ?",
	} {
		if _, err := store.databaseHandle().ExecContext(ctx, statement, now); err != nil {
			return fmt.Errorf("remove expired sign-in state: %w", err)
		}
	}

	return nil
}

// replaceRecoveryCodes swaps recovery codes inside an existing transaction.
func replaceRecoveryCodes(ctx context.Context, transaction *sql.Tx, administratorID int64, digests [][]byte) error {
	if _, err := transaction.ExecContext(ctx, "DELETE FROM recovery_codes WHERE administrator_id = ?", administratorID); err != nil {
		return fmt.Errorf("clear recovery codes: %w", err)
	}

	now := formatTime(time.Now())
	for _, digest := range digests {
		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO recovery_codes (code_digest, administrator_id, created_at) VALUES (?, ?, ?)",
			digest,
			administratorID,
			now,
		); err != nil {
			return fmt.Errorf("store recovery code: %w", err)
		}
	}

	return nil
}
