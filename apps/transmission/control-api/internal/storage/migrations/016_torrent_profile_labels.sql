-- Labels already used by profiles become durable organization choices. Existing
-- saved spellings win case-insensitive conflicts; otherwise Default profile order,
-- then named profile creation order, determines the spelling retained.
WITH profile_labels (
  source_order,
  profile_order,
  label_order,
  label_name,
  value_type
) AS (
  SELECT
    0,
    '',
    label.key,
    label.value,
    label.type
  FROM torrent_default_profile
  JOIN json_each(torrent_default_profile.labels_json) AS label

  UNION ALL

  SELECT
    1,
    torrent_profiles.created_at || torrent_profiles.id,
    label.key,
    label.value,
    label.type
  FROM torrent_profiles
  JOIN json_each(torrent_profiles.labels_json) AS label
)
INSERT OR IGNORE INTO torrent_labels (name, created_at)
SELECT
  label_name,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM profile_labels
WHERE value_type = 'text'
  AND label_name <> ''
ORDER BY source_order, profile_order, CAST(label_order AS INTEGER);

UPDATE metadata
SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
WHERE key = 'torrent_organization_revision'
  AND changes() > 0;
