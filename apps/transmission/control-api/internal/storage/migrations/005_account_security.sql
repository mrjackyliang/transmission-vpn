ALTER TABLE administrators
  ADD COLUMN webauthn_user_id BLOB;

ALTER TABLE administrators
  ADD COLUMN totp_nonce BLOB;

ALTER TABLE administrators
  ADD COLUMN totp_ciphertext BLOB;

ALTER TABLE administrators
  ADD COLUMN totp_enabled_at TEXT;

ALTER TABLE administrators
  ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0;

CREATE TABLE totp_enrollments (
  administrator_id INTEGER PRIMARY KEY REFERENCES administrators(id) ON DELETE CASCADE,
  nonce BLOB NOT NULL,
  ciphertext BLOB NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE recovery_codes (
  code_digest BLOB PRIMARY KEY,
  administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  used_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE sign_in_challenges (
  id TEXT PRIMARY KEY,
  administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  challenge_digest BLOB NOT NULL UNIQUE,
  failures INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  credential_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
) STRICT;

CREATE INDEX passkeys_administrator_rp_index ON passkeys(administrator_id, rp_id);

CREATE TABLE webauthn_ceremonies (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
  administrator_id INTEGER REFERENCES administrators(id) ON DELETE CASCADE,
  session_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

UPDATE api_tokens
SET scopes_json = REPLACE(
  REPLACE(scopes_json, '"read"', '"settings:read","torrents:read","vpn:read"'),
  '"transmission:write"',
  '"torrents:write"'
);
