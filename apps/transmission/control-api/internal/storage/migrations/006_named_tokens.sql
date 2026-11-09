-- Revoking a token now deletes it, so rows revoked under the old behavior go away.
DELETE FROM api_tokens
WHERE revoked_at IS NOT NULL;

ALTER TABLE api_tokens
  DROP COLUMN revoked_at;

-- Token names become unique without regard to letter case. Later copies of a name
-- get " 2", " 3", and so on, shortened so the name stays within 80 characters.
CREATE TEMP TABLE api_token_name_ranks AS
SELECT
  id,
  ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS position
FROM api_tokens;

UPDATE api_tokens
SET name = (
  SELECT substr(api_tokens.name, 1, 80 - length(' ' || ranks.position)) || ' ' || ranks.position
  FROM api_token_name_ranks AS ranks
  WHERE ranks.id = api_tokens.id
)
WHERE id IN (
  SELECT id
  FROM api_token_name_ranks
  WHERE position > 1
);

DROP TABLE api_token_name_ranks;

-- A renamed copy can still match a token that already had that name, so any name
-- that is still repeated also gets its token's identifier.
UPDATE api_tokens
SET name = substr(name, 1, 80 - length(' ' || id)) || ' ' || id
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS position
    FROM api_tokens
  )
  WHERE position > 1
);

CREATE UNIQUE INDEX api_tokens_name_index ON api_tokens(name COLLATE NOCASE);
