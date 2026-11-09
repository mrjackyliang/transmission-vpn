-- Destination settings that used the mount root fall back to their registry
-- defaults. Removing the stored rows also restores their default provenance.
DELETE FROM settings
WHERE key = 'transmission.downloadDirectory'
  AND json_extract(value_json, '$') = '/data';

DELETE FROM settings
WHERE key = 'transmission.incompleteDirectory'
  AND json_extract(value_json, '$') = '/data';

-- Profiles remain usable after the stricter destination rule takes effect.
UPDATE torrent_profiles
SET download_directory = '/data/downloads'
WHERE download_directory = '/data';

