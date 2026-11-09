-- The optional web proxy has one global switch and any number of independent logins.
-- Passwords use the same Argon2id verifier as the local administrator, and the
-- nullable connection identifies the VPN each login will use when multi-VPN arrives.
CREATE TABLE web_proxy (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO web_proxy (id, enabled, updated_at)
VALUES (1, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE web_proxy_logins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  connection_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
