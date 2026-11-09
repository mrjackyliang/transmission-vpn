-- Secrets a lost installation key removed stay listed until they are entered again or
-- the notice is dismissed. A NULL administrator means the whole appliance.
CREATE TABLE removed_secrets (
  kind TEXT NOT NULL CHECK (kind IN ('authenticator', 'vpn')),
  administrator_id INTEGER REFERENCES administrators(id) ON DELETE CASCADE,
  removed_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX removed_secrets_kind_administrator_index
  ON removed_secrets(kind, COALESCE(administrator_id, 0));
