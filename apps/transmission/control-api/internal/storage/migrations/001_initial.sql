CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

INSERT INTO metadata (key, value) VALUES ('configuration_revision', '0');

CREATE TABLE administrators (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE setup_claims (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  claim_digest BLOB NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  token_digest BLOB NOT NULL UNIQUE,
  csrf_digest BLOB NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;

CREATE INDEX sessions_expiration_index ON sessions(expires_at);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  administrator_id INTEGER NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_digest BLOB NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
) STRICT;

CREATE INDEX api_tokens_digest_index ON api_tokens(token_digest);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  source TEXT NOT NULL,
  locked INTEGER NOT NULL CHECK (locked IN (0, 1)),
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE managed_settings (
  key TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('seed', 'lock')),
  value_json TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE configuration_revisions (
  revision INTEGER PRIMARY KEY,
  actor TEXT NOT NULL,
  changes_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE protected_secrets (
  key TEXT PRIMARY KEY,
  nonce BLOB NOT NULL,
  ciphertext BLOB NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
