CREATE TABLE vpn_profiles (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  remote_host TEXT NOT NULL,
  remote_port INTEGER NOT NULL CHECK (remote_port BETWEEN 1 AND 65535),
  fingerprint TEXT NOT NULL,
  source TEXT NOT NULL,
  current INTEGER NOT NULL CHECK (current IN (0, 1)),
  nonce BLOB NOT NULL,
  ciphertext BLOB NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX vpn_profiles_provider_current_index
  ON vpn_profiles(provider_id, current, display_name);

CREATE TABLE vpn_catalogs (
  provider_id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  endpoint_count INTEGER NOT NULL,
  refreshed_at TEXT NOT NULL
) STRICT;

CREATE TABLE vpn_active_configuration (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES vpn_profiles(id),
  credentials_nonce BLOB NOT NULL,
  credentials_ciphertext BLOB NOT NULL,
  dns_servers_json TEXT NOT NULL,
  retry_interval_seconds INTEGER NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
