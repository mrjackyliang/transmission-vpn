package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
)

// EffectiveSetting is the complete client-facing state of one setting.
//
// The API exposes value provenance and restart impact with the effective value so a
// UI never has to reverse-engineer configuration precedence.
type EffectiveSetting struct {
	Key          string               `json:"key"`
	Category     string               `json:"category"`
	Title        string               `json:"title"`
	Description  string               `json:"description"`
	Value        json.RawMessage      `json:"value"`
	DefaultValue json.RawMessage      `json:"defaultValue"`
	Source       string               `json:"source"`
	Locked       bool                 `json:"locked"`
	Valid        bool                 `json:"valid"`
	ApplyImpact  settings.ApplyImpact `json:"applyImpact"`
}

// ConfigurationSnapshot contains effective settings at one optimistic revision.
//
// Mutation clients submit this revision with a complete change transaction to avoid
// overwriting settings changed in another browser or managed deployment update.
type ConfigurationSnapshot struct {
	Revision int64              `json:"revision"`
	Settings []EffectiveSetting `json:"settings"`
}

// SettingChanges maps setting keys to their proposed raw JSON values.
//
// The storage layer validates the complete map before opening a write transaction so
// an invalid member cannot cause a partial configuration update.
type SettingChanges map[string]json.RawMessage

// CurrentConfigurationRevision returns the current optimistic settings revision.
//
// Runtime status includes this value so diagnostics and UI state can be correlated
// with the exact accepted configuration snapshot.
func (store *Store) CurrentConfigurationRevision(ctx context.Context) (int64, error) {
	return currentConfigurationRevision(ctx, store.databaseHandle())
}

// EffectiveConfiguration resolves defaults, persisted values, seeds, and locks.
//
// Managed locks overlay persisted UI state without destroying it, allowing removal of
// a lock to reveal the administrator's prior value again.
func (store *Store) EffectiveConfiguration(
	ctx context.Context,
	registry settings.Registry,
) (ConfigurationSnapshot, error) {
	revision, err := store.CurrentConfigurationRevision(ctx)
	if err != nil {
		return ConfigurationSnapshot{}, err
	}

	persistedValues, err := store.readPersistedSettings(ctx)
	if err != nil {
		return ConfigurationSnapshot{}, err
	}

	managedValues, err := store.readManagedSettings(ctx)
	if err != nil {
		return ConfigurationSnapshot{}, err
	}

	effectiveSettings := make([]EffectiveSetting, 0, len(registry.Definitions()))
	for _, definition := range registry.Definitions() {
		value := append(json.RawMessage(nil), definition.DefaultValue...)
		source := "default"
		locked := false

		if persistedValue, found := persistedValues[definition.Key]; found {
			canonicalValue, validationError := registry.ValidateStored(
				definition.Key,
				persistedValue.Value,
			)
			if validationError != nil {
				return ConfigurationSnapshot{}, fmt.Errorf(
					"persisted setting %s is invalid: %w",
					definition.Key,
					validationError,
				)
			}

			value = canonicalValue
			source = persistedValue.Source
		}

		if managedValue, found := managedValues[definition.Key]; found && managedValue.Mode == settings.ManagedModeLock {
			value = append(json.RawMessage(nil), managedValue.Value...)
			source = "managed-lock"
			locked = true
		}

		effectiveSettings = append(effectiveSettings, EffectiveSetting{
			Key:          definition.Key,
			Category:     definition.Category,
			Title:        definition.Title,
			Description:  definition.Description,
			Value:        value,
			DefaultValue: append(json.RawMessage(nil), definition.DefaultValue...),
			Source:       source,
			Locked:       locked,
			Valid:        true,
			ApplyImpact:  definition.ApplyImpact,
		})
	}

	return ConfigurationSnapshot{
		Revision: revision,
		Settings: effectiveSettings,
	}, nil
}

// UpdateSettings validates and atomically commits one administrator transaction.
//
// The expected revision provides optimistic concurrency, while managed locks are
// checked again inside the transaction to close races with startup policy updates.
// Enabling compatible RPC requires a protected route before the switch is saved.
//
// Since: 2.0.0
func (store *Store) UpdateSettings(
	ctx context.Context,
	registry settings.Registry,
	expectedRevision int64,
	changes SettingChanges,
	actor string,
) (int64, error) {
	canonicalChanges := make(map[string]json.RawMessage, len(changes))
	keys := make([]string, 0, len(changes))
	for key, value := range changes {
		canonicalValue, err := registry.Validate(key, value)
		if err != nil {
			return 0, fmt.Errorf("setting %s: %w", key, err)
		}

		canonicalChanges[key] = canonicalValue
		keys = append(keys, key)
	}
	sort.Strings(keys)

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin settings transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	currentRevision, err := currentConfigurationRevision(ctx, transaction)
	if err != nil {
		return 0, err
	}

	if currentRevision != expectedRevision {
		return 0, ErrRevisionConflict
	}

	if len(keys) == 0 {
		if err := transaction.Commit(); err != nil {
			return 0, fmt.Errorf("commit empty settings transaction: %w", err)
		}
		committed = true

		return currentRevision, nil
	}

	for _, key := range keys {
		var managedMode string
		err := transaction.QueryRowContext(
			ctx,
			"SELECT mode FROM managed_settings WHERE key = ?",
			key,
		).Scan(&managedMode)
		if err == nil && managedMode == string(settings.ManagedModeLock) {
			return 0, fmt.Errorf("%w: %s", ErrSettingLocked, key)
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("inspect managed setting %s: %w", key, err)
		}
	}

	if err := validateDownloadSettingChanges(
		ctx,
		transaction,
		registry,
		canonicalChanges,
	); err != nil {
		return 0, err
	}
	if rawDownloadDirectory, found := canonicalChanges["transmission.downloadDirectory"]; found {
		var downloadDirectory string
		if err := json.Unmarshal(rawDownloadDirectory, &downloadDirectory); err != nil {
			return 0, fmt.Errorf("decode changed download directory: %w", err)
		}
		if err := checkDefaultTorrentProfileFolder(
			ctx,
			transaction,
			downloadDirectory,
		); err != nil {
			return 0, err
		}
	}

	history := make(map[string]map[string]json.RawMessage, len(keys))
	now := formatTime(time.Now())
	newRevision := currentRevision + 1
	for _, key := range keys {
		previousValue := json.RawMessage("null")
		var previousValueText string
		err := transaction.QueryRowContext(
			ctx,
			"SELECT value_json FROM settings WHERE key = ?",
			key,
		).Scan(&previousValueText)
		if err == nil {
			previousValue = json.RawMessage(previousValueText)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("read previous setting %s: %w", key, err)
		}

		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES (?, ?, 'user', 0, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET
			   value_json = excluded.value_json,
			   source = excluded.source,
			   locked = 0,
			   revision = excluded.revision,
			   updated_at = excluded.updated_at`,
			key,
			string(canonicalChanges[key]),
			newRevision,
			now,
		); err != nil {
			return 0, fmt.Errorf("write setting %s: %w", key, err)
		}

		history[key] = map[string]json.RawMessage{
			"before": previousValue,
			"after":  canonicalChanges[key],
		}
	}

	if err := requireVPNConnectionForEnabledRPCCompatibility(ctx, transaction); err != nil {
		return 0, err
	}

	if err := recordConfigurationRevision(
		ctx,
		transaction,
		newRevision,
		actor,
		history,
		now,
	); err != nil {
		return 0, err
	}

	if err := transaction.Commit(); err != nil {
		return 0, fmt.Errorf("commit settings transaction: %w", err)
	}
	committed = true

	return newRevision, nil
}

// ApplyManagedConfiguration reconciles one optional host-owned document.
//
// Locks overlay rather than replace persisted UI values, and seeds initialize only a
// truly unset key. Removing the document releases locks on the next startup.
//
// Since: 2.0.0
func (store *Store) ApplyManagedConfiguration(
	ctx context.Context,
	registry settings.Registry,
	document *settings.ManagedDocument,
) (int64, error) {
	desiredValues := map[string]settings.ManagedValue{}
	if document != nil {
		for key, managedValue := range document.Settings {
			canonicalValue, validationError := registry.Validate(key, managedValue.Value)
			if validationError != nil {
				return 0, fmt.Errorf("managed setting %s: %w", key, validationError)
			}

			managedValue.Value = canonicalValue
			desiredValues[key] = managedValue
		}
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin managed settings transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	currentRevision, err := currentConfigurationRevision(ctx, transaction)
	if err != nil {
		return 0, err
	}

	currentValues, err := readManagedSettingsFrom(ctx, transaction)
	if err != nil {
		return 0, err
	}
	currentDownloadDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return 0, err
	}
	currentIncompleteDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return 0, err
	}

	changed := !managedValuesEqual(currentValues, desiredValues)
	if _, err := transaction.ExecContext(ctx, "DELETE FROM managed_settings"); err != nil {
		return 0, fmt.Errorf("clear managed settings: %w", err)
	}

	keys := make([]string, 0, len(desiredValues))
	for key := range desiredValues {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	now := formatTime(time.Now())
	newRevision := currentRevision
	if changed {
		newRevision++
	}

	for _, key := range keys {
		managedValue := desiredValues[key]
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO managed_settings (key, mode, value_json, applied_at)
			 VALUES (?, ?, ?, ?)`,
			key,
			string(managedValue.Mode),
			string(managedValue.Value),
			now,
		); err != nil {
			return 0, fmt.Errorf("store managed setting %s: %w", key, err)
		}

		if managedValue.Mode != settings.ManagedModeSeed {
			continue
		}

		var exists int
		if err := transaction.QueryRowContext(
			ctx,
			"SELECT COUNT(*) FROM settings WHERE key = ?",
			key,
		).Scan(&exists); err != nil {
			return 0, fmt.Errorf("inspect seed setting %s: %w", key, err)
		}

		if exists > 0 {
			continue
		}

		if !changed {
			newRevision = currentRevision + 1
			changed = true
		}

		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES (?, ?, 'managed-seed', 0, ?, ?)`,
			key,
			string(managedValue.Value),
			newRevision,
			now,
		); err != nil {
			return 0, fmt.Errorf("apply managed seed %s: %w", key, err)
		}
	}

	nextDownloadDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return 0, err
	}
	nextIncompleteDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return 0, err
	}
	if nextIncompleteDirectory != currentIncompleteDirectory {
		downloadPaths, pathError := downloadPathsFrom(
			ctx,
			transaction,
			nextDownloadDirectory,
		)
		if pathError != nil {
			return 0, pathError
		}
		if validationError := settings.ValidateIncompleteDataPath(
			nextIncompleteDirectory,
			downloadPaths,
		); validationError != nil {
			return 0, fmt.Errorf(
				"managed setting transmission.incompleteDirectory: %w",
				validationError,
			)
		}
	} else if nextDownloadDirectory != currentDownloadDirectory {
		if validationError := settings.ValidateDownloadDataPathOutsideIncomplete(
			nextDownloadDirectory,
			nextIncompleteDirectory,
		); validationError != nil {
			return 0, fmt.Errorf(
				"managed setting transmission.downloadDirectory: %w",
				validationError,
			)
		}
	}
	if nextDownloadDirectory != currentDownloadDirectory {
		if err := checkDefaultTorrentProfileFolder(
			ctx,
			transaction,
			nextDownloadDirectory,
		); err != nil {
			return 0, fmt.Errorf(
				"managed setting transmission.downloadDirectory: %w",
				err,
			)
		}
	}

	if err := requireVPNConnectionForEnabledRPCCompatibility(ctx, transaction); err != nil {
		return 0, err
	}

	if changed {
		history := map[string]any{
			"managedSettings": keys,
		}
		if err := recordConfigurationRevision(
			ctx,
			transaction,
			newRevision,
			"managed-config",
			history,
			now,
		); err != nil {
			return 0, err
		}
	}

	if err := transaction.Commit(); err != nil {
		return 0, fmt.Errorf("commit managed settings: %w", err)
	}
	committed = true

	return newRevision, nil
}

// requireVPNConnectionForEnabledRPCCompatibility enforces protected RPC routing.
//
// The effective managed-aware switch is checked inside the caller's transaction so
// every settings write path requires a configured VPN before enabling the proxy.
//
// Since: 2.0.0
func requireVPNConnectionForEnabledRPCCompatibility(
	ctx context.Context,
	querySource queryInterface,
) error {
	enabled, err := effectiveRPCCompatibilityEnabled(ctx, querySource)
	if err != nil {
		return err
	}
	if !enabled {
		return nil
	}

	return requireVPNConnection(ctx, querySource)
}

// effectiveRPCCompatibilityEnabled resolves the switch through persisted and managed
// precedence inside the caller's SQL scope.
func effectiveRPCCompatibilityEnabled(
	ctx context.Context,
	querySource queryInterface,
) (bool, error) {
	value := json.RawMessage("false")
	var persistedValueText string
	err := querySource.QueryRowContext(
		ctx,
		"SELECT value_json FROM settings WHERE key = 'rpc.compatibilityEnabled'",
	).Scan(&persistedValueText)
	if err == nil {
		value = json.RawMessage(persistedValueText)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return false, fmt.Errorf("read RPC compatibility setting: %w", err)
	}

	var managedMode string
	var managedValueText string
	err = querySource.QueryRowContext(
		ctx,
		"SELECT mode, value_json FROM managed_settings WHERE key = 'rpc.compatibilityEnabled'",
	).Scan(&managedMode, &managedValueText)
	if err == nil && managedMode == string(settings.ManagedModeLock) {
		value = json.RawMessage(managedValueText)
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, fmt.Errorf("read managed RPC compatibility setting: %w", err)
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, fmt.Errorf("decode RPC compatibility setting: %w", err)
	}

	return enabled, nil
}

// validateDownloadSettingChanges checks only storage paths changed by one transaction.
//
// Persisted clashes remain readable, while new Download and Incomplete directory
// values are compared with the effective counterpart and durable torrent presets.
func validateDownloadSettingChanges(
	ctx context.Context,
	querySource queryInterface,
	registry settings.Registry,
	changes map[string]json.RawMessage,
) error {
	downloadValue, downloadChanged := changes["transmission.downloadDirectory"]
	incompleteValue, incompleteChanged := changes["transmission.incompleteDirectory"]
	if !downloadChanged && !incompleteChanged {
		return nil
	}

	downloadDirectory, err := effectiveStringSettingFrom(
		ctx,
		querySource,
		registry,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return err
	}
	if downloadChanged {
		if err := json.Unmarshal(downloadValue, &downloadDirectory); err != nil {
			return fmt.Errorf("decode changed download directory: %w", err)
		}
	}

	incompleteDirectory, err := effectiveStringSettingFrom(
		ctx,
		querySource,
		registry,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return err
	}
	if incompleteChanged {
		if err := json.Unmarshal(incompleteValue, &incompleteDirectory); err != nil {
			return fmt.Errorf("decode changed incomplete folder: %w", err)
		}

		downloadPaths, pathError := downloadPathsFrom(
			ctx,
			querySource,
			downloadDirectory,
		)
		if pathError != nil {
			return pathError
		}
		if validationError := settings.ValidateIncompleteDataPath(
			incompleteDirectory,
			downloadPaths,
		); validationError != nil {
			return fmt.Errorf(
				"setting transmission.incompleteDirectory: %w",
				validationError,
			)
		}

		return nil
	}

	if validationError := settings.ValidateDownloadDataPathOutsideIncomplete(
		downloadDirectory,
		incompleteDirectory,
	); validationError != nil {
		return fmt.Errorf(
			"setting transmission.downloadDirectory: %w",
			validationError,
		)
	}

	return nil
}

// effectiveStringSettingFrom resolves one string setting through current precedence.
//
// Cross-setting writes need the same default, persisted, and managed-lock value
// that read APIs expose, without applying strict relationship checks to old data.
func effectiveStringSettingFrom(
	ctx context.Context,
	querySource queryInterface,
	registry settings.Registry,
	key string,
) (string, error) {
	definition, found := registry.Definition(key)
	if !found {
		return "", fmt.Errorf("setting %s is not registered", key)
	}

	value := append(json.RawMessage(nil), definition.DefaultValue...)
	var persistedValueText string
	err := querySource.QueryRowContext(
		ctx,
		"SELECT value_json FROM settings WHERE key = ?",
		key,
	).Scan(&persistedValueText)
	if err == nil {
		canonicalValue, validationError := registry.ValidateStored(
			key,
			json.RawMessage(persistedValueText),
		)
		if validationError != nil {
			return "", fmt.Errorf("persisted setting %s is invalid: %w", key, validationError)
		}
		value = canonicalValue
	} else if !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("read setting %s: %w", key, err)
	}

	var managedMode string
	var managedValueText string
	err = querySource.QueryRowContext(
		ctx,
		"SELECT mode, value_json FROM managed_settings WHERE key = ?",
		key,
	).Scan(&managedMode, &managedValueText)
	if err == nil && managedMode == string(settings.ManagedModeLock) {
		value = json.RawMessage(managedValueText)
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("read managed setting %s: %w", key, err)
	}

	var decodedValue string
	if err := json.Unmarshal(value, &decodedValue); err != nil {
		return "", fmt.Errorf("decode effective setting %s: %w", key, err)
	}

	return decodedValue, nil
}

// downloadPathsFrom lists completed-download destinations in clash priority order.
//
// The effective Download directory comes first, followed by alphabetical profiles so
// an incomplete-directory error is deterministic.
func downloadPathsFrom(
	ctx context.Context,
	querySource queryInterface,
	downloadDirectory string,
) ([]settings.IncompleteDirectoryDestination, error) {
	var defaultProfileName string
	if err := querySource.QueryRowContext(
		ctx,
		"SELECT name FROM torrent_default_profile WHERE id = 1",
	).Scan(&defaultProfileName); err != nil {
		return nil, fmt.Errorf("read Default torrent profile name: %w", err)
	}
	downloadPaths := []settings.IncompleteDirectoryDestination{{
		Path:        downloadDirectory,
		ProfileName: defaultProfileName,
	}}
	profileRows, err := querySource.QueryContext(
		ctx,
		`SELECT name, download_directory
		 FROM torrent_profiles
		 ORDER BY name COLLATE NOCASE, name, created_at, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("read torrent profile download directories: %w", err)
	}
	for profileRows.Next() {
		var profileName, profileDownloadDirectory string
		if err := profileRows.Scan(&profileName, &profileDownloadDirectory); err != nil {
			_ = profileRows.Close()

			return nil, fmt.Errorf("scan torrent profile download directory: %w", err)
		}
		downloadPaths = append(downloadPaths, settings.IncompleteDirectoryDestination{
			Path:        profileDownloadDirectory,
			ProfileName: profileName + " profile",
		})
	}
	if err := profileRows.Err(); err != nil {
		_ = profileRows.Close()

		return nil, fmt.Errorf("iterate torrent profile download directories: %w", err)
	}
	if err := profileRows.Close(); err != nil {
		return nil, fmt.Errorf("close torrent profile download directories: %w", err)
	}

	return downloadPaths, nil
}

// checkDefaultTorrentProfileFolder rejects a named profile's completed-data folder.
//
// Settings and managed configuration call this inside their write transaction so a
// concurrent profile save cannot give the Default profile a second owner silently.
func checkDefaultTorrentProfileFolder(
	ctx context.Context,
	querySource queryInterface,
	downloadDirectory string,
) error {
	var profileName string
	err := querySource.QueryRowContext(
		ctx,
		`SELECT name
		 FROM torrent_profiles
		 WHERE download_directory = ? COLLATE NOCASE
		 ORDER BY name COLLATE NOCASE, name, created_at, id
		 LIMIT 1`,
		downloadDirectory,
	).Scan(&profileName)
	if err == nil {
		return &TorrentProfileFolderConflict{
			DownloadDirectory: downloadDirectory,
			ProfileName:       profileName,
		}
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check Default torrent profile folder: %w", err)
	}

	// No profile folder may sit inside another profile's folder or contain one.
	rows, err := querySource.QueryContext(
		ctx,
		`SELECT name, download_directory
		 FROM torrent_profiles
		 ORDER BY name COLLATE NOCASE, name, created_at, id`,
	)
	if err != nil {
		return fmt.Errorf("check Default torrent profile folder: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var ownerName string
		var ownerDirectory string
		if err := rows.Scan(&ownerName, &ownerDirectory); err != nil {
			return fmt.Errorf("check Default torrent profile folder: %w", err)
		}
		if relation := TorrentProfileFolderRelation(downloadDirectory, ownerDirectory); relation == "inside" || relation == "contains" {
			return &TorrentProfileFolderConflict{
				DownloadDirectory: filepath.Clean(ownerDirectory),
				ProfileName:       ownerName,
				Relation:          relation,
			}
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("check Default torrent profile folder: %w", err)
	}

	return nil
}

// persistedSetting stores one user or seed value before precedence is resolved.
//
// This internal representation keeps database metadata separate from the richer API
// model assembled with registry definitions.
type persistedSetting struct {
	Value  json.RawMessage
	Source string
}

// readPersistedSettings loads every explicitly stored value.
//
// Values remain raw JSON until registry validation confirms the database contents
// still satisfy the running binary's contract.
func (store *Store) readPersistedSettings(
	ctx context.Context,
) (map[string]persistedSetting, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT key, value_json, source FROM settings",
	)
	if err != nil {
		return nil, fmt.Errorf("read persisted settings: %w", err)
	}
	defer rows.Close()

	values := map[string]persistedSetting{}
	for rows.Next() {
		var key string
		var valueText string
		var source string
		if err := rows.Scan(&key, &valueText, &source); err != nil {
			return nil, fmt.Errorf("scan persisted setting: %w", err)
		}

		values[key] = persistedSetting{
			Value:  json.RawMessage(valueText),
			Source: source,
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate persisted settings: %w", err)
	}

	return values, nil
}

// readManagedSettings loads the current overlay through the store connection.
//
// A shared transaction-capable implementation is used for both read APIs and startup
// reconciliation.
func (store *Store) readManagedSettings(
	ctx context.Context,
) (map[string]settings.ManagedValue, error) {
	return readManagedSettingsFrom(ctx, store.databaseHandle())
}

// queryInterface captures query behavior shared by a database and transaction.
//
// Narrowing the interface keeps helpers testable and prevents unrelated SQL operations
// from leaking into configuration logic.
type queryInterface interface {
	QueryContext(ctx context.Context, query string, arguments ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, arguments ...any) *sql.Row
}

// executionInterface adds mutation support to the shared query boundary.
//
// Revision helpers accept this interface so all metadata and history writes stay in
// the caller's atomic transaction.
type executionInterface interface {
	queryInterface
	ExecContext(ctx context.Context, query string, arguments ...any) (sql.Result, error)
}

// readManagedSettingsFrom loads managed values from a database or active transaction.
//
// Raw values were validated before insertion and are retained exactly for deterministic
// equality and precedence checks.
func readManagedSettingsFrom(
	ctx context.Context,
	querySource queryInterface,
) (map[string]settings.ManagedValue, error) {
	rows, err := querySource.QueryContext(
		ctx,
		"SELECT key, mode, value_json FROM managed_settings",
	)
	if err != nil {
		return nil, fmt.Errorf("read managed settings: %w", err)
	}
	defer rows.Close()

	values := map[string]settings.ManagedValue{}
	for rows.Next() {
		var key string
		var mode string
		var valueText string
		if err := rows.Scan(&key, &mode, &valueText); err != nil {
			return nil, fmt.Errorf("scan managed setting: %w", err)
		}

		values[key] = settings.ManagedValue{
			Mode:  settings.ManagedMode(mode),
			Value: json.RawMessage(valueText),
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate managed settings: %w", err)
	}

	return values, nil
}

// managedValuesEqual compares two canonical managed setting maps.
//
// Deterministic canonical JSON allows direct byte comparison without decoding values
// into lossy generic number representations.
func managedValuesEqual(
	leftValues map[string]settings.ManagedValue,
	rightValues map[string]settings.ManagedValue,
) bool {
	if len(leftValues) != len(rightValues) {
		return false
	}

	for key, leftValue := range leftValues {
		rightValue, found := rightValues[key]
		if !found || leftValue.Mode != rightValue.Mode ||
			string(leftValue.Value) != string(rightValue.Value) {
			return false
		}
	}

	return true
}

// currentConfigurationRevision reads the optimistic revision through any SQL scope.
//
// Parsing is explicit because metadata values are text for forward-compatible control
// plane state that is not limited to integers.
func currentConfigurationRevision(
	ctx context.Context,
	querySource queryInterface,
) (int64, error) {
	var revisionText string
	if err := querySource.QueryRowContext(
		ctx,
		"SELECT value FROM metadata WHERE key = 'configuration_revision'",
	).Scan(&revisionText); err != nil {
		return 0, fmt.Errorf("read configuration revision: %w", err)
	}

	revision, err := strconv.ParseInt(revisionText, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse configuration revision: %w", err)
	}

	return revision, nil
}

// recordConfigurationRevision stores history and advances the current revision.
//
// Both writes use the caller's transaction so a snapshot can never point to missing
// history or record changes that were rolled back.
func recordConfigurationRevision(
	ctx context.Context,
	executionTarget executionInterface,
	revision int64,
	actor string,
	changes any,
	createdAt string,
) error {
	changesJSON, err := json.Marshal(changes)
	if err != nil {
		return fmt.Errorf("encode configuration history: %w", err)
	}

	if _, err := executionTarget.ExecContext(
		ctx,
		`INSERT INTO configuration_revisions (revision, actor, changes_json, created_at)
		 VALUES (?, ?, ?, ?)`,
		revision,
		actor,
		string(changesJSON),
		createdAt,
	); err != nil {
		return fmt.Errorf("record configuration history: %w", err)
	}

	if _, err := executionTarget.ExecContext(
		ctx,
		`UPDATE metadata
		 SET value = ?
		 WHERE key = 'configuration_revision'`,
		strconv.FormatInt(revision, 10),
	); err != nil {
		return fmt.Errorf("advance configuration revision: %w", err)
	}

	return nil
}
