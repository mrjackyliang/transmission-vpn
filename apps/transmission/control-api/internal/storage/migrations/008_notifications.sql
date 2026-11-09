-- Destinations get alerts for the events they choose. Secret fields are sealed together
-- with the installation key: secret_fields names the sealed ones, and missing_secrets
-- names the ones a lost key removed, which keeps the destination skipped until they are
-- entered again.
CREATE TABLE notification_targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN (
    'apprise', 'discord', 'email', 'gotify', 'matrix', 'ntfy', 'ntfy-reverse-proxy',
    'pushover', 'slack', 'telegram', 'webhook'
  )),
  events TEXT NOT NULL,
  settings TEXT NOT NULL,
  secret_fields TEXT NOT NULL,
  missing_secrets TEXT NOT NULL,
  secrets_nonce BLOB,
  secrets_ciphertext BLOB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_attempt_at TEXT,
  last_error TEXT,
  CHECK ((secrets_nonce IS NULL) = (secrets_ciphertext IS NULL))
) STRICT;

CREATE UNIQUE INDEX notification_targets_name_index
  ON notification_targets(name COLLATE NOCASE);

-- The lost-key notice can now name a destination whose secrets were removed. Removing
-- the destination removes its entry.
CREATE TABLE removed_secrets_next (
  kind TEXT NOT NULL CHECK (kind IN ('authenticator', 'notification', 'vpn')),
  administrator_id INTEGER REFERENCES administrators(id) ON DELETE CASCADE,
  notification_id TEXT REFERENCES notification_targets(id) ON DELETE CASCADE,
  removed_at TEXT NOT NULL,
  CHECK ((kind = 'notification') = (notification_id IS NOT NULL))
) STRICT;

INSERT INTO removed_secrets_next (kind, administrator_id, notification_id, removed_at)
SELECT kind, administrator_id, NULL, removed_at
FROM removed_secrets;

DROP TABLE removed_secrets;

ALTER TABLE removed_secrets_next RENAME TO removed_secrets;

CREATE UNIQUE INDEX removed_secrets_kind_administrator_index
  ON removed_secrets(kind, COALESCE(administrator_id, 0), COALESCE(notification_id, ''));
