INSERT INTO metadata (key, value)
VALUES ('torrent_organization_revision', '0');

CREATE TABLE torrent_labels (
  name TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL
) STRICT;
