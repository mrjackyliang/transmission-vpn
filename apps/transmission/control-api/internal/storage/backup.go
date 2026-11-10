package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// BackupImportJob is one durable server-side import and its safe progress summary.
//
// PayloadNonce and PayloadCiphertext are populated only for resumable work. They are
// cleared atomically when the job reaches a terminal state.
//
// Since: 2.0.0
type BackupImportJob struct {
	ID                string
	Source            string
	Status            string
	PayloadNonce      []byte
	PayloadCiphertext []byte
	TotalTorrents     int
	CompletedTorrents int
	Summary           map[string]any
	Error             string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	StartedAt         *time.Time
	CompletedAt       *time.Time
	Items             []BackupImportItem
}

// BackupImportItem is the durable, secret-free progress for one imported torrent.
//
// Since: 2.0.0
type BackupImportItem struct {
	Position    int
	Hash        string
	Name        string
	ProfileName string
	Folder      string
	State       string
	Progress    float64
	Detail      string
	UpdatedAt   time.Time
}

// BackupAPIToken includes the digest omitted from ordinary token list responses.
//
// This type is restricted to the authenticated backup boundary.
//
// Since: 2.0.0
type BackupAPIToken struct {
	APIToken
	Digest []byte
}

// CreateBackupImportJob stores a pending job and all initial torrent rows together.
//
// The active-job partial index prevents two imports from applying configuration at
// once. Export plaintext is already encrypted before it crosses this boundary.
//
// Since: 2.0.0
func (store *Store) CreateBackupImportJob(
	ctx context.Context,
	job BackupImportJob,
) (BackupImportJob, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return BackupImportJob{}, fmt.Errorf("begin backup import creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	summaryJSON, err := json.Marshal(job.Summary)
	if err != nil {
		return BackupImportJob{}, fmt.Errorf("encode backup import summary: %w", err)
	}
	now := time.Now().UTC()
	job.Status = "queued"
	job.TotalTorrents = len(job.Items)
	job.CompletedTorrents = 0
	job.CreatedAt = now
	job.UpdatedAt = now
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO backup_import_jobs (
		   id, source, status, payload_nonce, payload_ciphertext, total_torrents,
		   completed_torrents, summary_json, created_at, updated_at
		 ) VALUES (?, ?, 'queued', ?, ?, ?, 0, ?, ?, ?)`,
		job.ID,
		job.Source,
		job.PayloadNonce,
		job.PayloadCiphertext,
		job.TotalTorrents,
		string(summaryJSON),
		formatTime(now),
		formatTime(now),
	); err != nil {
		return BackupImportJob{}, fmt.Errorf("create backup import: %w", err)
	}

	for position := range job.Items {
		item := &job.Items[position]
		item.Position = position
		item.State = "queued"
		item.Progress = 0
		item.UpdatedAt = now
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO backup_import_items (
			   job_id, position, hash, name, profile_name, folder, state, progress,
			   detail, updated_at
			 ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, '', ?)`,
			job.ID,
			position,
			item.Hash,
			item.Name,
			item.ProfileName,
			item.Folder,
			formatTime(now),
		); err != nil {
			return BackupImportJob{}, fmt.Errorf("create backup import item: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return BackupImportJob{}, fmt.Errorf("commit backup import creation: %w", err)
	}

	return job, nil
}

// BackupImportJobByID returns a job and its torrent rows in stable order.
//
// Since: 2.0.0
func (store *Store) BackupImportJobByID(ctx context.Context, id string) (BackupImportJob, error) {
	job, err := scanBackupImportJob(store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, source, status, payload_nonce, payload_ciphertext, total_torrents,
		        completed_torrents, summary_json, error, created_at, updated_at,
		        started_at, completed_at
		 FROM backup_import_jobs
		 WHERE id = ?`,
		id,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return BackupImportJob{}, ErrNotFound
	}
	if err != nil {
		return BackupImportJob{}, err
	}

	job.Items, err = store.listBackupImportItems(ctx, id)
	if err != nil {
		return BackupImportJob{}, err
	}

	return job, nil
}

// ActiveBackupImportJob returns the queued or running import, if there is one.
//
// Since: 2.0.0
func (store *Store) ActiveBackupImportJob(ctx context.Context) (BackupImportJob, error) {
	job, err := scanBackupImportJob(store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, source, status, payload_nonce, payload_ciphertext, total_torrents,
		        completed_torrents, summary_json, error, created_at, updated_at,
		        started_at, completed_at
		 FROM backup_import_jobs
		 WHERE status IN ('queued', 'running')
		 ORDER BY created_at DESC
		 LIMIT 1`,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return BackupImportJob{}, ErrNotFound
	}
	if err != nil {
		return BackupImportJob{}, err
	}

	job.Items, err = store.listBackupImportItems(ctx, job.ID)
	if err != nil {
		return BackupImportJob{}, err
	}

	return job, nil
}

// ResumableBackupImportJobs lists jobs interrupted while queued or running.
//
// Since: 2.0.0
func (store *Store) ResumableBackupImportJobs(ctx context.Context) ([]BackupImportJob, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		`SELECT id, source, status, payload_nonce, payload_ciphertext, total_torrents,
		        completed_torrents, summary_json, error, created_at, updated_at,
		        started_at, completed_at
		 FROM backup_import_jobs
		 WHERE status IN ('queued', 'running')
		 ORDER BY created_at`,
	)
	if err != nil {
		return nil, fmt.Errorf("list resumable backup imports: %w", err)
	}
	defer rows.Close()

	jobs := []BackupImportJob{}
	for rows.Next() {
		job, scanError := scanBackupImportJob(rows)
		if scanError != nil {
			return nil, scanError
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate resumable backup imports: %w", err)
	}

	return jobs, nil
}

// StartBackupImportJob marks a resumable job as running.
//
// Since: 2.0.0
func (store *Store) StartBackupImportJob(ctx context.Context, id string) error {
	now := formatTime(time.Now())
	result, err := store.databaseHandle().ExecContext(
		ctx,
		`UPDATE backup_import_jobs
		 SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
		 WHERE id = ? AND status IN ('queued', 'running')`,
		now,
		now,
		id,
	)
	if err != nil {
		return fmt.Errorf("start backup import: %w", err)
	}
	if changed, err := result.RowsAffected(); err != nil || changed != 1 {
		if err != nil {
			return fmt.Errorf("inspect backup import start: %w", err)
		}

		return ErrNotFound
	}

	return nil
}

// UpdateBackupImportItem records one torrent stage and refreshes the completed count.
//
// Since: 2.0.0
func (store *Store) UpdateBackupImportItem(
	ctx context.Context,
	jobID string,
	position int,
	state string,
	progress float64,
	detail string,
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin backup import progress: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	now := formatTime(time.Now())
	result, err := transaction.ExecContext(
		ctx,
		`UPDATE backup_import_items
		 SET state = ?, progress = ?, detail = ?, updated_at = ?
		 WHERE job_id = ? AND position = ?`,
		state,
		progress,
		detail,
		now,
		jobID,
		position,
	)
	if err != nil {
		return fmt.Errorf("update backup import item: %w", err)
	}
	if changed, err := result.RowsAffected(); err != nil || changed != 1 {
		if err != nil {
			return fmt.Errorf("inspect backup import item update: %w", err)
		}

		return ErrNotFound
	}
	if _, err := transaction.ExecContext(
		ctx,
		`UPDATE backup_import_jobs
		 SET completed_torrents = (
		       SELECT COUNT(*) FROM backup_import_items
		       WHERE job_id = ?
		         AND state IN ('seeding', 'downloading', 'paused', 'data-missing', 'already-added', 'failed')
		     ),
		     updated_at = ?
		 WHERE id = ?`,
		jobID,
		now,
		jobID,
	); err != nil {
		return fmt.Errorf("update backup import count: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit backup import progress: %w", err)
	}

	return nil
}

// FinishBackupImportJob stores terminal state and destroys the encrypted payload.
//
// Since: 2.0.0
func (store *Store) FinishBackupImportJob(
	ctx context.Context,
	id string,
	status string,
	summary map[string]any,
	errorMessage string,
) error {
	if status != "completed" && status != "failed" {
		return errors.New("backup import terminal status is invalid")
	}
	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		return fmt.Errorf("encode backup import summary: %w", err)
	}
	now := formatTime(time.Now())
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`UPDATE backup_import_jobs
		 SET status = ?, payload_nonce = NULL, payload_ciphertext = NULL,
		     summary_json = ?, error = NULLIF(?, ''), updated_at = ?, completed_at = ?
		 WHERE id = ?`,
		status,
		string(summaryJSON),
		errorMessage,
		now,
		now,
		id,
	); err != nil {
		return fmt.Errorf("finish backup import: %w", err)
	}

	return nil
}

// ListAPITokensForBackup returns token metadata together with restorable digests.
//
// Since: 2.0.0
func (store *Store) ListAPITokensForBackup(ctx context.Context) ([]BackupAPIToken, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		`SELECT id, name, token_digest, scopes_json, expires_at, created_at, last_used_at
		 FROM api_tokens
		 ORDER BY created_at DESC, id`,
	)
	if err != nil {
		return nil, fmt.Errorf("list API tokens for backup: %w", err)
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
			return nil, fmt.Errorf("scan API token for backup: %w", err)
		}
		if err := json.Unmarshal([]byte(scopesJSON), &token.Scopes); err != nil {
			return nil, fmt.Errorf("decode API token scopes for backup: %w", err)
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
		return nil, fmt.Errorf("iterate API tokens for backup: %w", err)
	}

	return tokens, nil
}

func (store *Store) listBackupImportItems(
	ctx context.Context,
	jobID string,
) ([]BackupImportItem, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		`SELECT position, hash, name, profile_name, folder, state, progress, detail,
		        updated_at
		 FROM backup_import_items
		 WHERE job_id = ?
		 ORDER BY position`,
		jobID,
	)
	if err != nil {
		return nil, fmt.Errorf("list backup import items: %w", err)
	}
	defer rows.Close()

	items := []BackupImportItem{}
	for rows.Next() {
		var item BackupImportItem
		var updatedAt string
		if err := rows.Scan(
			&item.Position,
			&item.Hash,
			&item.Name,
			&item.ProfileName,
			&item.Folder,
			&item.State,
			&item.Progress,
			&item.Detail,
			&updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan backup import item: %w", err)
		}
		item.UpdatedAt, err = parseTime(updatedAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate backup import items: %w", err)
	}

	return items, nil
}

func scanBackupImportJob(row interface{ Scan(...any) error }) (BackupImportJob, error) {
	var job BackupImportJob
	var summaryJSON string
	var errorMessage sql.NullString
	var createdAt string
	var updatedAt string
	var startedAt sql.NullString
	var completedAt sql.NullString
	if err := row.Scan(
		&job.ID,
		&job.Source,
		&job.Status,
		&job.PayloadNonce,
		&job.PayloadCiphertext,
		&job.TotalTorrents,
		&job.CompletedTorrents,
		&summaryJSON,
		&errorMessage,
		&createdAt,
		&updatedAt,
		&startedAt,
		&completedAt,
	); err != nil {
		return BackupImportJob{}, err
	}
	if err := json.Unmarshal([]byte(summaryJSON), &job.Summary); err != nil {
		return BackupImportJob{}, fmt.Errorf("decode backup import summary: %w", err)
	}
	if job.Summary == nil {
		job.Summary = map[string]any{}
	}
	job.Error = errorMessage.String
	var err error
	job.CreatedAt, err = parseTime(createdAt)
	if err != nil {
		return BackupImportJob{}, err
	}
	job.UpdatedAt, err = parseTime(updatedAt)
	if err != nil {
		return BackupImportJob{}, err
	}
	if startedAt.Valid {
		parsed, parseError := parseTime(startedAt.String)
		if parseError != nil {
			return BackupImportJob{}, parseError
		}
		job.StartedAt = &parsed
	}
	if completedAt.Valid {
		parsed, parseError := parseTime(completedAt.String)
		if parseError != nil {
			return BackupImportJob{}, parseError
		}
		job.CompletedAt = &parsed
	}

	return job, nil
}
