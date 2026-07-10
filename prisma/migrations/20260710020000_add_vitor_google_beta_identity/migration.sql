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
  INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt")
  VALUES ('f1f80cc1-d76f-4012-9e26-dd4f57bf4a3b', 'Vitor Castro', 'vitorlcastro92@gmail.com', 'N/D', NOW(), NOW())
  ON CONFLICT ("email") DO UPDATE
    SET "name" = EXCLUDED."name",
        "updatedAt" = NOW()
  RETURNING id
),
upsert_user AS (
  INSERT INTO "User" ("id", "email", "personId", "createdAt", "updatedAt")
  SELECT '30984b5a-3ddb-4d9f-bf43-a314831f5ec2', 'vitorlcastro92@gmail.com', id, NOW(), NOW()
  FROM upsert_person
  ON CONFLICT ("email") DO UPDATE
    SET "personId" = EXCLUDED."personId",
        "updatedAt" = NOW()
  RETURNING id
)
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt")
SELECT '35a13b4b-6f01-435e-88d0-8feab8f132d9', u.id, c."accountId", c.id, 'syndic', NOW(), NOW()
FROM upsert_user u
CROSS JOIN target_condominium c
ON CONFLICT ("userId", "accountId", "condominiumId", "role") DO NOTHING;
