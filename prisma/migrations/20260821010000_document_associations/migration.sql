ALTER TABLE "Document"
ADD COLUMN "buildingId" TEXT,
ADD COLUMN "equipmentId" TEXT,
ADD COLUMN "maintenancePlanId" TEXT,
ADD COLUMN "maintenanceTicketId" TEXT;

CREATE INDEX "Document_condominiumId_category_updatedAt_idx"
ON "Document"("condominiumId", "category", "updatedAt");
CREATE INDEX "Document_buildingId_idx" ON "Document"("buildingId");
CREATE INDEX "Document_equipmentId_idx" ON "Document"("equipmentId");
CREATE INDEX "Document_maintenancePlanId_idx" ON "Document"("maintenancePlanId");
CREATE INDEX "Document_maintenanceTicketId_idx" ON "Document"("maintenanceTicketId");

ALTER TABLE "Document"
ADD CONSTRAINT "Document_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document"
ADD CONSTRAINT "Document_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document"
ADD CONSTRAINT "Document_maintenancePlanId_fkey"
FOREIGN KEY ("maintenancePlanId") REFERENCES "MaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document"
ADD CONSTRAINT "Document_maintenanceTicketId_fkey"
FOREIGN KEY ("maintenanceTicketId") REFERENCES "MaintenanceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
