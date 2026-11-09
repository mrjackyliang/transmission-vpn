-- The Default profile keeps its fixed identity while exposing the same
-- user-owned, case-insensitively unique display name as every named profile.
ALTER TABLE torrent_default_profile
  ADD COLUMN name TEXT NOT NULL COLLATE NOCASE
  DEFAULT 'Default profile'
  CHECK (length(trim(name)) BETWEEN 1 AND 64);
