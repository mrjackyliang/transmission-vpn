package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// installationKeyCheckName names the protected_secrets row that holds the key check.
//
// The row seals a known value with the installation key, so a key that belongs to
// another database is caught at startup instead of on first use.
const installationKeyCheckName = "installation-key-check"

// RemovedSecret names one saved secret that a lost installation key took.
//
// Name and NotificationID are set for a notification destination's secrets.
type RemovedSecret struct {
	Kind           string
	Name           string
	NotificationID string
	RemovedAt      time.Time
}

// RemovedSecretsReport lists what replacing a lost installation key removed.
type RemovedSecretsReport struct {
	VPN                    bool
	AuthenticatorUsernames []string
	NotificationNames      []string
}

// SealedSample is one encrypted value used to test a key before a check value exists.
//
// Connection, profile, and administrator identity let callers rebuild the associated
// data used when the selected sample was sealed.
type SealedSample struct {
	Kind            string
	ConnectionID    string
	ProfileID       string
	LegacyProfileID string
	AdministratorID int64
	Nonce           []byte
	Ciphertext      []byte
}

// InstallationKeyCheck returns the check value sealed with the current key.
func (store *Store) InstallationKeyCheck(ctx context.Context) ([]byte, []byte, bool, error) {
	var nonce, ciphertext []byte
	err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT nonce, ciphertext FROM protected_secrets WHERE key = ?",
		installationKeyCheckName,
	).Scan(&nonce, &ciphertext)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, false, nil
	}

	if err != nil {
		return nil, nil, false, fmt.Errorf("read installation key check: %w", err)
	}

	return nonce, ciphertext, true, nil
}

// SetInstallationKeyCheck stores the check value sealed with the current key.
func (store *Store) SetInstallationKeyCheck(ctx context.Context, nonce []byte, ciphertext []byte) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO protected_secrets (key, nonce, ciphertext, updated_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET
		   nonce = excluded.nonce,
		   ciphertext = excluded.ciphertext,
		   updated_at = excluded.updated_at`,
		installationKeyCheckName,
		nonce,
		ciphertext,
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("store installation key check: %w", err)
	}

	return nil
}

// SealedSample returns one encrypted connection, profile, or authenticator secret.
func (store *Store) SealedSample(ctx context.Context) (SealedSample, bool, error) {
	var sample SealedSample
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, COALESCE(credentials_legacy_profile_id, ''),
		        credentials_nonce, credentials_ciphertext
		 FROM vpn_connections
		 WHERE credentials_nonce IS NOT NULL AND credentials_ciphertext IS NOT NULL
		 ORDER BY slot LIMIT 1`,
	).Scan(
		&sample.ConnectionID,
		&sample.LegacyProfileID,
		&sample.Nonce,
		&sample.Ciphertext,
	)
	if err == nil {
		sample.Kind = "vpn-connection"

		return sample, true, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return SealedSample{}, false, fmt.Errorf("read sealed VPN connection: %w", err)
	}

	err = store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT id, nonce, ciphertext FROM vpn_profiles ORDER BY id LIMIT 1",
	).Scan(&sample.ProfileID, &sample.Nonce, &sample.Ciphertext)
	if err == nil {
		sample.Kind = "vpn-profile"

		return sample, true, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return SealedSample{}, false, fmt.Errorf("read sealed VPN profile: %w", err)
	}

	err = store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, totp_nonce, totp_ciphertext FROM administrators
		 WHERE totp_ciphertext IS NOT NULL
		 ORDER BY id LIMIT 1`,
	).Scan(&sample.AdministratorID, &sample.Nonce, &sample.Ciphertext)
	if errors.Is(err, sql.ErrNoRows) {
		return SealedSample{}, false, nil
	}

	if err != nil {
		return SealedSample{}, false, fmt.Errorf("read sealed authenticator: %w", err)
	}

	sample.Kind = "authenticator"

	return sample, true, nil
}

// ReplaceInstallationKey removes every secret sealed with a lost key and stores the
// check value for the new key, all in one transaction.
//
// VPN profile contents and credentials, each authenticator, and notification secrets
// are removed and recorded so the web interface can ask for them again. VPN connection
// rows and their dependents stay, along with accounts, sessions, tokens, and settings.
func (store *Store) ReplaceInstallationKey(
	ctx context.Context,
	checkNonce []byte,
	checkCiphertext []byte,
) (RemovedSecretsReport, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("begin installation key replacement: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	now := formatTime(time.Now())
	report := RemovedSecretsReport{}

	if err := transaction.QueryRowContext(
		ctx,
		`SELECT EXISTS (SELECT 1 FROM vpn_profiles)
		     OR EXISTS (SELECT 1 FROM vpn_connections)`,
	).Scan(&report.VPN); err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("check sealed VPN settings: %w", err)
	}

	if report.VPN {
		if _, err := transaction.ExecContext(
			ctx,
			`UPDATE vpn_connections
			 SET enabled = 0, credentials_nonce = NULL,
			     credentials_ciphertext = NULL,
			     credentials_legacy_profile_id = NULL, updated_at = ?`,
			now,
		); err != nil {
			return RemovedSecretsReport{}, fmt.Errorf("clear sealed VPN connection details: %w", err)
		}

		for _, statement := range []string{
			"DELETE FROM vpn_connection_endpoints",
			"DELETE FROM vpn_profiles",
			"DELETE FROM vpn_catalogs",
			"DELETE FROM removed_secrets WHERE kind = 'vpn'",
		} {
			if _, err := transaction.ExecContext(ctx, statement); err != nil {
				return RemovedSecretsReport{}, fmt.Errorf("remove sealed VPN settings: %w", err)
			}
		}

		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO removed_secrets (kind, administrator_id, removed_at) VALUES ('vpn', NULL, ?)",
			now,
		); err != nil {
			return RemovedSecretsReport{}, fmt.Errorf("record removed VPN settings: %w", err)
		}
	}

	rows, err := transaction.QueryContext(
		ctx,
		`SELECT id, username FROM administrators
		 WHERE totp_ciphertext IS NOT NULL
		 ORDER BY username`,
	)
	if err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("list sealed authenticators: %w", err)
	}

	administratorIDs := []int64{}
	for rows.Next() {
		var administratorID int64
		var username string
		if err := rows.Scan(&administratorID, &username); err != nil {
			_ = rows.Close()

			return RemovedSecretsReport{}, fmt.Errorf("read sealed authenticator: %w", err)
		}

		administratorIDs = append(administratorIDs, administratorID)
		report.AuthenticatorUsernames = append(report.AuthenticatorUsernames, username)
	}
	if err := rows.Close(); err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("close sealed authenticators: %w", err)
	}

	for _, administratorID := range administratorIDs {
		if _, err := transaction.ExecContext(
			ctx,
			`UPDATE administrators
			 SET totp_nonce = NULL, totp_ciphertext = NULL, totp_enabled_at = NULL, totp_last_step = 0, updated_at = ?
			 WHERE id = ?`,
			now,
			administratorID,
		); err != nil {
			return RemovedSecretsReport{}, fmt.Errorf("turn off sealed authenticator: %w", err)
		}

		for _, statement := range []string{
			"DELETE FROM recovery_codes WHERE administrator_id = ?",
			"DELETE FROM removed_secrets WHERE kind = 'authenticator' AND administrator_id = ?",
		} {
			if _, err := transaction.ExecContext(ctx, statement, administratorID); err != nil {
				return RemovedSecretsReport{}, fmt.Errorf("clear sealed authenticator state: %w", err)
			}
		}

		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO removed_secrets (kind, administrator_id, removed_at) VALUES ('authenticator', ?, ?)",
			administratorID,
			now,
		); err != nil {
			return RemovedSecretsReport{}, fmt.Errorf("record removed authenticator: %w", err)
		}
	}

	report.NotificationNames, err = removeSealedNotificationSecrets(ctx, transaction, now)
	if err != nil {
		return RemovedSecretsReport{}, err
	}

	for _, statement := range []string{
		"DELETE FROM totp_enrollments",
		"DELETE FROM protected_secrets",
	} {
		if _, err := transaction.ExecContext(ctx, statement); err != nil {
			return RemovedSecretsReport{}, fmt.Errorf("remove sealed values: %w", err)
		}
	}

	if _, err := transaction.ExecContext(
		ctx,
		"INSERT INTO protected_secrets (key, nonce, ciphertext, updated_at) VALUES (?, ?, ?, ?)",
		installationKeyCheckName,
		checkNonce,
		checkCiphertext,
		now,
	); err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("store installation key check: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return RemovedSecretsReport{}, fmt.Errorf("commit installation key replacement: %w", err)
	}

	return report, nil
}

// RemovedSecrets lists what a lost key took that one administrator can enter again.
//
// Entries are oldest first and include appliance-wide ones, such as the VPN login and
// notification destinations.
func (store *Store) RemovedSecrets(ctx context.Context, administratorID int64) ([]RemovedSecret, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		`SELECT removed_secrets.kind, COALESCE(notification_targets.name, ''),
		        COALESCE(removed_secrets.notification_id, ''), removed_secrets.removed_at
		 FROM removed_secrets
		 LEFT JOIN notification_targets ON notification_targets.id = removed_secrets.notification_id
		 WHERE removed_secrets.administrator_id = ? OR removed_secrets.administrator_id IS NULL
		 ORDER BY removed_secrets.removed_at, removed_secrets.kind, notification_targets.name`,
		administratorID,
	)
	if err != nil {
		return nil, fmt.Errorf("list removed secrets: %w", err)
	}
	defer rows.Close()

	removedSecrets := []RemovedSecret{}
	for rows.Next() {
		var removedSecret RemovedSecret
		var removedAt string
		if err := rows.Scan(
			&removedSecret.Kind,
			&removedSecret.Name,
			&removedSecret.NotificationID,
			&removedAt,
		); err != nil {
			return nil, fmt.Errorf("read removed secret: %w", err)
		}

		removedSecret.RemovedAt, err = parseTime(removedAt)
		if err != nil {
			return nil, err
		}

		removedSecrets = append(removedSecrets, removedSecret)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list removed secrets: %w", err)
	}

	return removedSecrets, nil
}

// DismissRemovedSecrets clears the notice about removed secrets for one administrator.
//
// Anything not entered again stays removed; only the reminder goes away.
func (store *Store) DismissRemovedSecrets(ctx context.Context, administratorID int64) error {
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM removed_secrets WHERE administrator_id = ? OR administrator_id IS NULL",
		administratorID,
	); err != nil {
		return fmt.Errorf("dismiss removed secrets: %w", err)
	}

	return nil
}
