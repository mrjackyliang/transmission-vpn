-- Compatible Transmission clients authenticate with credentials that are separate
-- from API tokens and web proxy logins. Only the generated password digest is kept;
-- successful use is recorded without rewriting the row more than once a minute.
CREATE TABLE rpc_logins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  secret_digest BLOB NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
) STRICT;
