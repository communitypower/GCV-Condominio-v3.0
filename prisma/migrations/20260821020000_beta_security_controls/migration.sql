-- Password reset tokens are stored only as one-way hashes and are single-use.
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill legacy document versions before enforcing tenant ownership.
UPDATE "DocumentVersion" AS version
SET
  "condominiumId" = document."condominiumId",
  "accountId" = condominium."accountId"
FROM "Document" AS document
JOIN "Condominium" AS condominium ON condominium."id" = document."condominiumId"
WHERE version."documentId" = document."id"
  AND (version."condominiumId" IS NULL OR version."accountId" IS NULL);

ALTER TABLE "DocumentVersion" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "DocumentVersion" ALTER COLUMN "condominiumId" SET NOT NULL;
CREATE UNIQUE INDEX "DocumentVersion_id_accountId_condominiumId_key"
  ON "DocumentVersion"("id", "accountId", "condominiumId");

ALTER TABLE "DocumentChunk" DROP CONSTRAINT IF EXISTS "DocumentChunk_versionId_fkey";
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_version_tenant_fkey"
  FOREIGN KEY ("versionId", "accountId", "condominiumId")
  REFERENCES "DocumentVersion"("id", "accountId", "condominiumId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "purgeRequestedAt" TIMESTAMP(3),
  ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE INDEX "Document_deletedAt_retentionUntil_legalHold_idx"
  ON "Document"("deletedAt", "retentionUntil", "legalHold");
