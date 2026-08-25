CREATE TYPE "DocumentProcessingStatus" AS ENUM (
  'queued', 'scanning', 'extracting', 'indexed', 'partial', 'failed', 'cancelled'
);

CREATE TYPE "DocumentScanStatus" AS ENUM (
  'pending', 'clean', 'unavailable', 'infected', 'failed'
);

CREATE TYPE "AiProposalType" AS ENUM ('maintenance_plan', 'maintenance_ticket');
CREATE TYPE "AiProposalStatus" AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'applied');

ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "DocumentVersion"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "condominiumId" TEXT,
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'queued',
  ADD COLUMN "processingError" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "extractedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key"
  ON "DocumentVersion"("documentId", "versionNumber");
CREATE UNIQUE INDEX "DocumentVersion_condominiumId_checksum_key"
  ON "DocumentVersion"("condominiumId", "checksum");
CREATE INDEX "DocumentVersion_condominiumId_processingStatus_createdAt_idx"
  ON "DocumentVersion"("condominiumId", "processingStatus", "createdAt");

CREATE TABLE "DocumentChunk" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "condominiumId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "quoteHash" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentChunk_versionId_ordinal_key" ON "DocumentChunk"("versionId", "ordinal");
CREATE INDEX "DocumentChunk_condominiumId_createdAt_idx" ON "DocumentChunk"("condominiumId", "createdAt");
CREATE INDEX "DocumentChunk_accountId_condominiumId_idx" ON "DocumentChunk"("accountId", "condominiumId");

ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_condominiumId_fkey"
  FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiProposal" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "condominiumId" TEXT NOT NULL,
  "sourceVersionId" TEXT,
  "type" "AiProposalType" NOT NULL,
  "status" "AiProposalStatus" NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "citations" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "contentFingerprint" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdByEmail" TEXT NOT NULL,
  "reviewedByEmail" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "appliedEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProposal_condominiumId_type_contentFingerprint_key"
  ON "AiProposal"("condominiumId", "type", "contentFingerprint");
CREATE INDEX "AiProposal_condominiumId_status_createdAt_idx"
  ON "AiProposal"("condominiumId", "status", "createdAt");
CREATE INDEX "AiProposal_accountId_condominiumId_idx"
  ON "AiProposal"("accountId", "condominiumId");

ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_condominiumId_fkey"
  FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_sourceVersionId_fkey"
  FOREIGN KEY ("sourceVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
