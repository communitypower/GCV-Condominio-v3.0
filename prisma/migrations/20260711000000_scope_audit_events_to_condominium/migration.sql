ALTER TABLE "AuditEvent" ADD COLUMN "condominiumId" TEXT;
CREATE INDEX "AuditEvent_condominiumId_createdAt_idx" ON "AuditEvent"("condominiumId", "createdAt");
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_condominiumId_fkey"
FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
