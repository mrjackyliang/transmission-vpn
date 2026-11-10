package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maximumTorrentProfiles = 100

var (
	// ErrTorrentProfileNameTaken reports a case-insensitive name collision.
	//
	// The API points this conflict at the name field without exposing SQLite
	// constraint details.
	//
	// Since: 2.0.0
	ErrTorrentProfileNameTaken = errors.New("torrent profile name is already in use")

	// ErrTorrentProfileLimit reports that the bounded profile collection is full.
	//
	// Keeping the limit in storage closes races between simultaneous create requests.
	//
	// Since: 2.0.0
	ErrTorrentProfileLimit = errors.New("torrent profile limit reached")

	// ErrTorrentProfileFolderTaken reports a case-insensitive folder collision.
	//
	// Every completed-download folder has one profile owner so changing a profile is
	// the only operation that can move a torrent between folders.
	//
	// Since: 2.0.0
	ErrTorrentProfileFolderTaken = errors.New("torrent profile folder is already in use")
)

// TorrentProfileFolderConflict identifies the profile that already owns a folder.
//
// API write paths use the durable owner name to return the same actionable conflict
// after a transaction-level race as they do during request preflight.
//
// Since: 2.0.0
type TorrentProfileFolderConflict struct {
	DownloadDirectory string
	ProfileName       string
	DefaultProfile    bool
	// Relation is empty for the same folder, "inside" when the requested folder sits
	// inside the owner's folder, and "contains" when it holds the owner's folder.
	Relation string
}

// TorrentProfileFolderRelation compares two profile folders without case sensitivity.
//
// It returns "same", "inside" when candidate sits within owner, "contains" when
// candidate holds owner, or an empty string when the folders are unrelated.
//
// Since: 2.0.0
func TorrentProfileFolderRelation(candidate string, owner string) string {
	if strings.TrimSpace(candidate) == "" || strings.TrimSpace(owner) == "" {
		return ""
	}
	candidateKey := strings.ToLower(filepath.Clean(candidate))
	ownerKey := strings.ToLower(filepath.Clean(owner))
	switch {
	case candidateKey == ownerKey:
		return "same"
	case folderWithin(ownerKey, candidateKey):
		return "inside"
	case folderWithin(candidateKey, ownerKey):
		return "contains"
	}

	return ""
}

// folderWithin reports whether child is a strict descendant of parent.
func folderWithin(parent string, child string) bool {
	relative, err := filepath.Rel(parent, child)
	if err != nil || relative == "." {
		return false
	}

	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

// Error describes the conflicting profile folder.
//
// The public API formats its own stable sentence while storage logs retain enough
// context to identify the rejected folder and owner.
//
// Since: 2.0.0
func (conflict *TorrentProfileFolderConflict) Error() string {
	return fmt.Sprintf(
		"%s: %s belongs to %s",
		ErrTorrentProfileFolderTaken,
		conflict.DownloadDirectory,
		conflict.ProfileName,
	)
}

// Unwrap exposes the stable folder-conflict sentinel.
//
// Callers can classify the conflict without comparing its contextual error text.
//
// Since: 2.0.0
func (conflict *TorrentProfileFolderConflict) Unwrap() error {
	return ErrTorrentProfileFolderTaken
}

// TorrentProfileSeeding stores one profile's independent seeding policy.
//
// Ratio and IdleMinutes remain nil when that limit is disabled; Mode decides whether
// the enabled values are applied or all seeding limits are disabled.
//
// Since: 2.0.0
type TorrentProfileSeeding struct {
	Mode        string   `json:"mode"`
	Ratio       *float64 `json:"ratio"`
	IdleMinutes *int64   `json:"idleMinutes"`
}

// TorrentProfileOptions stores every Transmission option owned by one profile.
//
// Nil speed limits mean unlimited and never consult the global session settings.
//
// Since: 2.0.0
type TorrentProfileOptions struct {
	Seeding           TorrentProfileSeeding `json:"seeding"`
	DownloadLimitKBps *int64                `json:"downloadLimitKBps"`
	UploadLimitKBps   *int64                `json:"uploadLimitKBps"`
	BandwidthPriority int64                 `json:"bandwidthPriority"`
	PeerLimit         int64                 `json:"peerLimit"`
	Queue             string                `json:"queue"`
}

// TorrentProfile is one application-owned torrent preset.
//
// ConnectionID selects one durable VPN connection; nil follows the current default.
//
// Since: 2.0.0
type TorrentProfile struct {
	ID                string                `json:"id"`
	Name              string                `json:"name"`
	DownloadDirectory string                `json:"downloadDirectory"`
	Labels            []string              `json:"labels"`
	StartPaused       bool                  `json:"startPaused"`
	Options           TorrentProfileOptions `json:"options"`
	MatchPatterns     []string              `json:"matchPatterns"`
	ConnectionID      *string               `json:"connectionId"`
	CreatedAt         time.Time             `json:"createdAt"`
	UpdatedAt         time.Time             `json:"updatedAt"`
}

// DefaultTorrentProfile stores the application-owned fields of the Default profile.
//
// Its download folder remains the effective transmission.downloadDirectory setting,
// while this row owns labels, paused state, and explicit per-torrent options.
//
// Since: 2.0.0
type DefaultTorrentProfile struct {
	Name        string                `json:"name"`
	Labels      []string              `json:"labels"`
	StartPaused bool                  `json:"startPaused"`
	Options     TorrentProfileOptions `json:"options"`
	UpdatedAt   time.Time             `json:"updatedAt"`
}

const torrentProfileColumns = `id, name, download_directory, labels_json,
	start_paused, options_json, match_patterns_json, connection_id, created_at, updated_at`

// CreateTorrentProfile adds one profile to the alphabetically sorted collection.
//
// Name uniqueness and the 100-profile limit are checked inside the same transaction.
//
// Since: 2.0.0
func (store *Store) CreateTorrentProfile(ctx context.Context, profile TorrentProfile) (TorrentProfile, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return TorrentProfile{}, fmt.Errorf("begin torrent profile creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := verifyOptionalVPNConnectionReference(ctx, transaction, profile.ConnectionID); err != nil {
		return TorrentProfile{}, err
	}
	var count int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM torrent_profiles").Scan(&count); err != nil {
		return TorrentProfile{}, fmt.Errorf("count torrent profiles: %w", err)
	}
	if count >= maximumTorrentProfiles {
		return TorrentProfile{}, ErrTorrentProfileLimit
	}
	if err := checkTorrentProfileName(ctx, transaction, profile.Name, profile.ID); err != nil {
		return TorrentProfile{}, err
	}
	if err := checkTorrentProfileFolder(
		ctx,
		transaction,
		profile.DownloadDirectory,
		profile.ID,
	); err != nil {
		return TorrentProfile{}, err
	}

	labelsJSON, optionsJSON, patternsJSON, err := encodeTorrentProfileJSON(profile)
	if err != nil {
		return TorrentProfile{}, err
	}

	now := time.Now().UTC()
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO torrent_profiles (
		   id, name, download_directory, labels_json, start_paused,
		   options_json, match_patterns_json, connection_id, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		profile.ID,
		profile.Name,
		profile.DownloadDirectory,
		labelsJSON,
		profile.StartPaused,
		optionsJSON,
		patternsJSON,
		torrentProfileOptionalString(profile.ConnectionID),
		formatTime(now),
		formatTime(now),
	); err != nil {
		return TorrentProfile{}, fmt.Errorf("create torrent profile: %w", err)
	}
	if _, err := ensureTorrentLabels(ctx, transaction, profile.Labels); err != nil {
		return TorrentProfile{}, err
	}

	created, err := scanTorrentProfile(transaction.QueryRowContext(
		ctx,
		"SELECT "+torrentProfileColumns+" FROM torrent_profiles WHERE id = ?",
		profile.ID,
	))
	if err != nil {
		return TorrentProfile{}, err
	}

	if err := transaction.Commit(); err != nil {
		return TorrentProfile{}, fmt.Errorf("commit torrent profile creation: %w", err)
	}

	return created, nil
}

// ListTorrentProfiles returns every profile alphabetically, case-insensitively.
//
// Callers receive empty arrays for unset labels and patterns so API payloads stay
// stable even if an older row encoded a JSON null.
//
// Since: 2.0.0
func (store *Store) ListTorrentProfiles(ctx context.Context) ([]TorrentProfile, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT "+torrentProfileColumns+" FROM torrent_profiles "+
			"ORDER BY name COLLATE NOCASE, name, created_at, id",
	)
	if err != nil {
		return nil, fmt.Errorf("list torrent profiles: %w", err)
	}
	defer rows.Close()

	profiles := []TorrentProfile{}
	for rows.Next() {
		profile, err := scanTorrentProfile(rows)
		if err != nil {
			return nil, err
		}

		profiles = append(profiles, profile)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate torrent profiles: %w", err)
	}
	sort.SliceStable(profiles, func(left int, right int) bool {
		leftName := strings.ToLower(profiles[left].Name)
		rightName := strings.ToLower(profiles[right].Name)
		if leftName != rightName {
			return leftName < rightName
		}

		return profiles[left].Name < profiles[right].Name
	})

	return profiles, nil
}

// FindTorrentProfile returns one profile, or ErrNotFound.
//
// Profile options are decoded strictly so damaged application state never reaches a
// Transmission mutation.
//
// Since: 2.0.0
func (store *Store) FindTorrentProfile(ctx context.Context, id string) (TorrentProfile, error) {
	profile, err := scanTorrentProfile(store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT "+torrentProfileColumns+" FROM torrent_profiles WHERE id = ?",
		id,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return TorrentProfile{}, ErrNotFound
	}

	return profile, err
}

// DefaultTorrentProfile returns the stored non-folder fields of the Default profile.
//
// Migration 011 creates exactly one row, so a missing row is treated as corrupt
// application state rather than silently recreating different defaults.
//
// Since: 2.0.0
func (store *Store) DefaultTorrentProfile(ctx context.Context) (DefaultTorrentProfile, error) {
	return scanDefaultTorrentProfile(store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT name, labels_json, start_paused, options_json, updated_at
		 FROM torrent_default_profile
		 WHERE id = 1`,
	))
}

// UpdateDefaultTorrentProfile replaces the Default profile's non-folder fields.
//
// Folder changes use the revisioned settings transaction independently; this method
// keeps the remaining profile defaults in their one-row durable record.
//
// Since: 2.0.0
func (store *Store) UpdateDefaultTorrentProfile(
	ctx context.Context,
	profile DefaultTorrentProfile,
) (DefaultTorrentProfile, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("begin Default torrent profile update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()
	if err := checkDefaultTorrentProfileName(ctx, transaction, profile.Name); err != nil {
		return DefaultTorrentProfile{}, err
	}
	if profile.Labels == nil {
		profile.Labels = []string{}
	}
	labelsJSON, err := json.Marshal(profile.Labels)
	if err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("encode Default torrent profile labels: %w", err)
	}
	optionsJSON, err := json.Marshal(profile.Options)
	if err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("encode Default torrent profile options: %w", err)
	}

	result, err := transaction.ExecContext(
		ctx,
		`UPDATE torrent_default_profile
		 SET name = ?, labels_json = ?, start_paused = ?, options_json = ?, updated_at = ?
		 WHERE id = 1`,
		profile.Name,
		string(labelsJSON),
		profile.StartPaused,
		string(optionsJSON),
		formatTime(time.Now()),
	)
	if err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("update Default torrent profile: %w", err)
	}
	affectedRows, err := result.RowsAffected()
	if err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("inspect Default torrent profile update: %w", err)
	}
	if affectedRows != 1 {
		return DefaultTorrentProfile{}, errors.New("Default torrent profile row is missing")
	}
	if _, err := ensureTorrentLabels(ctx, transaction, profile.Labels); err != nil {
		return DefaultTorrentProfile{}, err
	}
	updated, err := scanDefaultTorrentProfile(transaction.QueryRowContext(
		ctx,
		`SELECT name, labels_json, start_paused, options_json, updated_at
		 FROM torrent_default_profile
		 WHERE id = 1`,
	))
	if err != nil {
		return DefaultTorrentProfile{}, err
	}
	if err := transaction.Commit(); err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("commit Default torrent profile update: %w", err)
	}

	return updated, nil
}

// UpdateTorrentProfile replaces one profile's values.
//
// Name uniqueness and the replacement share one transaction so conflicts cannot
// produce a partial edit.
//
// Since: 2.0.0
func (store *Store) UpdateTorrentProfile(
	ctx context.Context,
	id string,
	profile TorrentProfile,
) (TorrentProfile, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return TorrentProfile{}, fmt.Errorf("begin torrent profile update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := verifyOptionalVPNConnectionReference(ctx, transaction, profile.ConnectionID); err != nil {
		return TorrentProfile{}, err
	}
	if err := checkTorrentProfileName(ctx, transaction, profile.Name, id); err != nil {
		return TorrentProfile{}, err
	}
	if err := checkTorrentProfileFolder(
		ctx,
		transaction,
		profile.DownloadDirectory,
		id,
	); err != nil {
		return TorrentProfile{}, err
	}

	labelsJSON, optionsJSON, patternsJSON, err := encodeTorrentProfileJSON(profile)
	if err != nil {
		return TorrentProfile{}, err
	}

	result, err := transaction.ExecContext(
		ctx,
		`UPDATE torrent_profiles
		 SET name = ?, download_directory = ?, labels_json = ?, start_paused = ?,
		     options_json = ?, match_patterns_json = ?, connection_id = ?, updated_at = ?
		 WHERE id = ?`,
		profile.Name,
		profile.DownloadDirectory,
		labelsJSON,
		profile.StartPaused,
		optionsJSON,
		patternsJSON,
		torrentProfileOptionalString(profile.ConnectionID),
		formatTime(time.Now()),
		id,
	)
	if err != nil {
		return TorrentProfile{}, fmt.Errorf("update torrent profile: %w", err)
	}
	affectedRows, err := result.RowsAffected()
	if err != nil {
		return TorrentProfile{}, fmt.Errorf("inspect torrent profile update: %w", err)
	}
	if affectedRows == 0 {
		return TorrentProfile{}, ErrNotFound
	}
	if _, err := ensureTorrentLabels(ctx, transaction, profile.Labels); err != nil {
		return TorrentProfile{}, err
	}

	updated, err := scanTorrentProfile(transaction.QueryRowContext(
		ctx,
		"SELECT "+torrentProfileColumns+" FROM torrent_profiles WHERE id = ?",
		id,
	))
	if err != nil {
		return TorrentProfile{}, err
	}

	if err := transaction.Commit(); err != nil {
		return TorrentProfile{}, fmt.Errorf("commit torrent profile update: %w", err)
	}

	return updated, nil
}

// DeleteTorrentProfile removes one profile and its assignments, then prunes its ID
// from every pending choice without clearing the unresolved marker.
//
// SQLite's cascading foreign key makes assigned torrents become unassigned in the same
// statement.
//
// Since: 2.0.0
func (store *Store) DeleteTorrentProfile(ctx context.Context, id string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin torrent profile deletion: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	result, err := transaction.ExecContext(ctx, "DELETE FROM torrent_profiles WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete torrent profile: %w", err)
	}
	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect torrent profile deletion: %w", err)
	}
	if affectedRows == 0 {
		return ErrNotFound
	}

	rows, err := transaction.QueryContext(
		ctx,
		"SELECT hash, profile_ids_json FROM torrent_profile_needs_choice",
	)
	if err != nil {
		return fmt.Errorf("list pending torrent profile choices: %w", err)
	}
	type pendingChoice struct {
		hash       string
		profileIDs []string
	}
	pendingChoices := []pendingChoice{}
	for rows.Next() {
		var hash, profileIDsJSON string
		if err := rows.Scan(&hash, &profileIDsJSON); err != nil {
			_ = rows.Close()

			return fmt.Errorf("read pending torrent profile choice: %w", err)
		}
		profileIDs := []string{}
		if err := json.Unmarshal([]byte(profileIDsJSON), &profileIDs); err != nil {
			_ = rows.Close()

			return fmt.Errorf("decode pending torrent profile choices: %w", err)
		}
		filtered := profileIDs[:0]
		for _, profileID := range profileIDs {
			if profileID != id {
				filtered = append(filtered, profileID)
			}
		}
		if len(filtered) != len(profileIDs) {
			pendingChoices = append(pendingChoices, pendingChoice{hash: hash, profileIDs: filtered})
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()

		return fmt.Errorf("iterate pending torrent profile choices: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close pending torrent profile choices: %w", err)
	}
	for _, choice := range pendingChoices {
		profileIDsJSON, err := json.Marshal(choice.profileIDs)
		if err != nil {
			return fmt.Errorf("encode pending torrent profile choices: %w", err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			"UPDATE torrent_profile_needs_choice SET profile_ids_json = ? WHERE hash = ?",
			string(profileIDsJSON),
			choice.hash,
		); err != nil {
			return fmt.Errorf("update pending torrent profile choices: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit torrent profile deletion: %w", err)
	}

	return nil
}

// ListTorrentProfileAssignments returns the profile keyed by lowercase torrent hash.
//
// The API loads this compact map into memory for every torrent-list enrichment.
//
// Since: 2.0.0
func (store *Store) ListTorrentProfileAssignments(ctx context.Context) (map[string]string, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT hash, profile_id FROM torrent_profile_assignments",
	)
	if err != nil {
		return nil, fmt.Errorf("list torrent profile assignments: %w", err)
	}
	defer rows.Close()

	assignments := map[string]string{}
	for rows.Next() {
		var hash, profileID string
		if err := rows.Scan(&hash, &profileID); err != nil {
			return nil, fmt.Errorf("read torrent profile assignment: %w", err)
		}
		assignments[hash] = profileID
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate torrent profile assignments: %w", err)
	}

	return assignments, nil
}

// ListTorrentNeedsProfiles returns unresolved matching profile IDs by torrent hash.
//
// Empty ID arrays remain meaningful after every matching profile is deleted, so the
// durable marker is not inferred from the number of available choices.
//
// Since: 2.0.0
func (store *Store) ListTorrentNeedsProfiles(ctx context.Context) (map[string][]string, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT hash, profile_ids_json FROM torrent_profile_needs_choice",
	)
	if err != nil {
		return nil, fmt.Errorf("list pending torrent profile choices: %w", err)
	}
	defer rows.Close()

	choices := map[string][]string{}
	for rows.Next() {
		var hash, profileIDsJSON string
		if err := rows.Scan(&hash, &profileIDsJSON); err != nil {
			return nil, fmt.Errorf("read pending torrent profile choice: %w", err)
		}
		profileIDs := []string{}
		if err := json.Unmarshal([]byte(profileIDsJSON), &profileIDs); err != nil {
			return nil, fmt.Errorf("decode pending torrent profile choices: %w", err)
		}
		choices[hash] = profileIDs
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending torrent profile choices: %w", err)
	}

	return choices, nil
}

// ReplaceTorrentNeedsProfile stores one unresolved pattern tie and clears any named
// assignment for the same hash in the transaction.
//
// The caller supplies profile IDs in display order. An empty array is accepted so a
// torrent remains explicitly unresolved after all original choices are deleted.
//
// Since: 2.0.0
func (store *Store) ReplaceTorrentNeedsProfile(
	ctx context.Context,
	hash string,
	profileIDs []string,
) error {
	normalizedHashes, err := normalizeTorrentHashes([]string{hash})
	if err != nil {
		return err
	}
	profileIDsJSON, err := json.Marshal(profileIDs)
	if err != nil {
		return fmt.Errorf("encode pending torrent profile choices: %w", err)
	}
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin pending torrent profile choice: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM torrent_profile_assignments WHERE hash = ?",
		normalizedHashes[0],
	); err != nil {
		return fmt.Errorf("clear pending torrent profile assignment: %w", err)
	}
	_, err = transaction.ExecContext(
		ctx,
		`INSERT INTO torrent_profile_needs_choice (hash, profile_ids_json, created_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(hash) DO UPDATE SET
		   profile_ids_json = excluded.profile_ids_json,
		   created_at = excluded.created_at`,
		normalizedHashes[0],
		string(profileIDsJSON),
		formatTime(time.Now()),
	)
	if err != nil {
		return fmt.Errorf("store pending torrent profile choice: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit pending torrent profile choice: %w", err)
	}

	return nil
}

// DeleteTorrentNeedsProfiles clears explicit profile choices for torrent hashes.
//
// Since: 2.0.0
func (store *Store) DeleteTorrentNeedsProfiles(ctx context.Context, hashes []string) error {
	normalizedHashes, err := normalizeTorrentHashes(hashes)
	if err != nil {
		return err
	}
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin pending torrent profile cleanup: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	for _, hash := range normalizedHashes {
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM torrent_profile_needs_choice WHERE hash = ?",
			hash,
		); err != nil {
			return fmt.Errorf("delete pending torrent profile choice: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit pending torrent profile cleanup: %w", err)
	}

	return nil
}

// DeleteTorrentProfileRecords clears every control-plane record for torrent hashes.
//
// Since: 2.0.0
func (store *Store) DeleteTorrentProfileRecords(ctx context.Context, hashes []string) error {
	normalizedHashes, err := normalizeTorrentHashes(hashes)
	if err != nil {
		return err
	}
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin torrent profile record cleanup: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	for _, hash := range normalizedHashes {
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM torrent_profile_assignments WHERE hash = ?",
			hash,
		); err != nil {
			return fmt.Errorf("delete torrent profile assignment: %w", err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM torrent_profile_needs_choice WHERE hash = ?",
			hash,
		); err != nil {
			return fmt.Errorf("delete pending torrent profile choice: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit torrent profile record cleanup: %w", err)
	}

	return nil
}

// ReplaceTorrentProfileAssignments sets or clears one profile for every given hash.
//
// All requested torrents change together, and repeated hashes are rejected before the
// transaction mutates any assignment.
//
// Since: 2.0.0
func (store *Store) ReplaceTorrentProfileAssignments(
	ctx context.Context,
	hashes []string,
	profileID *string,
) error {
	normalizedHashes, err := normalizeTorrentHashes(hashes)
	if err != nil {
		return err
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin torrent profile assignment: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if profileID != nil {
		var exists int
		if err := transaction.QueryRowContext(
			ctx,
			"SELECT COUNT(*) FROM torrent_profiles WHERE id = ?",
			*profileID,
		).Scan(&exists); err != nil {
			return fmt.Errorf("verify torrent profile assignment: %w", err)
		}
		if exists == 0 {
			return ErrNotFound
		}
	}

	for _, hash := range normalizedHashes {
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM torrent_profile_needs_choice WHERE hash = ?",
			hash,
		); err != nil {
			return fmt.Errorf("clear pending torrent profile choice: %w", err)
		}
		if profileID == nil {
			if _, err := transaction.ExecContext(
				ctx,
				"DELETE FROM torrent_profile_assignments WHERE hash = ?",
				hash,
			); err != nil {
				return fmt.Errorf("clear torrent profile assignment: %w", err)
			}

			continue
		}

		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO torrent_profile_assignments (hash, profile_id, assigned_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT(hash) DO UPDATE SET
			   profile_id = excluded.profile_id,
			   assigned_at = excluded.assigned_at`,
			hash,
			*profileID,
			formatTime(time.Now()),
		); err != nil {
			return fmt.Errorf("store torrent profile assignment: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit torrent profile assignment: %w", err)
	}

	return nil
}

// DeleteStaleTorrentProfileAssignments removes records absent from a complete daemon list.
//
// The API rate-limits calls to this storage operation; comparison in Go avoids SQLite's
// bound-parameter limit for large torrent libraries.
//
// Since: 2.0.0
func (store *Store) DeleteStaleTorrentProfileAssignments(
	ctx context.Context,
	activeHashes map[string]struct{},
	pruneBefore time.Time,
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin stale torrent profile cleanup: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	rows, err := transaction.QueryContext(
		ctx,
		"SELECT hash, assigned_at FROM torrent_profile_assignments",
	)
	if err != nil {
		return fmt.Errorf("list stale torrent profile assignments: %w", err)
	}
	type staleAssignment struct {
		Hash       string
		AssignedAt string
	}
	staleAssignments := []staleAssignment{}
	for rows.Next() {
		var hash, assignedAtText string
		if err := rows.Scan(&hash, &assignedAtText); err != nil {
			_ = rows.Close()

			return fmt.Errorf("read stale torrent profile assignment: %w", err)
		}
		assignedAt, err := parseTime(assignedAtText)
		if err != nil {
			_ = rows.Close()

			return err
		}
		if _, active := activeHashes[hash]; !active && assignedAt.Before(pruneBefore) {
			staleAssignments = append(staleAssignments, staleAssignment{
				Hash:       hash,
				AssignedAt: assignedAtText,
			})
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()

		return fmt.Errorf("iterate stale torrent profile assignments: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close stale torrent profile assignments: %w", err)
	}

	for _, assignment := range staleAssignments {
		if _, err := transaction.ExecContext(
			ctx,
			`DELETE FROM torrent_profile_assignments
			 WHERE hash = ? AND assigned_at = ?`,
			assignment.Hash,
			assignment.AssignedAt,
		); err != nil {
			return fmt.Errorf("delete stale torrent profile assignment: %w", err)
		}
	}
	choiceRows, err := transaction.QueryContext(
		ctx,
		"SELECT hash, created_at FROM torrent_profile_needs_choice",
	)
	if err != nil {
		return fmt.Errorf("list stale pending torrent profile choices: %w", err)
	}
	type staleChoice struct {
		hash      string
		createdAt string
	}
	staleChoices := []staleChoice{}
	for choiceRows.Next() {
		var hash, createdAtText string
		if err := choiceRows.Scan(&hash, &createdAtText); err != nil {
			_ = choiceRows.Close()

			return fmt.Errorf("read stale pending torrent profile choice: %w", err)
		}
		createdAt, err := parseTime(createdAtText)
		if err != nil {
			_ = choiceRows.Close()

			return err
		}
		if _, active := activeHashes[hash]; !active && createdAt.Before(pruneBefore) {
			staleChoices = append(staleChoices, staleChoice{hash: hash, createdAt: createdAtText})
		}
	}
	if err := choiceRows.Err(); err != nil {
		_ = choiceRows.Close()

		return fmt.Errorf("iterate stale pending torrent profile choices: %w", err)
	}
	if err := choiceRows.Close(); err != nil {
		return fmt.Errorf("close stale pending torrent profile choices: %w", err)
	}
	for _, choice := range staleChoices {
		if _, err := transaction.ExecContext(
			ctx,
			`DELETE FROM torrent_profile_needs_choice
			 WHERE hash = ? AND created_at = ?`,
			choice.hash,
			choice.createdAt,
		); err != nil {
			return fmt.Errorf("delete stale pending torrent profile choice: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit stale torrent profile cleanup: %w", err)
	}

	return nil
}

// checkTorrentProfileName detects a case-insensitive collision outside the current ID.
func checkTorrentProfileName(ctx context.Context, transaction *sql.Tx, name string, id string) error {
	var defaultName string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT name FROM torrent_default_profile WHERE name = ? COLLATE NOCASE",
		name,
	).Scan(&defaultName)
	if err == nil {
		return ErrTorrentProfileNameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check Default torrent profile name: %w", err)
	}

	var otherID string
	err = transaction.QueryRowContext(
		ctx,
		"SELECT id FROM torrent_profiles WHERE name = ? COLLATE NOCASE AND id <> ?",
		name,
		id,
	).Scan(&otherID)
	if err == nil {
		return ErrTorrentProfileNameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check torrent profile name: %w", err)
	}

	return nil
}

// checkDefaultTorrentProfileName detects a named-profile collision.
func checkDefaultTorrentProfileName(ctx context.Context, transaction *sql.Tx, name string) error {
	var profileID string
	err := transaction.QueryRowContext(
		ctx,
		"SELECT id FROM torrent_profiles WHERE name = ? COLLATE NOCASE LIMIT 1",
		name,
	).Scan(&profileID)
	if err == nil {
		return ErrTorrentProfileNameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check Default torrent profile name: %w", err)
	}

	return nil
}

// checkTorrentProfileFolder detects a case-insensitive named-profile collision.
func checkTorrentProfileFolder(
	ctx context.Context,
	transaction *sql.Tx,
	downloadDirectory string,
	id string,
) error {
	rows, err := transaction.QueryContext(
		ctx,
		`SELECT name, download_directory
		 FROM torrent_profiles
		 WHERE id <> ?
		 ORDER BY name COLLATE NOCASE, name, id`,
		id,
	)
	if err != nil {
		return fmt.Errorf("check torrent profile folder: %w", err)
	}
	defer rows.Close()
	// Named profiles never share a folder or nest inside one another.
	for rows.Next() {
		var profileName string
		var profileDirectory string
		if err := rows.Scan(&profileName, &profileDirectory); err != nil {
			return fmt.Errorf("check torrent profile folder: %w", err)
		}
		relation := TorrentProfileFolderRelation(downloadDirectory, profileDirectory)
		if relation == "" {
			continue
		}
		if relation == "same" {
			relation = ""
		}

		return &TorrentProfileFolderConflict{
			DownloadDirectory: filepath.Clean(profileDirectory),
			ProfileName:       profileName,
			Relation:          relation,
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("check torrent profile folder: %w", err)
	}

	return nil
}

// encodeTorrentProfileJSON prepares the three structured columns for one write.
func encodeTorrentProfileJSON(profile TorrentProfile) (string, string, string, error) {
	if profile.Labels == nil {
		profile.Labels = []string{}
	}
	if profile.MatchPatterns == nil {
		profile.MatchPatterns = []string{}
	}

	labelsJSON, err := json.Marshal(profile.Labels)
	if err != nil {
		return "", "", "", fmt.Errorf("encode torrent profile labels: %w", err)
	}
	optionsJSON, err := json.Marshal(profile.Options)
	if err != nil {
		return "", "", "", fmt.Errorf("encode torrent profile options: %w", err)
	}
	patternsJSON, err := json.Marshal(profile.MatchPatterns)
	if err != nil {
		return "", "", "", fmt.Errorf("encode torrent profile match patterns: %w", err)
	}

	return string(labelsJSON), string(optionsJSON), string(patternsJSON), nil
}

// scanTorrentProfile decodes one row and rejects malformed JSON or timestamps.
func scanTorrentProfile(scanner rowScanner) (TorrentProfile, error) {
	var profile TorrentProfile
	var labelsJSON, optionsJSON, patternsJSON string
	var startPaused int
	var connectionID sql.NullString
	var createdAt, updatedAt string
	if err := scanner.Scan(
		&profile.ID,
		&profile.Name,
		&profile.DownloadDirectory,
		&labelsJSON,
		&startPaused,
		&optionsJSON,
		&patternsJSON,
		&connectionID,
		&createdAt,
		&updatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TorrentProfile{}, err
		}

		return TorrentProfile{}, fmt.Errorf("read torrent profile: %w", err)
	}

	if err := json.Unmarshal([]byte(labelsJSON), &profile.Labels); err != nil {
		return TorrentProfile{}, fmt.Errorf("decode torrent profile labels: %w", err)
	}
	if err := json.Unmarshal([]byte(optionsJSON), &profile.Options); err != nil {
		return TorrentProfile{}, fmt.Errorf("decode torrent profile options: %w", err)
	}
	if err := json.Unmarshal([]byte(patternsJSON), &profile.MatchPatterns); err != nil {
		return TorrentProfile{}, fmt.Errorf("decode torrent profile match patterns: %w", err)
	}
	profile.StartPaused = startPaused == 1
	if connectionID.Valid {
		profile.ConnectionID = &connectionID.String
	}

	var err error
	profile.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return TorrentProfile{}, err
	}
	profile.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return TorrentProfile{}, err
	}
	if profile.Labels == nil {
		profile.Labels = []string{}
	}
	if profile.MatchPatterns == nil {
		profile.MatchPatterns = []string{}
	}

	return profile, nil
}

// scanDefaultTorrentProfile decodes the one Default profile row.
func scanDefaultTorrentProfile(scanner rowScanner) (DefaultTorrentProfile, error) {
	var profile DefaultTorrentProfile
	var labelsJSON, optionsJSON, updatedAt string
	var startPaused int
	if err := scanner.Scan(
		&profile.Name,
		&labelsJSON,
		&startPaused,
		&optionsJSON,
		&updatedAt,
	); err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("read Default torrent profile: %w", err)
	}

	if err := json.Unmarshal([]byte(labelsJSON), &profile.Labels); err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("decode Default torrent profile labels: %w", err)
	}
	if err := json.Unmarshal([]byte(optionsJSON), &profile.Options); err != nil {
		return DefaultTorrentProfile{}, fmt.Errorf("decode Default torrent profile options: %w", err)
	}
	profile.StartPaused = startPaused == 1
	parsedUpdatedAt, err := parseTime(updatedAt)
	if err != nil {
		return DefaultTorrentProfile{}, err
	}
	profile.UpdatedAt = parsedUpdatedAt
	if profile.Labels == nil {
		profile.Labels = []string{}
	}

	return profile, nil
}

// normalizeTorrentHashes lowercases stable hashes and rejects duplicates.
func normalizeTorrentHashes(hashes []string) ([]string, error) {
	normalized := make([]string, 0, len(hashes))
	seen := make(map[string]struct{}, len(hashes))
	for _, hash := range hashes {
		hash = strings.ToLower(strings.TrimSpace(hash))
		if hash == "" || len(hash) > 128 {
			return nil, errors.New("torrent hash is invalid")
		}
		if _, duplicate := seen[hash]; duplicate {
			return nil, errors.New("torrent hashes must not contain duplicates")
		}
		seen[hash] = struct{}{}
		normalized = append(normalized, hash)
	}

	return normalized, nil
}

// torrentProfileOptionalString maps the selected connection to SQL nullability.
func torrentProfileOptionalString(value *string) any {
	if value == nil {
		return nil
	}

	return *value
}
