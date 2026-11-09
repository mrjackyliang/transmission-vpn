-- WireGuard joins OpenVPN. Every existing profile, catalog, and active configuration
-- is OpenVPN, so the new columns default to it.
ALTER TABLE vpn_profiles
  ADD COLUMN tunnel TEXT NOT NULL DEFAULT 'openvpn'
  CHECK (tunnel IN ('openvpn', 'wireguard'));

DROP INDEX vpn_profiles_provider_current_index;

CREATE INDEX vpn_profiles_provider_current_index
  ON vpn_profiles(provider_id, tunnel, current, display_name);

DROP INDEX vpn_profiles_provider_location_index;

CREATE INDEX vpn_profiles_provider_location_index
  ON vpn_profiles(provider_id, tunnel, current, continent, country_name, city, protocol);

-- A provider can publish one catalog per tunnel, so the catalog key gains the tunnel.
CREATE TABLE vpn_catalogs_next (
  provider_id TEXT NOT NULL,
  tunnel TEXT NOT NULL CHECK (tunnel IN ('openvpn', 'wireguard')),
  source_url TEXT NOT NULL,
  endpoint_count INTEGER NOT NULL,
  refreshed_at TEXT NOT NULL,
  PRIMARY KEY (provider_id, tunnel)
) STRICT;

INSERT INTO vpn_catalogs_next (provider_id, tunnel, source_url, endpoint_count, refreshed_at)
SELECT provider_id, 'openvpn', source_url, endpoint_count, refreshed_at
FROM vpn_catalogs;

DROP TABLE vpn_catalogs;

ALTER TABLE vpn_catalogs_next RENAME TO vpn_catalogs;

ALTER TABLE vpn_active_configuration
  ADD COLUMN tunnel TEXT NOT NULL DEFAULT 'openvpn'
  CHECK (tunnel IN ('openvpn', 'wireguard'));
