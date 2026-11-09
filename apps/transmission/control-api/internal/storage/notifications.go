package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"
)

// ErrNotificationNameTaken reports that another destination already uses a name,
// ignoring letter case.
var ErrNotificationNameTaken = errors.New("notification name is already in use")

// NotificationTarget is one destination as stored, with its secrets still sealed.
//
// SecretFields names the sealed fields, and MissingSecrets names the fields a lost
// installation key removed; a destination with missing secrets is skipped.
type NotificationTarget struct {
	ID                string
	Name              string
	Service           string
	Events            []string
	Settings          map[string]string
	SecretFields      []string
	MissingSecrets    []string
	SecretsNonce      []byte
	SecretsCiphertext []byte
	CreatedAt         time.Time
	UpdatedAt         time.Time
	LastAttemptAt     *time.Time
	LastError         *string
}

// NotificationTargetChanges is a destination edit. The service never changes.
//
// The caller seals the merged secrets again and works out which removed secrets are
// still missing.
type NotificationTargetChanges struct {
	Name              string
	Events            []string
	Settings          map[string]string
	SecretFields      []string
	MissingSecrets    []string
	SecretsNonce      []byte
	SecretsCiphertext []byte
}

// notificationTargetColumns lists the columns scanNotificationTarget reads, in order.
const notificationTargetColumns = `id, name, service, events, settings, secret_fields, missing_secrets,
	secrets_nonce, secrets_ciphertext, created_at, updated_at, last_attempt_at, last_error`

// CreateNotificationTarget stores a new destination with its secrets already sealed.
//
// A name another destination uses, ignoring letter case, fails with
// ErrNotificationNameTaken without changing anything.
func (store *Store) CreateNotificationTarget(ctx context.Context, target NotificationTarget) (NotificationTarget, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return NotificationTarget{}, fmt.Errorf("begin notification creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkNotificationName(ctx, transaction, target.Name, target.ID); err != nil {
		return NotificationTarget{}, err
	}

	now := time.Now().UTC()
	target.MissingSecrets = []string{}
	target.CreatedAt = now
	target.UpdatedAt = now

	values, err := encodeNotificationLists(target.Events, target.Settings, target.SecretFields, target.MissingSecrets)
	if err != nil {
		return NotificationTarget{}, err
	}

	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO notification_targets (
		   id, name, service, events, settings, secret_fields, missing_secrets,
		   secrets_nonce, secrets_ciphertext, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		target.ID,
		target.Name,
		target.Service,
		values[0],
		values[1],
		values[2],
		values[3],
		optionalBytes(target.SecretsNonce),
		optionalBytes(target.SecretsCiphertext),
		formatTime(now),
		formatTime(now),
	); err != nil {
		return NotificationTarget{}, fmt.Errorf("create notification: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return NotificationTarget{}, fmt.Errorf("commit notification creation: %w", err)
	}

	return target, nil
}

// ListNotificationTargets returns every destination, newest first.
func (store *Store) ListNotificationTargets(ctx context.Context) ([]NotificationTarget, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT "+notificationTargetColumns+" FROM notification_targets ORDER BY created_at DESC, name",
	)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	targets := []NotificationTarget{}
	for rows.Next() {
		target, err := scanNotificationTarget(rows)
		if err != nil {
			return nil, err
		}

		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}

	return targets, nil
}

// FindNotificationTarget returns one destination, or ErrNotFound.
func (store *Store) FindNotificationTarget(ctx context.Context, id string) (NotificationTarget, error) {
	target, err := scanNotificationTarget(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+notificationTargetColumns+" FROM notification_targets WHERE id = ?",
		id,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return NotificationTarget{}, ErrNotFound
	}

	return target, err
}

// UpdateNotificationTarget saves an edited destination.
//
// When no removed secret is still missing, the lost-key notice entry for it goes away in
// the same transaction.
func (store *Store) UpdateNotificationTarget(
	ctx context.Context,
	id string,
	changes NotificationTargetChanges,
) (NotificationTarget, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return NotificationTarget{}, fmt.Errorf("begin notification update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkNotificationName(ctx, transaction, changes.Name, id); err != nil {
		return NotificationTarget{}, err
	}

	if changes.MissingSecrets == nil {
		changes.MissingSecrets = []string{}
	}

	values, err := encodeNotificationLists(changes.Events, changes.Settings, changes.SecretFields, changes.MissingSecrets)
	if err != nil {
		return NotificationTarget{}, err
	}

	result, err := transaction.ExecContext(
		ctx,
		`UPDATE notification_targets
		 SET name = ?, events = ?, settings = ?, secret_fields = ?, missing_secrets = ?,
		     secrets_nonce = ?, secrets_ciphertext = ?, updated_at = ?
		 WHERE id = ?`,
		changes.Name,
		values[0],
		values[1],
		values[2],
		values[3],
		optionalBytes(changes.SecretsNonce),
		optionalBytes(changes.SecretsCiphertext),
		formatTime(time.Now()),
		id,
	)
	if err != nil {
		return NotificationTarget{}, fmt.Errorf("update notification: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return NotificationTarget{}, fmt.Errorf("inspect notification update: %w", err)
	}

	if affectedRows == 0 {
		return NotificationTarget{}, ErrNotFound
	}

	if len(changes.MissingSecrets) == 0 {
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM removed_secrets WHERE kind = 'notification' AND notification_id = ?",
			id,
		); err != nil {
			return NotificationTarget{}, fmt.Errorf("clear removed notification secrets: %w", err)
		}
	}

	target, err := scanNotificationTarget(transaction.QueryRowContext(
		ctx,
		"SELECT "+notificationTargetColumns+" FROM notification_targets WHERE id = ?",
		id,
	))
	if err != nil {
		return NotificationTarget{}, err
	}

	if err := transaction.Commit(); err != nil {
		return NotificationTarget{}, fmt.Errorf("commit notification update: %w", err)
	}

	return target, nil
}

// DeleteNotificationTarget removes one destination so its alerts stop right away.
//
// A lost-key notice entry for it goes with it through the foreign key.
func (store *Store) DeleteNotificationTarget(ctx context.Context, id string) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		"DELETE FROM notification_targets WHERE id = ?",
		id,
	)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect notification deletion: %w", err)
	}

	if affectedRows == 0 {
		return ErrNotFound
	}

	return nil
}

// RecordNotificationAttempt stores when a destination was last sent to and why it
// failed, if it did. A successful send clears the previous error.
func (store *Store) RecordNotificationAttempt(ctx context.Context, id string, errorMessage *string) error {
	var lastError any
	if errorMessage != nil {
		lastError = *errorMessage
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE notification_targets SET last_attempt_at = ?, last_error = ? WHERE id = ?",
		formatTime(time.Now()),
		lastError,
		id,
	); err != nil {
		return fmt.Errorf("record notification attempt: %w", err)
	}

	return nil
}

// removeSealedNotificationSecrets clears the secrets a lost key sealed and records each
// destination it touched for the lost-key notice.
//
// The destinations stay with their plain settings; their secret fields join the missing
// list so they are skipped until the secrets are entered again.
func removeSealedNotificationSecrets(ctx context.Context, transaction *sql.Tx, now string) ([]string, error) {
	rows, err := transaction.QueryContext(
		ctx,
		`SELECT id, name, secret_fields, missing_secrets FROM notification_targets
		 WHERE secrets_ciphertext IS NOT NULL
		 ORDER BY name`,
	)
	if err != nil {
		return nil, fmt.Errorf("list sealed notification secrets: %w", err)
	}

	type sealedTarget struct {
		ID             string
		Name           string
		MissingSecrets []string
	}

	targets := []sealedTarget{}
	for rows.Next() {
		var target sealedTarget
		var secretFieldsText, missingSecretsText string
		if err := rows.Scan(&target.ID, &target.Name, &secretFieldsText, &missingSecretsText); err != nil {
			_ = rows.Close()

			return nil, fmt.Errorf("read sealed notification secrets: %w", err)
		}

		var secretFields, missingSecrets []string
		if err := json.Unmarshal([]byte(secretFieldsText), &secretFields); err != nil {
			_ = rows.Close()

			return nil, fmt.Errorf("decode notification secret fields: %w", err)
		}
		if err := json.Unmarshal([]byte(missingSecretsText), &missingSecrets); err != nil {
			_ = rows.Close()

			return nil, fmt.Errorf("decode missing notification secrets: %w", err)
		}

		target.MissingSecrets = append(missingSecrets, secretFields...)
		slices.Sort(target.MissingSecrets)
		target.MissingSecrets = slices.Compact(target.MissingSecrets)
		targets = append(targets, target)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close sealed notification secrets: %w", err)
	}

	names := []string{}
	for _, target := range targets {
		missingSecretsJSON, err := json.Marshal(target.MissingSecrets)
		if err != nil {
			return nil, fmt.Errorf("encode missing notification secrets: %w", err)
		}

		if _, err := transaction.ExecContext(
			ctx,
			`UPDATE notification_targets
			 SET secrets_nonce = NULL, secrets_ciphertext = NULL, secret_fields = '[]', missing_secrets = ?
			 WHERE id = ?`,
			string(missingSecretsJSON),
			target.ID,
		); err != nil {
			return nil, fmt.Errorf("remove sealed notification secrets: %w", err)
		}

		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM removed_secrets WHERE kind = 'notification' AND notification_id = ?",
			target.ID,
		); err != nil {
			return nil, fmt.Errorf("clear removed notification secrets: %w", err)
		}

		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO removed_secrets (kind, administrator_id, notification_id, removed_at) VALUES ('notification', NULL, ?, ?)",
			target.ID,
			now,
		); err != nil {
			return nil, fmt.Errorf("record removed notification secrets: %w", err)
		}

		names = append(names, target.Name)
	}

	return names, nil
}

// checkNotificationName returns ErrNotificationNameTaken when a destination other than
// id already uses name, ignoring letter case, so a destination may keep its own name in
// any case.
func checkNotificationName(ctx context.Context, transaction *sql.Tx, name string, id string) error {
	var otherID string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT id FROM notification_targets WHERE name = ? COLLATE NOCASE AND id <> ?",
		name,
		id,
	).Scan(&otherID)
	if err == nil {
		return ErrNotificationNameTaken
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check notification name: %w", err)
	}

	return nil
}

// encodeNotificationLists writes a destination's events, settings, secret fields, and
// missing secrets as the JSON text the table stores.
func encodeNotificationLists(
	events []string,
	settings map[string]string,
	secretFields []string,
	missingSecrets []string,
) ([4]string, error) {
	if settings == nil {
		settings = map[string]string{}
	}

	if secretFields == nil {
		secretFields = []string{}
	}

	values := [4]string{}
	for index, value := range []any{events, settings, secretFields, missingSecrets} {
		encoded, err := json.Marshal(value)
		if err != nil {
			return values, fmt.Errorf("encode notification: %w", err)
		}

		values[index] = string(encoded)
	}

	return values, nil
}

// scanNotificationTarget decodes one destination row.
//
// JSON columns and timestamps are decoded strictly, so a damaged row fails loudly
// instead of sending to the wrong place.
func scanNotificationTarget(scanner rowScanner) (NotificationTarget, error) {
	var target NotificationTarget
	var eventsText, settingsText, secretFieldsText, missingSecretsText string
	var createdAtText, updatedAtText string
	var lastAttemptAtText, lastError sql.NullString
	if err := scanner.Scan(
		&target.ID,
		&target.Name,
		&target.Service,
		&eventsText,
		&settingsText,
		&secretFieldsText,
		&missingSecretsText,
		&target.SecretsNonce,
		&target.SecretsCiphertext,
		&createdAtText,
		&updatedAtText,
		&lastAttemptAtText,
		&lastError,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return NotificationTarget{}, err
		}

		return NotificationTarget{}, fmt.Errorf("read notification: %w", err)
	}

	for _, column := range []struct {
		text  string
		value any
	}{
		{eventsText, &target.Events},
		{settingsText, &target.Settings},
		{secretFieldsText, &target.SecretFields},
		{missingSecretsText, &target.MissingSecrets},
	} {
		if err := json.Unmarshal([]byte(column.text), column.value); err != nil {
			return NotificationTarget{}, fmt.Errorf("decode notification: %w", err)
		}
	}

	var err error
	if target.CreatedAt, err = parseTime(createdAtText); err != nil {
		return NotificationTarget{}, err
	}

	if target.UpdatedAt, err = parseTime(updatedAtText); err != nil {
		return NotificationTarget{}, err
	}

	if lastAttemptAtText.Valid {
		lastAttemptAt, err := parseTime(lastAttemptAtText.String)
		if err != nil {
			return NotificationTarget{}, err
		}

		target.LastAttemptAt = &lastAttemptAt
	}

	if lastError.Valid {
		target.LastError = &lastError.String
	}

	if target.Settings == nil {
		target.Settings = map[string]string{}
	}

	if target.SecretFields == nil {
		target.SecretFields = []string{}
	}

	if target.MissingSecrets == nil {
		target.MissingSecrets = []string{}
	}

	return target, nil
}

// optionalBytes stores a missing sealed value as SQL NULL.
func optionalBytes(value []byte) any {
	if value == nil {
		return nil
	}

	return value
}
