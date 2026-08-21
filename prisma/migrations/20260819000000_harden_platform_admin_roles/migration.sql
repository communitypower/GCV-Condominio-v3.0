-- Canonical staff role for condominium-scoped operational access.
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'staff';

-- Only the two approved identities may hold platform-administrator status.
UPDATE "User"
SET "isSystemAdmin" = CASE
  WHEN LOWER("email") IN ('cassianomarins@gmail.com', 'vitorlcastro92@gmail.com') THEN TRUE
  ELSE FALSE
END,
"updatedAt" = NOW();

-- Remove the operational access granted automatically by the historical beta
-- identity migrations. A future condominium invitation can grant either user
-- an explicit tenant role without being affected by this one-time migration.
UPDATE "Membership"
SET "status" = 'revoked',
    "activatedAt" = NULL,
    "revokedAt" = NOW(),
    "revokedById" = NULL,
    "updatedAt" = NOW()
WHERE "id" IN (
  '1bc23654-22a4-4c5b-b17a-73333d749c27',
  '35a13b4b-6f01-435e-88d0-8feab8f132d9'
)
AND "status" <> 'revoked';
