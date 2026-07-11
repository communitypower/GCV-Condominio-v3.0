CREATE TYPE "DataImportSource" AS ENUM ('csv', 'json', 'database_snapshot', 'document_manifest');
CREATE TYPE "DataImportEntity" AS ENUM ('buildings', 'units', 'equipment', 'residents', 'documents');
CREATE TYPE "DataImportStatus" AS ENUM ('draft', 'validated', 'processing', 'completed', 'failed');

CREATE TABLE "DataImportJob" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "source" "DataImportSource" NOT NULL,
    "entity" "DataImportEntity" NOT NULL,
    "fileName" TEXT,
    "status" "DataImportStatus" NOT NULL DEFAULT 'draft',
    "createdByEmail" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "validationReport" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DataImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataImportJob_condominiumId_createdAt_idx" ON "DataImportJob"("condominiumId", "createdAt");

ALTER TABLE "DataImportJob" ADD CONSTRAINT "DataImportJob_condominiumId_fkey"
FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
