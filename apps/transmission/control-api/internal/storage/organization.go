package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// MaximumTorrentLabels caps the saved label list, including labels saved automatically when used.
const MaximumTorrentLabels = 1024

var (
	// ErrTorrentOrganizationRevisionConflict indicates a stale library update.
	//
	// Clients refresh saved labels before retrying so two browser sessions cannot
	// silently replace one another's organization changes.
	ErrTorrentOrganizationRevisionConflict = errors.New("torrent organization revision conflict")
)

// TorrentOrganization contains the durable label choices for torrents.
//
// Labels remain separate from Transmission's runtime state so unused tags survive
// daemon restarts and remain available before a torrent references them.
type TorrentOrganization struct {
	Revision int64    `json:"revision"`
	Labels   []string `json:"labels"`
}

// TorrentLabelRename describes one saved-label rename.
//
// Profile labels follow the same rename while the organization list is replaced.
//
// Since: 2.0.0
type TorrentLabelRename struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// TorrentOrganization returns the current saved labels.
//
// Stable case-insensitive ordering keeps the API and interface deterministic while
// the revision supports safe full-list replacement by the management dialog.
func (store *Store) TorrentOrganization(ctx context.Context) (TorrentOrganization, error) {
	return readTorrentOrganization(ctx, store.databaseHandle())
}

// EnsureTorrentLabels saves labels that are not already organization choices.
//
// The case-insensitive primary key keeps the first saved spelling. The revision
// advances once only when this call inserts at least one label.
//
// Since: 2.0.0
func (store *Store) EnsureTorrentLabels(
	ctx context.Context,
	labels []string,
) (TorrentOrganization, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return TorrentOrganization{}, fmt.Errorf("begin torrent label transaction: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if _, err := ensureTorrentLabels(ctx, transaction, labels); err != nil {
		return TorrentOrganization{}, err
	}
	organization, err := readTorrentOrganization(ctx, transaction)
	if err != nil {
		return TorrentOrganization{}, err
	}
	if err := transaction.Commit(); err != nil {
		return TorrentOrganization{}, fmt.Errorf("commit torrent label transaction: %w", err)
	}

	return organization, nil
}

// UpdateTorrentOrganization atomically replaces all saved organization choices.
//
// One transaction protects the label list and its revision from partial updates.
func (store *Store) UpdateTorrentOrganization(
	ctx context.Context,
	expectedRevision int64,
	labels []string,
	removedLabels []string,
	renamedLabels []TorrentLabelRename,
) (TorrentOrganization, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return TorrentOrganization{}, fmt.Errorf("begin torrent organization transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	currentRevision, err := readTorrentOrganizationRevision(ctx, transaction)
	if err != nil {
		return TorrentOrganization{}, err
	}
	if currentRevision != expectedRevision {
		return TorrentOrganization{}, ErrTorrentOrganizationRevisionConflict
	}
	if err := updateTorrentProfileLabels(
		ctx,
		transaction,
		removedLabels,
		renamedLabels,
	); err != nil {
		return TorrentOrganization{}, err
	}

	if _, err := transaction.ExecContext(ctx, "DELETE FROM torrent_labels"); err != nil {
		return TorrentOrganization{}, fmt.Errorf("clear torrent labels: %w", err)
	}

	createdAt := formatTime(time.Now())
	for _, label := range labels {
		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO torrent_labels (name, created_at) VALUES (?, ?)",
			label,
			createdAt,
		); err != nil {
			return TorrentOrganization{}, fmt.Errorf("store torrent label: %w", err)
		}
	}

	nextRevision := currentRevision + 1
	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE metadata SET value = ? WHERE key = 'torrent_organization_revision'",
		nextRevision,
	); err != nil {
		return TorrentOrganization{}, fmt.Errorf("record torrent organization revision: %w", err)
	}
	organization, err := readTorrentOrganization(ctx, transaction)
	if err != nil {
		return TorrentOrganization{}, err
	}

	if err := transaction.Commit(); err != nil {
		return TorrentOrganization{}, fmt.Errorf("commit torrent organization transaction: %w", err)
	}
	committed = true

	return organization, nil
}

// ensureTorrentLabels inserts missing labels and advances the organization revision.
//
// Callers with a larger write transaction reuse this helper so the label and the
// object that uses it become durable together.
func ensureTorrentLabels(
	ctx context.Context,
	transaction *sql.Tx,
	labels []string,
) (bool, error) {
	var savedCount int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM torrent_labels").Scan(&savedCount); err != nil {
		return false, fmt.Errorf("count torrent labels: %w", err)
	}

	createdAt := formatTime(time.Now())
	inserted := false
	for _, label := range labels {
		if label == "" {
			continue
		}
		// A full list stays as it is: the label still works on its torrent, it just isn't offered as a choice.
		if savedCount >= MaximumTorrentLabels {
			break
		}
		result, err := transaction.ExecContext(
			ctx,
			`INSERT INTO torrent_labels (name, created_at) VALUES (?, ?)
			 ON CONFLICT(name) DO NOTHING`,
			label,
			createdAt,
		)
		if err != nil {
			return false, fmt.Errorf("store torrent label: %w", err)
		}
		affectedRows, err := result.RowsAffected()
		if err != nil {
			return false, fmt.Errorf("inspect stored torrent label: %w", err)
		}
		if affectedRows > 0 {
			inserted = true
			savedCount++
		}
	}
	if !inserted {
		return false, nil
	}

	currentRevision, err := readTorrentOrganizationRevision(ctx, transaction)
	if err != nil {
		return false, err
	}
	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE metadata SET value = ? WHERE key = 'torrent_organization_revision'",
		currentRevision+1,
	); err != nil {
		return false, fmt.Errorf("record torrent organization revision: %w", err)
	}

	return true, nil
}

// updateTorrentProfileLabels applies explicit saved-label edits to every profile.
//
// Deletions and renames share the organization transaction so a removed label cannot
// be reintroduced later by choosing a stale profile.
func updateTorrentProfileLabels(
	ctx context.Context,
	transaction *sql.Tx,
	removedLabels []string,
	renamedLabels []TorrentLabelRename,
) error {
	if len(removedLabels) == 0 && len(renamedLabels) == 0 {
		return nil
	}

	type storedProfileLabels struct {
		id     string
		labels []string
	}
	rows, err := transaction.QueryContext(ctx, "SELECT id, labels_json FROM torrent_profiles")
	if err != nil {
		return fmt.Errorf("list torrent profile labels: %w", err)
	}
	profiles := []storedProfileLabels{}
	for rows.Next() {
		var id, labelsJSON string
		if err := rows.Scan(&id, &labelsJSON); err != nil {
			_ = rows.Close()

			return fmt.Errorf("read torrent profile labels: %w", err)
		}
		labels := []string{}
		if err := json.Unmarshal([]byte(labelsJSON), &labels); err != nil {
			_ = rows.Close()

			return fmt.Errorf("decode torrent profile labels: %w", err)
		}
		profiles = append(profiles, storedProfileLabels{id: id, labels: labels})
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()

		return fmt.Errorf("iterate torrent profile labels: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close torrent profile labels: %w", err)
	}

	for _, profile := range profiles {
		updated := applyStoredTorrentLabelChanges(profile.labels, removedLabels, renamedLabels)
		if equalStoredTorrentLabels(profile.labels, updated) {
			continue
		}
		labelsJSON, err := json.Marshal(updated)
		if err != nil {
			return fmt.Errorf("encode torrent profile labels: %w", err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			"UPDATE torrent_profiles SET labels_json = ?, updated_at = ? WHERE id = ?",
			string(labelsJSON),
			formatTime(time.Now()),
			profile.id,
		); err != nil {
			return fmt.Errorf("update torrent profile labels: %w", err)
		}
	}

	var defaultLabelsJSON string
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT labels_json FROM torrent_default_profile WHERE id = 1",
	).Scan(&defaultLabelsJSON); err != nil {
		return fmt.Errorf("read Default torrent profile labels: %w", err)
	}
	defaultLabels := []string{}
	if err := json.Unmarshal([]byte(defaultLabelsJSON), &defaultLabels); err != nil {
		return fmt.Errorf("decode Default torrent profile labels: %w", err)
	}
	updatedDefaultLabels := applyStoredTorrentLabelChanges(
		defaultLabels,
		removedLabels,
		renamedLabels,
	)
	if equalStoredTorrentLabels(defaultLabels, updatedDefaultLabels) {
		return nil
	}
	updatedDefaultLabelsJSON, err := json.Marshal(updatedDefaultLabels)
	if err != nil {
		return fmt.Errorf("encode Default torrent profile labels: %w", err)
	}
	if _, err := transaction.ExecContext(
		ctx,
		`UPDATE torrent_default_profile
		 SET labels_json = ?, updated_at = ?
		 WHERE id = 1`,
		string(updatedDefaultLabelsJSON),
		formatTime(time.Now()),
	); err != nil {
		return fmt.Errorf("update Default torrent profile labels: %w", err)
	}

	return nil
}

func applyStoredTorrentLabelChanges(
	labels []string,
	removedLabels []string,
	renamedLabels []TorrentLabelRename,
) []string {
	removed := make(map[string]struct{}, len(removedLabels))
	for _, label := range removedLabels {
		removed[strings.ToLower(label)] = struct{}{}
	}
	renamed := make(map[string]string, len(renamedLabels))
	for _, rename := range renamedLabels {
		renamed[strings.ToLower(rename.From)] = rename.To
	}

	updated := make([]string, 0, len(labels))
	seen := make(map[string]struct{}, len(labels))
	for _, label := range labels {
		normalized := strings.ToLower(label)
		if _, remove := removed[normalized]; remove {
			continue
		}
		if replacement, rename := renamed[normalized]; rename {
			label = replacement
			normalized = strings.ToLower(label)
		}
		if _, duplicate := seen[normalized]; duplicate {
			continue
		}
		seen[normalized] = struct{}{}
		updated = append(updated, label)
	}

	return updated
}

func equalStoredTorrentLabels(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}

	return true
}

// readTorrentOrganization reads one snapshot through a database or transaction.
//
// Keeping the reader query-compatible makes the storage boundary reusable when a
// future mutation needs to return the exact state observed inside its transaction.
func readTorrentOrganization(
	ctx context.Context,
	queryTarget queryInterface,
) (TorrentOrganization, error) {
	revision, err := readTorrentOrganizationRevision(ctx, queryTarget)
	if err != nil {
		return TorrentOrganization{}, err
	}

	labels, err := readTorrentOrganizationValues(
		ctx,
		queryTarget,
		"SELECT name FROM torrent_labels ORDER BY name COLLATE NOCASE, name",
	)
	if err != nil {
		return TorrentOrganization{}, fmt.Errorf("read torrent labels: %w", err)
	}

	return TorrentOrganization{
		Revision: revision,
		Labels:   labels,
	}, nil
}

// readTorrentOrganizationRevision returns the optimistic library revision.
//
// Parsing the metadata value explicitly treats a corrupt revision as a storage
// failure instead of accepting a zero value that could permit a stale overwrite.
func readTorrentOrganizationRevision(
	ctx context.Context,
	queryTarget queryInterface,
) (int64, error) {
	var revisionValue string
	if err := queryTarget.QueryRowContext(
		ctx,
		"SELECT value FROM metadata WHERE key = 'torrent_organization_revision'",
	).Scan(&revisionValue); err != nil {
		return 0, fmt.Errorf("read torrent organization revision: %w", err)
	}

	revision, err := strconv.ParseInt(revisionValue, 10, 64)
	if err != nil || revision < 0 {
		return 0, errors.New("torrent organization revision is invalid")
	}

	return revision, nil
}

// readTorrentOrganizationValues returns one ordered string column.
//
// A shared iterator keeps location and label reads consistent without exposing SQL
// details beyond this focused storage module.
func readTorrentOrganizationValues(
	ctx context.Context,
	queryTarget queryInterface,
	statement string,
) ([]string, error) {
	rows, err := queryTarget.QueryContext(ctx, statement)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := []string{}
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return values, nil
}

var _ queryInterface = (*sql.DB)(nil)
var _ queryInterface = (*sql.Tx)(nil)
