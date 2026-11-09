-- VPN configuration moves from one singleton row to named connection records. The
-- migrated row keeps slot zero so today's tunnel interface and Transmission RPC port
-- remain unchanged until the multi-daemon phases are installed.
CREATE TABLE vpn_connections (
  id TEXT PRIMARY KEY,
  slot INTEGER NOT NULL UNIQUE CHECK (slot BETWEEN 0 AND 63),
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  provider_id TEXT NOT NULL,
  tunnel TEXT NOT NULL CHECK (tunnel IN ('openvpn', 'wireguard')),
  endpoint_strategy TEXT NOT NULL
    CHECK (endpoint_strategy IN ('sticky', 'ordered', 'randomized')),
  credentials_nonce BLOB,
  credentials_ciphertext BLOB,
  credentials_legacy_profile_id TEXT,
  dns_servers_json TEXT NOT NULL,
  retry_interval_seconds INTEGER NOT NULL
    CHECK (retry_interval_seconds BETWEEN 3 AND 600),
  peer_port INTEGER NOT NULL CHECK (peer_port BETWEEN 1024 AND 65535),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX vpn_connections_default_unique_index
  ON vpn_connections(is_default)
  WHERE is_default = 1;

CREATE TABLE vpn_connection_endpoints (
  connection_id TEXT NOT NULL REFERENCES vpn_connections(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  profile_id TEXT NOT NULL REFERENCES vpn_profiles(id),
  PRIMARY KEY (connection_id, position),
  UNIQUE (connection_id, profile_id)
) STRICT;

CREATE INDEX vpn_connection_endpoints_profile_index
  ON vpn_connection_endpoints(profile_id);

CREATE INDEX torrent_profiles_connection_index
  ON torrent_profiles(connection_id);

CREATE INDEX web_proxy_logins_connection_index
  ON web_proxy_logins(connection_id);

INSERT INTO vpn_connections (
  id,
  slot,
  name,
  is_default,
  enabled,
  provider_id,
  tunnel,
  endpoint_strategy,
  credentials_nonce,
  credentials_ciphertext,
  credentials_legacy_profile_id,
  dns_servers_json,
  retry_interval_seconds,
  peer_port,
  revision,
  created_at,
  updated_at
)
SELECT
  'vpc-' || lower(hex(randomblob(8))),
  0,
  CASE provider_id
    WHEN 'custom' THEN 'Custom'
    WHEN 'purevpn' THEN 'PureVPN'
    WHEN 'pia' THEN 'Private Internet Access'
    WHEN 'ipvanish' THEN 'IPVanish'
    WHEN 'nordvpn' THEN 'NordVPN'
    WHEN 'surfshark' THEN 'Surfshark'
    WHEN 'ivpn' THEN 'IVPN'
    WHEN 'mullvad' THEN 'Mullvad'
    ELSE provider_id
  END,
  1,
  enabled,
  provider_id,
  tunnel,
  endpoint_strategy,
  credentials_nonce,
  credentials_ciphertext,
  COALESCE(
    (
      SELECT profile_id
      FROM vpn_active_endpoints
      WHERE configuration_id = vpn_active_configuration.id
      ORDER BY position
      LIMIT 1
    ),
    profile_id
  ),
  COALESCE(
    (
      SELECT json_group_array(address)
      FROM (
        SELECT value AS address
        FROM json_each(vpn_active_configuration.dns_servers_json)
        WHERE type = 'text'
          AND instr(value, ':') = 0
          AND value GLOB '[0-9]*.[0-9]*.[0-9]*.[0-9]*'
        ORDER BY key
      ) AS ipv4_dns_servers
    ),
    '[]'
  ),
  retry_interval_seconds,
  COALESCE(
    (
      SELECT CAST(value_json AS INTEGER)
      FROM managed_settings
      WHERE key = 'transmission.peerPort' AND mode = 'lock'
    ),
    (
      SELECT CAST(value_json AS INTEGER)
      FROM settings
      WHERE key = 'transmission.peerPort'
    ),
    51413
  ),
  1,
  updated_at,
  updated_at
FROM vpn_active_configuration;

INSERT INTO vpn_connection_endpoints (connection_id, position, profile_id)
SELECT vpn_connections.id, vpn_active_endpoints.position, vpn_active_endpoints.profile_id
FROM vpn_active_endpoints
JOIN vpn_connections ON vpn_connections.slot = 0
ORDER BY vpn_active_endpoints.position;

DROP TABLE vpn_active_endpoints;
DROP TABLE vpn_active_configuration;

-- These values now live only on a connection. Managed rows and the matching members
-- of revision JSON are removed too, so retired keys cannot reappear through history.
DELETE FROM settings
WHERE key IN (
  'vpn.provider',
  'vpn.tunnel',
  'vpn.endpointStrategy',
  'vpn.endpointIdentifiers',
  'vpn.retryIntervalSeconds',
  'vpn.dnsMode',
  'vpn.customDNSServers',
  'transmission.peerPort'
);

DELETE FROM managed_settings
WHERE key IN (
  'vpn.provider',
  'vpn.tunnel',
  'vpn.endpointStrategy',
  'vpn.endpointIdentifiers',
  'vpn.retryIntervalSeconds',
  'vpn.dnsMode',
  'vpn.customDNSServers',
  'transmission.peerPort'
);

UPDATE configuration_revisions
SET changes_json = json_remove(
  changes_json,
  '$."vpn.provider"',
  '$."vpn.tunnel"',
  '$."vpn.endpointStrategy"',
  '$."vpn.endpointIdentifiers"',
  '$."vpn.retryIntervalSeconds"',
  '$."vpn.dnsMode"',
  '$."vpn.customDNSServers"',
  '$."transmission.peerPort"'
)
WHERE changes_json LIKE '%"vpn.provider"%'
   OR changes_json LIKE '%"vpn.tunnel"%'
   OR changes_json LIKE '%"vpn.endpointStrategy"%'
   OR changes_json LIKE '%"vpn.endpointIdentifiers"%'
   OR changes_json LIKE '%"vpn.retryIntervalSeconds"%'
   OR changes_json LIKE '%"vpn.dnsMode"%'
   OR changes_json LIKE '%"vpn.customDNSServers"%'
   OR changes_json LIKE '%"transmission.peerPort"%';

DELETE FROM configuration_revisions
WHERE json(changes_json) = json('{}');
