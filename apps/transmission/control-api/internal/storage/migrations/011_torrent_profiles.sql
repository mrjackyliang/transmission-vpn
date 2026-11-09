-- Torrent profiles are application-owned presets. Their JSON columns retain the
-- complete labels, matching patterns, and Transmission options chosen for each one;
-- no value falls back to a global setting.
CREATE TABLE torrent_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  download_directory TEXT NOT NULL COLLATE NOCASE UNIQUE,
  labels_json TEXT NOT NULL,
  start_paused INTEGER NOT NULL CHECK (start_paused IN (0, 1)),
  options_json TEXT NOT NULL,
  match_patterns_json TEXT NOT NULL,
  connection_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

-- The Default profile owns the setting-backed Download directory separately from
-- its application-owned labels, paused state, and per-torrent options.
CREATE TABLE torrent_default_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  labels_json TEXT NOT NULL,
  start_paused INTEGER NOT NULL CHECK (start_paused IN (0, 1)),
  options_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO torrent_default_profile (
  id,
  labels_json,
  start_paused,
  options_json,
  updated_at
) VALUES (
  1,
  '[]',
  0,
  '{"seeding":{"mode":"never","ratio":null,"idleMinutes":null},"downloadLimitKBps":null,"uploadLimitKBps":null,"bandwidthPriority":0,"peerLimit":50,"queue":"normal"}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Assignments use Transmission's stable lowercase hashString instead of its local
-- numeric ID. Removing a profile intentionally leaves its torrents with no profile.
CREATE TABLE torrent_profile_assignments (
  hash TEXT PRIMARY KEY CHECK (hash = lower(hash)),
  profile_id TEXT NOT NULL REFERENCES torrent_profiles(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL
) STRICT;

CREATE INDEX torrent_profile_assignments_profile_index
  ON torrent_profile_assignments(profile_id);

-- Pattern ties stay attached to a torrent even when matching profiles are deleted.
-- The owner resolves the durable marker explicitly through the console.
CREATE TABLE torrent_profile_needs_choice (
  hash TEXT PRIMARY KEY CHECK (hash = lower(hash)),
  profile_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
