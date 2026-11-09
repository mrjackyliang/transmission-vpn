ALTER TABLE vpn_profiles
  ADD COLUMN country_code TEXT NOT NULL DEFAULT '';

ALTER TABLE vpn_profiles
  ADD COLUMN country_name TEXT NOT NULL DEFAULT '';

ALTER TABLE vpn_profiles
  ADD COLUMN city TEXT NOT NULL DEFAULT '';

ALTER TABLE vpn_profiles
  ADD COLUMN continent TEXT NOT NULL DEFAULT '';

CREATE INDEX vpn_profiles_provider_location_index
  ON vpn_profiles(provider_id, current, continent, country_name, city, protocol);

ALTER TABLE vpn_active_configuration
  ADD COLUMN endpoint_strategy TEXT NOT NULL DEFAULT 'sticky'
  CHECK (endpoint_strategy IN ('sticky', 'ordered', 'randomized'));

CREATE TABLE vpn_active_endpoints (
  configuration_id INTEGER NOT NULL
    REFERENCES vpn_active_configuration(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  profile_id TEXT NOT NULL REFERENCES vpn_profiles(id),
  PRIMARY KEY (configuration_id, position),
  UNIQUE (configuration_id, profile_id)
) STRICT;

INSERT INTO vpn_active_endpoints (configuration_id, position, profile_id)
SELECT id, 0, profile_id
FROM vpn_active_configuration;
