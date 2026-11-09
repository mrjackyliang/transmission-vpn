-- Import jobs may originate from this app's export or another Transmission config.
-- Rebuild both related tables so existing durable jobs and progress rows are kept.
CREATE TABLE backup_import_jobs_next (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL
    CHECK (source IN ('transmission-vpn-export', 'another-transmission')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload_nonce BLOB,
  payload_ciphertext BLOB,
  total_torrents INTEGER NOT NULL CHECK (total_torrents >= 0),
  completed_torrents INTEGER NOT NULL DEFAULT 0
    CHECK (completed_torrents >= 0 AND completed_torrents <= total_torrents),
  summary_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  CHECK ((payload_nonce IS NULL) = (payload_ciphertext IS NULL))
) STRICT;

INSERT INTO backup_import_jobs_next (
  id,
  source,
  status,
  payload_nonce,
  payload_ciphertext,
  total_torrents,
  completed_torrents,
  summary_json,
  error,
  created_at,
  updated_at,
  started_at,
  completed_at
)
SELECT
  id,
  source,
  status,
  payload_nonce,
  payload_ciphertext,
  total_torrents,
  completed_torrents,
  summary_json,
  error,
  created_at,
  updated_at,
  started_at,
  completed_at
FROM backup_import_jobs;

CREATE TABLE backup_import_items_next (
  job_id TEXT NOT NULL REFERENCES backup_import_jobs_next(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  hash TEXT NOT NULL,
  name TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  folder TEXT NOT NULL,
  state TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  detail TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, position)
) STRICT;

INSERT INTO backup_import_items_next (
  job_id,
  position,
  hash,
  name,
  profile_name,
  folder,
  state,
  progress,
  detail,
  updated_at
)
SELECT
  job_id,
  position,
  hash,
  name,
  profile_name,
  folder,
  state,
  progress,
  detail,
  updated_at
FROM backup_import_items;

DROP TABLE backup_import_items;
DROP TABLE backup_import_jobs;

ALTER TABLE backup_import_jobs_next RENAME TO backup_import_jobs;
ALTER TABLE backup_import_items_next RENAME TO backup_import_items;

CREATE UNIQUE INDEX backup_import_jobs_active_index
  ON backup_import_jobs((1))
  WHERE status IN ('queued', 'running');
