-- Import jobs keep an encrypted copy of the submitted export while work is pending.
-- Completed jobs retain only non-secret progress and summary data.
CREATE TABLE backup_import_jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('transmission-vpn-export')),
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

CREATE UNIQUE INDEX backup_import_jobs_active_index
  ON backup_import_jobs((1))
  WHERE status IN ('queued', 'running');

CREATE TABLE backup_import_items (
  job_id TEXT NOT NULL REFERENCES backup_import_jobs(id) ON DELETE CASCADE,
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
