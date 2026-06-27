-- Pre-register the beta Google identity for production OAuth validation.
WITH target_account AS (
  SELECT id FROM "Account" WHERE name = 'GCV Administradora LTDA' LIMIT 1
),
target_condominium AS (
  SELECT c.id, c."accountId"
  FROM "Condominium" c
  JOIN target_account a ON a.id = c."accountId"
  WHERE c.name = 'Condomínio Bella Vista Premium'
  LIMIT 1
),
upsert_person AS (
  INSERT INTO "Person" ("name", "email", "phone", "createdAt", "updatedAt")
  VALUES ('Cassiano Marins', 'cassianomarins@gmail.com', 'N/D', NOW(), NOW())
  ON CONFLICT ("email") DO UPDATE
    SET "name" = EXCLUDED."name",
        "updatedAt" = NOW()
  RETURNING id
),
upsert_user AS (
  INSERT INTO "User" ("email", "personId", "createdAt", "updatedAt")
  SELECT 'cassianomarins@gmail.com', id, NOW(), NOW()
  FROM upsert_person
  ON CONFLICT ("email") DO UPDATE
    SET "personId" = EXCLUDED."personId",
        "updatedAt" = NOW()
  RETURNING id
)
INSERT INTO "Membership" ("userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt")
SELECT u.id, c."accountId", c.id, 'syndic', NOW(), NOW()
FROM upsert_user u
CROSS JOIN target_condominium c
ON CONFLICT ("userId", "accountId", "condominiumId", "role") DO NOTHING;
