-- Align the explicit tenant-safe foreign key with Prisma's generated name so
-- migration drift checks remain deterministic.
ALTER TABLE "DocumentChunk"
  RENAME CONSTRAINT "DocumentChunk_version_tenant_fkey"
  TO "DocumentChunk_versionId_accountId_condominiumId_fkey";
