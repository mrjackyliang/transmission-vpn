package storage

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// MaximumBackupNotificationDestinations caps destinations retained after an import.
//
// Matching destinations can still be replaced when the installation is at capacity.
//
// Since: UNRELEASED
const MaximumBackupNotificationDestinations = 256

// MaximumBackupRPCLogins caps compatible-RPC logins retained after an import.
//
// Matching usernames can still be replaced when the installation is at capacity.
//
// Since: UNRELEASED
const MaximumBackupRPCLogins = 256

// MaximumBackupAPITokens caps scoped API tokens retained after an import.
//
// Duplicate tokens are skipped before the capacity check so they consume no space.
//
// Since: UNRELEASED
const MaximumBackupAPITokens = 256

// BackupMergeResult reports every merge action and capacity skip.
//
// Preview and apply callers use the same counts so user-facing review copy matches
// the rows the storage transaction changes.
//
// Since: UNRELEASED
type BackupMergeResult struct {
	NotificationReplacements int
	NotificationAdditions    int
	NotificationMaximumSkips int
	RPCLoginReplacements     int
	RPCLoginAdditions        int
	RPCLoginMaximumSkips     int
	APITokenAdditions        int
	APITokenDuplicateSkips   int
	APITokenMaximumSkips     int
}

// BackupRemoteAccess is the digest-bearing remote credential set restored together.
//
// Since: UNRELEASED
type BackupRemoteAccess struct {
	RPCLogins []RPCLogin
	APITokens []BackupAPIToken
}

type backupNotificationMergeDecision struct {
	Target    NotificationTarget
	ReplaceID string
}

type backupNotificationMergePlan struct {
	Result    BackupMergeResult
	Decisions []backupNotificationMergeDecision
}

type backupRPCLoginMergeDecision struct {
	Login     RPCLogin
	ReplaceID string
}

type backupRemoteAccessMergePlan struct {
	Result    BackupMergeResult
	RPCLogins []backupRPCLoginMergeDecision
	APITokens []BackupAPIToken
}

type backupRestoreQueryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

// PlanBackupRemoteAccess reports how an import would merge remote credentials.
//
// The preview reads digest-bearing token records internally but returns only counts.
//
// Since: UNRELEASED
func (store *Store) PlanBackupRemoteAccess(
	ctx context.Context,
	backup BackupRemoteAccess,
) (BackupMergeResult, error) {
	logins, err := listBackupRPCLogins(ctx, store.databaseHandle())
	if err != nil {
		return BackupMergeResult{}, err
	}
	tokens, err := listBackupAPITokens(ctx, store.databaseHandle())
	if err != nil {
		return BackupMergeResult{}, err
	}

	return planBackupRemoteAccess(logins, tokens, backup).Result, nil
}

// MergeBackupRemoteAccess merges RPC logins and API tokens in one transaction.
//
// Matching usernames replace RPC logins, duplicate tokens stay untouched, and rows
// absent from the backup remain. Browser sessions and the administrator are untouched.
//
// Since: UNRELEASED
func (store *Store) MergeBackupRemoteAccess(
	ctx context.Context,
	administratorID int64,
	backup BackupRemoteAccess,
) (BackupMergeResult, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return BackupMergeResult{}, fmt.Errorf("begin remote-access restore: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	currentLogins, err := listBackupRPCLogins(ctx, transaction)
	if err != nil {
		return BackupMergeResult{}, err
	}
	currentTokens, err := listBackupAPITokens(ctx, transaction)
	if err != nil {
		return BackupMergeResult{}, err
	}
	plan := planBackupRemoteAccess(currentLogins, currentTokens, backup)

	for _, decision := range plan.RPCLogins {
		if decision.ReplaceID != "" {
			if _, err := transaction.ExecContext(
				ctx,
				"DELETE FROM rpc_logins WHERE id = ?",
				decision.ReplaceID,
			); err != nil {
				return BackupMergeResult{}, fmt.Errorf("replace RPC login %s: %w", decision.Login.Username, err)
			}
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO rpc_logins (
			   id, username, secret_digest, created_at, updated_at, last_used_at
			 ) VALUES (?, ?, ?, ?, ?, ?)`,
			decision.Login.ID,
			decision.Login.Username,
			decision.Login.SecretDigest,
			formatTime(decision.Login.CreatedAt),
			formatTime(decision.Login.UpdatedAt),
			optionalTime(decision.Login.LastUsedAt),
		); err != nil {
			return BackupMergeResult{}, fmt.Errorf("restore RPC login %s: %w", decision.Login.Username, err)
		}
	}

	for _, token := range plan.APITokens {
		scopesJSON, err := json.Marshal(token.Scopes)
		if err != nil {
			return BackupMergeResult{}, fmt.Errorf("encode restored API token scopes: %w", err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO api_tokens (
			   id, administrator_id, name, token_digest, scopes_json, expires_at,
			   created_at, last_used_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			token.ID,
			administratorID,
			token.Name,
			token.Digest,
			string(scopesJSON),
			optionalTime(token.ExpiresAt),
			formatTime(token.CreatedAt),
			optionalTime(token.LastUsedAt),
		); err != nil {
			return BackupMergeResult{}, fmt.Errorf("restore API token %s: %w", token.Name, err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return BackupMergeResult{}, fmt.Errorf("commit remote-access restore: %w", err)
	}

	return plan.Result, nil
}

// PlanBackupNotifications reports how an import would merge destinations.
//
// Names are matched without regard to case, and replacements remain possible at the
// destination cap because they do not increase the stored row count.
//
// Since: UNRELEASED
func (store *Store) PlanBackupNotifications(
	ctx context.Context,
	targets []NotificationTarget,
) (BackupMergeResult, error) {
	currentTargets, err := listBackupNotificationTargets(ctx, store.databaseHandle())
	if err != nil {
		return BackupMergeResult{}, err
	}

	return planBackupNotifications(currentTargets, targets).Result, nil
}

// MergeBackupNotifications merges destinations by case-insensitive name.
//
// Matching rows are replaced, new rows are added up to the cap, and destinations not
// named by the backup remain. Callers seal secrets with each incoming destination ID.
//
// Since: UNRELEASED
func (store *Store) MergeBackupNotifications(
	ctx context.Context,
	targets []NotificationTarget,
) (BackupMergeResult, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return BackupMergeResult{}, fmt.Errorf("begin notification restore: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	currentTargets, err := listBackupNotificationTargets(ctx, transaction)
	if err != nil {
		return BackupMergeResult{}, err
	}
	plan := planBackupNotifications(currentTargets, targets)

	now := time.Now().UTC()
	for _, decision := range plan.Decisions {
		if decision.ReplaceID != "" {
			if _, err := transaction.ExecContext(
				ctx,
				"DELETE FROM notification_targets WHERE id = ?",
				decision.ReplaceID,
			); err != nil {
				return BackupMergeResult{}, fmt.Errorf("replace notification %s: %w", decision.Target.Name, err)
			}
		}
		values, err := encodeNotificationLists(
			decision.Target.Events,
			decision.Target.Settings,
			decision.Target.SecretFields,
			[]string{},
		)
		if err != nil {
			return BackupMergeResult{}, err
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO notification_targets (
			   id, name, service, events, settings, secret_fields, missing_secrets,
			   secrets_nonce, secrets_ciphertext, created_at, updated_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			decision.Target.ID,
			decision.Target.Name,
			decision.Target.Service,
			values[0],
			values[1],
			values[2],
			values[3],
			optionalBytes(decision.Target.SecretsNonce),
			optionalBytes(decision.Target.SecretsCiphertext),
			formatTime(now),
			formatTime(now),
		); err != nil {
			return BackupMergeResult{}, fmt.Errorf("restore notification %s: %w", decision.Target.Name, err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return BackupMergeResult{}, fmt.Errorf("commit notification restore: %w", err)
	}

	return plan.Result, nil
}

func planBackupNotifications(
	currentTargets []NotificationTarget,
	targets []NotificationTarget,
) backupNotificationMergePlan {
	current := append([]NotificationTarget{}, currentTargets...)
	plan := backupNotificationMergePlan{
		Decisions: make([]backupNotificationMergeDecision, 0, len(targets)),
	}
	for _, target := range targets {
		replaceIndex := -1
		for index := range current {
			if strings.EqualFold(current[index].Name, target.Name) {
				replaceIndex = index

				break
			}
		}
		if replaceIndex >= 0 {
			plan.Result.NotificationReplacements++
			plan.Decisions = append(plan.Decisions, backupNotificationMergeDecision{
				Target:    target,
				ReplaceID: current[replaceIndex].ID,
			})
			current[replaceIndex] = target

			continue
		}
		if len(current) >= MaximumBackupNotificationDestinations {
			plan.Result.NotificationMaximumSkips++

			continue
		}

		plan.Result.NotificationAdditions++
		plan.Decisions = append(plan.Decisions, backupNotificationMergeDecision{Target: target})
		current = append(current, target)
	}

	return plan
}

func planBackupRemoteAccess(
	currentLogins []RPCLogin,
	currentTokens []BackupAPIToken,
	backup BackupRemoteAccess,
) backupRemoteAccessMergePlan {
	logins := append([]RPCLogin{}, currentLogins...)
	tokens := append([]BackupAPIToken{}, currentTokens...)
	plan := backupRemoteAccessMergePlan{
		RPCLogins: make([]backupRPCLoginMergeDecision, 0, len(backup.RPCLogins)),
		APITokens: make([]BackupAPIToken, 0, len(backup.APITokens)),
	}
	for _, login := range backup.RPCLogins {
		replaceIndex := -1
		for index := range logins {
			if strings.EqualFold(logins[index].Username, login.Username) {
				replaceIndex = index

				break
			}
		}
		if replaceIndex >= 0 {
			plan.Result.RPCLoginReplacements++
			plan.RPCLogins = append(plan.RPCLogins, backupRPCLoginMergeDecision{
				Login:     login,
				ReplaceID: logins[replaceIndex].ID,
			})
			logins[replaceIndex] = login

			continue
		}
		if len(logins) >= MaximumBackupRPCLogins {
			plan.Result.RPCLoginMaximumSkips++

			continue
		}

		plan.Result.RPCLoginAdditions++
		plan.RPCLogins = append(plan.RPCLogins, backupRPCLoginMergeDecision{Login: login})
		logins = append(logins, login)
	}

	for _, token := range backup.APITokens {
		duplicate := false
		for _, currentToken := range tokens {
			if currentToken.ID == token.ID ||
				strings.EqualFold(currentToken.Name, token.Name) ||
				bytes.Equal(currentToken.Digest, token.Digest) {
				duplicate = true

				break
			}
		}
		if duplicate {
			plan.Result.APITokenDuplicateSkips++

			continue
		}
		if len(tokens) >= MaximumBackupAPITokens {
			plan.Result.APITokenMaximumSkips++

			continue
		}

		plan.Result.APITokenAdditions++
		plan.APITokens = append(plan.APITokens, token)
		tokens = append(tokens, token)
	}

	return plan
}

func listBackupNotificationTargets(
	ctx context.Context,
	queryer backupRestoreQueryer,
) ([]NotificationTarget, error) {
	rows, err := queryer.QueryContext(
		ctx,
		"SELECT "+notificationTargetColumns+" FROM notification_targets ORDER BY created_at DESC, name",
	)
	if err != nil {
		return nil, fmt.Errorf("list notifications for restore: %w", err)
	}
	defer rows.Close()

	targets := []NotificationTarget{}
	for rows.Next() {
		target, scanError := scanNotificationTarget(rows)
		if scanError != nil {
			return nil, scanError
		}

		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate notifications for restore: %w", err)
	}

	return targets, nil
}

func listBackupRPCLogins(
	ctx context.Context,
	queryer backupRestoreQueryer,
) ([]RPCLogin, error) {
	rows, err := queryer.QueryContext(
		ctx,
		"SELECT "+rpcLoginColumns+" FROM rpc_logins ORDER BY created_at DESC, username",
	)
	if err != nil {
		return nil, fmt.Errorf("list RPC logins for restore: %w", err)
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
		return nil, fmt.Errorf("iterate RPC logins for restore: %w", err)
	}

	return logins, nil
}

func listBackupAPITokens(
	ctx context.Context,
	queryer backupRestoreQueryer,
) ([]BackupAPIToken, error) {
	rows, err := queryer.QueryContext(
		ctx,
		`SELECT id, name, token_digest, scopes_json, expires_at, created_at, last_used_at
		 FROM api_tokens
		 ORDER BY created_at DESC, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("list API tokens for restore: %w", err)
	}
	defer rows.Close()

	tokens := []BackupAPIToken{}
	for rows.Next() {
		var token BackupAPIToken
		var scopesJSON string
		var expiresAt sql.NullString
		var createdAt string
		var lastUsedAt sql.NullString
		if err := rows.Scan(
			&token.ID,
			&token.Name,
			&token.Digest,
			&scopesJSON,
			&expiresAt,
			&createdAt,
			&lastUsedAt,
		); err != nil {
			return nil, fmt.Errorf("scan API token for restore: %w", err)
		}
		if err := json.Unmarshal([]byte(scopesJSON), &token.Scopes); err != nil {
			return nil, fmt.Errorf("decode API token scopes for restore: %w", err)
		}
		var parseError error
		token.CreatedAt, parseError = parseTime(createdAt)
		if parseError != nil {
			return nil, parseError
		}
		if expiresAt.Valid {
			parsed, parseError := parseTime(expiresAt.String)
			if parseError != nil {
				return nil, parseError
			}
			token.ExpiresAt = &parsed
		}
		if lastUsedAt.Valid {
			parsed, parseError := parseTime(lastUsedAt.String)
			if parseError != nil {
				return nil, parseError
			}
			token.LastUsedAt = &parsed
		}

		tokens = append(tokens, token)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate API tokens for restore: %w", err)
	}

	return tokens, nil
}

// UpsertBackupVPNProfiles restores endpoint records without activating a connection.
//
// Since: UNRELEASED
func (store *Store) UpsertBackupVPNProfiles(
	ctx context.Context,
	profiles []EncryptedVPNProfile,
) error {
	if len(profiles) == 0 {
		return nil
	}
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin VPN endpoint restore: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	now := formatTime(time.Now())
	for _, profile := range profiles {
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO vpn_profiles (
			   id, provider_id, tunnel, display_name, country_code, country_name, city,
			   continent, protocol, remote_host, remote_port, fingerprint, source,
			   current, nonce, ciphertext, created_at, updated_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   provider_id = excluded.provider_id,
			   tunnel = excluded.tunnel,
			   display_name = excluded.display_name,
			   country_code = excluded.country_code,
			   country_name = excluded.country_name,
			   city = excluded.city,
			   continent = excluded.continent,
			   protocol = excluded.protocol,
			   remote_host = excluded.remote_host,
			   remote_port = excluded.remote_port,
			   fingerprint = excluded.fingerprint,
			   source = excluded.source,
			   current = 1,
			   nonce = excluded.nonce,
			   ciphertext = excluded.ciphertext,
			   updated_at = excluded.updated_at`,
			profile.ID,
			profile.ProviderID,
			profile.Tunnel,
			profile.DisplayName,
			profile.CountryCode,
			profile.Country,
			profile.City,
			profile.Continent,
			profile.Protocol,
			profile.RemoteHost,
			profile.RemotePort,
			profile.Fingerprint,
			profile.Source,
			profile.Nonce,
			profile.Ciphertext,
			now,
			now,
		); err != nil {
			return fmt.Errorf("restore VPN endpoint %s: %w", profile.ID, err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit VPN endpoint restore: %w", err)
	}

	return nil
}
