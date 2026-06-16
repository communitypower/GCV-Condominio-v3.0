-- Migration: 0_init
-- Creates all tables from the Prisma schema and seeds initial data.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE "UnitType" AS ENUM ('apartment', 'house', 'penthouse');
CREATE TYPE "UnitStatus" AS ENUM ('occupied', 'vacant', 'maintenance');
CREATE TYPE "RelationshipRole" AS ENUM ('owner', 'tenant', 'dependent', 'authorized_contact');
CREATE TYPE "PlatformRole" AS ENUM ('admin', 'syndic', 'manager', 'council_member', 'accountant', 'doorman', 'resident', 'vendor');
CREATE TYPE "MaintenanceCategory" AS ENUM ('plumbing', 'electrical', 'elevators', 'common_area', 'security', 'gardens', 'structural', 'other');
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE "MaintenanceStatus" AS ENUM ('reported', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE "EquipmentStatus" AS ENUM ('operational', 'alert', 'critical', 'maintenance');
CREATE TYPE "PlanFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'semestral', 'annual');
CREATE TYPE "PlanStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "BillingStatus" AS ENUM ('paid', 'pending', 'overdue');
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'auth_login', 'auth_logout', 'export', 'document_access');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE "Account" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

CREATE TABLE "User" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "personId"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

CREATE TABLE "Condominium" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "address"   TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Condominium_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Building" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Unit" (
    "id"              TEXT NOT NULL,
    "number"          TEXT NOT NULL,
    "type"            "UnitType" NOT NULL,
    "status"          "UnitStatus" NOT NULL,
    "fractionalShare" DOUBLE PRECISION NOT NULL,
    "buildingId"      TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnitRelationship" (
    "id"        TEXT NOT NULL,
    "unitId"    TEXT NOT NULL,
    "personId"  TEXT NOT NULL,
    "role"      "RelationshipRole" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate"   TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "accountId"     TEXT NOT NULL,
    "condominiumId" TEXT,
    "role"          "PlatformRole" NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Membership_userId_accountId_condominiumId_role_key"
    ON "Membership"("userId", "accountId", "condominiumId", "role");

CREATE TABLE "MaintenanceTicket" (
    "id"            TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "unitId"        TEXT,
    "title"         TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    "category"      "MaintenanceCategory" NOT NULL,
    "priority"      "MaintenancePriority" NOT NULL,
    "status"        "MaintenanceStatus" NOT NULL,
    "reportedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"    TIMESTAMP(3),
    "assignedStaff" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost"    DOUBLE PRECISION,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketComment" (
    "id"         TEXT NOT NULL,
    "ticketId"   TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "comment"    TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketStatusHistory" (
    "id"         TEXT NOT NULL,
    "ticketId"   TEXT NOT NULL,
    "fromStatus" "MaintenanceStatus" NOT NULL,
    "toStatus"   "MaintenanceStatus" NOT NULL,
    "changedBy"  TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Equipment" (
    "id"             TEXT NOT NULL,
    "condominiumId"  TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "location"       TEXT NOT NULL,
    "category"       TEXT NOT NULL,
    "status"         "EquipmentStatus" NOT NULL,
    "lastInspection" TIMESTAMP(3) NOT NULL,
    "nextInspection" TIMESTAMP(3) NOT NULL,
    "installDate"    TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenancePlan" (
    "id"             TEXT NOT NULL,
    "condominiumId"  TEXT NOT NULL,
    "equipmentId"    TEXT,
    "title"          TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "frequency"      "PlanFrequency" NOT NULL,
    "nextOccurrence" TIMESTAMP(3) NOT NULL,
    "status"         "PlanStatus" NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPeriod" (
    "id"            TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "monthString"   TEXT NOT NULL,
    "closed"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Charge" (
    "id"              TEXT NOT NULL,
    "unitId"          TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "amount"          DOUBLE PRECISION NOT NULL,
    "dueDate"         TIMESTAMP(3) NOT NULL,
    "status"          "BillingStatus" NOT NULL,
    "paidAt"          TIMESTAMP(3),
    "issueDate"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barcode"         TEXT NOT NULL,
    "pixQrCode"       TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "penaltyFee"      DOUBLE PRECISION,
    "interestFee"     DOUBLE PRECISION,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChargeLineItem" (
    "id"          TEXT NOT NULL,
    "chargeId"    TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChargeLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id"            TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "unitId"        TEXT,
    "title"         TEXT NOT NULL,
    "category"      TEXT NOT NULL,
    "requiredRole"  "PlatformRole" NOT NULL DEFAULT 'resident',
    "filePath"      TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
    "id"            TEXT NOT NULL,
    "documentId"    TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath"      TEXT NOT NULL,
    "uploadedBy"    TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id"        TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId"    TEXT,
    "userEmail" TEXT,
    "action"    "AuditAction" NOT NULL,
    "entity"    TEXT NOT NULL,
    "entityId"  TEXT,
    "details"   TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "User"
    ADD CONSTRAINT "User_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Condominium"
    ADD CONSTRAINT "Condominium_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Building"
    ADD CONSTRAINT "Building_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Unit"
    ADD CONSTRAINT "Unit_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnitRelationship"
    ADD CONSTRAINT "UnitRelationship_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnitRelationship"
    ADD CONSTRAINT "UnitRelationship_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTicket"
    ADD CONSTRAINT "MaintenanceTicket_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTicket"
    ADD CONSTRAINT "MaintenanceTicket_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketComment"
    ADD CONSTRAINT "TicketComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketStatusHistory"
    ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Equipment"
    ADD CONSTRAINT "Equipment_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenancePlan"
    ADD CONSTRAINT "MaintenancePlan_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenancePlan"
    ADD CONSTRAINT "MaintenancePlan_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingPeriod"
    ADD CONSTRAINT "BillingPeriod_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Charge"
    ADD CONSTRAINT "Charge_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Charge"
    ADD CONSTRAINT "Charge_billingPeriodId_fkey"
    FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChargeLineItem"
    ADD CONSTRAINT "ChargeLineItem_chargeId_fkey"
    FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
    ADD CONSTRAINT "Document_condominiumId_fkey"
    FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
    ADD CONSTRAINT "Document_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
    ADD CONSTRAINT "DocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- SEED DATA
-- All IDs are fixed UUIDs so foreign-key relationships are
-- deterministic and the migration is idempotent when re-run
-- against a fresh database.
-- ============================================================

-- 1. Account
INSERT INTO "Account" ("id", "name", "createdAt", "updatedAt") VALUES
('a0000000-0000-0000-0000-000000000001', 'GCV Administradora LTDA', NOW(), NOW());

-- 2. Condominium
INSERT INTO "Condominium" ("id", "name", "address", "accountId", "createdAt", "updatedAt") VALUES
('c0000000-0000-0000-0000-000000000001', 'Condomínio Bella Vista Premium', 'Av. Paulista, 1000 - São Paulo, SP', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW());

-- 3. Buildings
INSERT INTO "Building" ("id", "name", "condominiumId", "createdAt", "updatedAt") VALUES
('b0000000-0000-0000-0000-000000000001', 'Bloco A',  'c0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('b0000000-0000-0000-0000-000000000002', 'Bloco B',  'c0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('b0000000-0000-0000-0000-000000000003', 'Casas',    'c0000000-0000-0000-0000-000000000001', NOW(), NOW());

-- 4. Syndic Person + User + Membership
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000001', 'Cassiano Marins', 'sindico@gcv.com.br', '(11) 99999-9999', NOW(), NOW());

INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000001', 'sindico@gcv.com.br', 'sindico123', 'p0000000-0000-0000-0000-000000000001', NOW(), NOW());

INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'syndic', NOW(), NOW());

-- 5. Staff (Zelador) Person + User + Membership
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000002', 'Geraldo Nascimento', 'zelador@gcv.com.br', '(11) 98888-8888', NOW(), NOW());

INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000002', 'zelador@gcv.com.br', 'zelador123', 'p0000000-0000-0000-0000-000000000002', NOW(), NOW());

INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manager', NOW(), NOW());

-- 6. Units, Resident Persons, Users, Memberships, and UnitRelationships
-- Bloco A - 101
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000001', '101', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000003', 'Carlos Eduardo Ramos', 'carlos.ramos@email.com', '(11) 98765-4321', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000003', 'carlos.ramos@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000003', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000001', 'un000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 'owner', NOW(), NOW(), NOW());

-- Bloco A - 102
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000002', '102', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000004', 'Mariana Costa Albuquerque', 'mariana.costa@email.com', '(11) 97654-3210', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000004', 'mariana.costa@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000004', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000002', 'un000000-0000-0000-0000-000000000002', 'p0000000-0000-0000-0000-000000000004', 'owner', NOW(), NOW(), NOW());

-- Bloco A - 201
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000003', '201', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000005', 'Rodrigo Azevedo Neves', 'rodrigo.neves@email.com', '(11) 96543-2109', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000005', 'rodrigo.neves@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000005', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000003', 'un000000-0000-0000-0000-000000000003', 'p0000000-0000-0000-0000-000000000005', 'owner', NOW(), NOW(), NOW());

-- Bloco A - 202
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000004', '202', 'apartment', 'vacant', 0.008, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000006', 'Simone Ribeiro Prado', 'simone.prado@email.com', '(11) 95432-1098', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000006', 'simone.prado@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000006', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000006', 'u0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000004', 'un000000-0000-0000-0000-000000000004', 'p0000000-0000-0000-0000-000000000006', 'owner', NOW(), NOW(), NOW());

-- Bloco A - 301 (penthouse)
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000005', '301', 'penthouse', 'occupied', 0.016, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000007', 'Thiago Mendes Ferreira', 'thiago.ferreira@email.com', '(11) 94321-0987', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000007', 'thiago.ferreira@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000007', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000007', 'u0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000005', 'un000000-0000-0000-0000-000000000005', 'p0000000-0000-0000-0000-000000000007', 'owner', NOW(), NOW(), NOW());

-- Bloco A - 302 (penthouse)
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000006', '302', 'penthouse', 'maintenance', 0.016, 'b0000000-0000-0000-0000-000000000001', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000008', 'Beatriz Santos Oliveira', 'beatriz.oliveira@email.com', '(11) 93210-9876', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000008', 'beatriz.oliveira@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000008', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000008', 'u0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000006', 'un000000-0000-0000-0000-000000000006', 'p0000000-0000-0000-0000-000000000008', 'owner', NOW(), NOW(), NOW());

-- Bloco B - 101
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000007', '101', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000002', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000009', 'Marcelo Dias Vieira', 'marcelo.vieira@email.com', '(11) 92109-8765', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000009', 'marcelo.vieira@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000009', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000009', 'u0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000007', 'un000000-0000-0000-0000-000000000007', 'p0000000-0000-0000-0000-000000000009', 'owner', NOW(), NOW(), NOW());

-- Bloco B - 102
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000008', '102', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000002', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000010', 'Fernanda Lima de Souza', 'fernanda.souza@email.com', '(11) 91098-7654', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000010', 'fernanda.souza@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000010', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000010', 'u0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000008', 'un000000-0000-0000-0000-000000000008', 'p0000000-0000-0000-0000-000000000010', 'owner', NOW(), NOW(), NOW());

-- Bloco B - 201
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000009', '201', 'apartment', 'occupied', 0.008, 'b0000000-0000-0000-0000-000000000002', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000011', 'Patrícia Gomes Peixoto', 'patricia.gomes@email.com', '(11) 90987-6543', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000011', 'patricia.gomes@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000011', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000011', 'u0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000009', 'un000000-0000-0000-0000-000000000009', 'p0000000-0000-0000-0000-000000000011', 'owner', NOW(), NOW(), NOW());

-- Bloco B - 202
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000010', '202', 'apartment', 'vacant', 0.008, 'b0000000-0000-0000-0000-000000000002', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000012', 'Ricardo Tavares Cruz', 'ricardo.cruz@email.com', '(11) 89876-5432', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000012', 'ricardo.cruz@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000012', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000012', 'u0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000010', 'un000000-0000-0000-0000-000000000010', 'p0000000-0000-0000-0000-000000000012', 'owner', NOW(), NOW(), NOW());

-- Bloco B - 301 (penthouse)
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000011', '301', 'penthouse', 'occupied', 0.016, 'b0000000-0000-0000-0000-000000000002', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000013', 'Gabriel de Alencar', 'gabriel.alencar@email.com', '(11) 88765-4321', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000013', 'gabriel.alencar@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000013', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000013', 'u0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000011', 'un000000-0000-0000-0000-000000000011', 'p0000000-0000-0000-0000-000000000013', 'owner', NOW(), NOW(), NOW());

-- Casas - Casa 01
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000012', 'Casa 01', 'house', 'occupied', 0.024, 'b0000000-0000-0000-0000-000000000003', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000014', 'André de Souza Arantes', 'andre.arantes@email.com', '(11) 87654-3210', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000014', 'andre.arantes@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000014', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000014', 'u0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000012', 'un000000-0000-0000-0000-000000000012', 'p0000000-0000-0000-0000-000000000014', 'owner', NOW(), NOW(), NOW());

-- Casas - Casa 02
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000013', 'Casa 02', 'house', 'occupied', 0.024, 'b0000000-0000-0000-0000-000000000003', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000015', 'Juliana Vasconcelos', 'juliana.vasc@email.com', '(11) 86543-2109', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000015', 'juliana.vasc@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000015', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000015', 'u0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000013', 'un000000-0000-0000-0000-000000000013', 'p0000000-0000-0000-0000-000000000015', 'owner', NOW(), NOW(), NOW());

-- Casas - Casa 03
INSERT INTO "Unit" ("id", "number", "type", "status", "fractionalShare", "buildingId", "createdAt", "updatedAt") VALUES
('un000000-0000-0000-0000-000000000014', 'Casa 03', 'house', 'occupied', 0.024, 'b0000000-0000-0000-0000-000000000003', NOW(), NOW());
INSERT INTO "Person" ("id", "name", "email", "phone", "createdAt", "updatedAt") VALUES
('p0000000-0000-0000-0000-000000000016', 'Luiz Felipe Nogueira', 'luiz.nogueira@email.com', '(11) 85432-1098', NOW(), NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "personId", "createdAt", "updatedAt") VALUES
('u0000000-0000-0000-0000-000000000016', 'luiz.nogueira@email.com', 'resident123', 'p0000000-0000-0000-0000-000000000016', NOW(), NOW());
INSERT INTO "Membership" ("id", "userId", "accountId", "condominiumId", "role", "createdAt", "updatedAt") VALUES
('m0000000-0000-0000-0000-000000000016', 'u0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'resident', NOW(), NOW());
INSERT INTO "UnitRelationship" ("id", "unitId", "personId", "role", "startDate", "createdAt", "updatedAt") VALUES
('ur000000-0000-0000-0000-000000000014', 'un000000-0000-0000-0000-000000000014', 'p0000000-0000-0000-0000-000000000016', 'owner', NOW(), NOW(), NOW());

-- 7. Billing Periods
INSERT INTO "BillingPeriod" ("id", "condominiumId", "monthString", "closed", "createdAt", "updatedAt") VALUES
('bp000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-04', true,  NOW(), NOW()),
('bp000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '2026-05', false, NOW(), NOW());

-- 8. Charges
-- April charges
INSERT INTO "Charge" ("id", "unitId", "billingPeriodId", "amount", "dueDate", "status", "paidAt", "barcode", "pixQrCode", "description", "penaltyFee", "interestFee", "createdAt", "updatedAt") VALUES
('ch000000-0000-0000-0000-000000000001', 'un000000-0000-0000-0000-000000000001', 'bp000000-0000-0000-0000-000000000001', 650.00,  '2026-04-10 00:00:00', 'paid',    '2026-04-09 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-04', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000002', 'un000000-0000-0000-0000-000000000002', 'bp000000-0000-0000-0000-000000000001', 650.00,  '2026-04-10 00:00:00', 'paid',    '2026-04-10 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-04', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000003', 'un000000-0000-0000-0000-000000000005', 'bp000000-0000-0000-0000-000000000001', 1450.00, '2026-04-10 00:00:00', 'paid',    '2026-04-08 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-04', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000004', 'un000000-0000-0000-0000-000000000012', 'bp000000-0000-0000-0000-000000000001', 850.00,  '2026-04-10 00:00:00', 'overdue', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-04', 17.00, 8.50, NOW(), NOW());

-- May charges
INSERT INTO "Charge" ("id", "unitId", "billingPeriodId", "amount", "dueDate", "status", "paidAt", "barcode", "pixQrCode", "description", "penaltyFee", "interestFee", "createdAt", "updatedAt") VALUES
('ch000000-0000-0000-0000-000000000005', 'un000000-0000-0000-0000-000000000001', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'paid',    '2026-05-10 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000006', 'un000000-0000-0000-0000-000000000002', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000007', 'un000000-0000-0000-0000-000000000003', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'paid',    '2026-05-08 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000008', 'un000000-0000-0000-0000-000000000005', 'bp000000-0000-0000-0000-000000000002', 1200.00, '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000009', 'un000000-0000-0000-0000-000000000006', 'bp000000-0000-0000-0000-000000000002', 1200.00, '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000010', 'un000000-0000-0000-0000-000000000007', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'paid',    '2026-05-09 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000011', 'un000000-0000-0000-0000-000000000008', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000012', 'un000000-0000-0000-0000-000000000009', 'bp000000-0000-0000-0000-000000000002', 650.00,  '2026-05-10 00:00:00', 'paid',    '2026-05-10 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000013', 'un000000-0000-0000-0000-000000000011', 'bp000000-0000-0000-0000-000000000002', 1200.00, '2026-05-10 00:00:00', 'paid',    '2026-05-09 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000014', 'un000000-0000-0000-0000-000000000012', 'bp000000-0000-0000-0000-000000000002', 850.00,  '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000015', 'un000000-0000-0000-0000-000000000013', 'bp000000-0000-0000-0000-000000000002', 850.00,  '2026-05-10 00:00:00', 'paid',    '2026-05-10 00:00:00', '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW()),
('ch000000-0000-0000-0000-000000000016', 'un000000-0000-0000-0000-000000000014', 'bp000000-0000-0000-0000-000000000002', 850.00,  '2026-05-10 00:00:00', 'pending', NULL,                  '34191.79001 01043.513184 91020.150008 7 97130000065000', '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br', 'Taxa Condominial Ordinária - 2026-05', NULL, NULL, NOW(), NOW());

-- 9. Charge Line Items
-- April: Bloco A 301 has an extra "Fundo de Reserva" line item
INSERT INTO "ChargeLineItem" ("id", "chargeId", "description", "amount", "createdAt") VALUES
('li000000-0000-0000-0000-000000000001', 'ch000000-0000-0000-0000-000000000003', 'Fundo de Reserva', 250.00, NOW()),
('li000000-0000-0000-0000-000000000002', 'ch000000-0000-0000-0000-000000000003', 'Taxa Ordinária',   1200.00, NOW());

-- Standard line items for all other charges
INSERT INTO "ChargeLineItem" ("id", "chargeId", "description", "amount", "createdAt") VALUES
('li000000-0000-0000-0000-000000000003', 'ch000000-0000-0000-0000-000000000001', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000004', 'ch000000-0000-0000-0000-000000000002', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000005', 'ch000000-0000-0000-0000-000000000004', 'Taxa Ordinária', 850.00,  NOW()),
('li000000-0000-0000-0000-000000000006', 'ch000000-0000-0000-0000-000000000005', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000007', 'ch000000-0000-0000-0000-000000000006', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000008', 'ch000000-0000-0000-0000-000000000007', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000009', 'ch000000-0000-0000-0000-000000000008', 'Taxa Ordinária', 1200.00, NOW()),
('li000000-0000-0000-0000-000000000010', 'ch000000-0000-0000-0000-000000000009', 'Taxa Ordinária', 1200.00, NOW()),
('li000000-0000-0000-0000-000000000011', 'ch000000-0000-0000-0000-000000000010', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000012', 'ch000000-0000-0000-0000-000000000011', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000013', 'ch000000-0000-0000-0000-000000000012', 'Taxa Ordinária', 650.00,  NOW()),
('li000000-0000-0000-0000-000000000014', 'ch000000-0000-0000-0000-000000000013', 'Taxa Ordinária', 1200.00, NOW()),
('li000000-0000-0000-0000-000000000015', 'ch000000-0000-0000-0000-000000000014', 'Taxa Ordinária', 850.00,  NOW()),
('li000000-0000-0000-0000-000000000016', 'ch000000-0000-0000-0000-000000000015', 'Taxa Ordinária', 850.00,  NOW()),
('li000000-0000-0000-0000-000000000017', 'ch000000-0000-0000-0000-000000000016', 'Taxa Ordinária', 850.00,  NOW());

-- 10. Equipment
INSERT INTO "Equipment" ("id", "condominiumId", "name", "location", "category", "status", "lastInspection", "nextInspection", "installDate", "createdAt", "updatedAt") VALUES
('eq000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Bomba Centrífuga Principal',                  'Casa de Bombas - Subsolo',       'Hidráulica',          'alert',       '2026-05-10 00:00:00', '2026-06-10 00:00:00', '2020-05-15 00:00:00', NOW(), NOW()),
('eq000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Quadro Elétrico Geral',                       'Sala Elétrica - Térreo',         'Elétrica / Cabine',   'critical',    '2026-05-10 00:00:00', '2026-06-10 00:00:00', '2020-05-15 00:00:00', NOW(), NOW()),
('eq000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Gerador Principal de Emergência (350kVA)',    'Subsolo 1 - Área Técnica',       'Alternadores',        'maintenance', '2026-05-10 00:00:00', '2026-06-10 00:00:00', '2020-05-15 00:00:00', NOW(), NOW()),
('eq000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Portão Eletrônico Guarita',                   'Entrada Veículos Principal',     'Mecânica',            'operational', '2026-05-10 00:00:00', '2026-06-10 00:00:00', '2020-05-15 00:00:00', NOW(), NOW());

-- 11. Maintenance Plans
INSERT INTO "MaintenancePlan" ("id", "condominiumId", "equipmentId", "title", "description", "frequency", "nextOccurrence", "status", "createdAt", "updatedAt") VALUES
('mp000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'eq000000-0000-0000-0000-000000000002', 'Manutenção Preditiva Termográfica Quadros Elétricos', 'Termometria infravermelha nos contatos.', 'semestral', '2026-08-10 00:00:00', 'active', NOW(), NOW()),
('mp000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', NULL,                                   'Limpeza Semestral de Reservatórios d''Água',          'Lavação sob pressão.',                   'semestral', '2026-08-10 00:00:00', 'active', NOW(), NOW());

-- 12. Maintenance Tickets
INSERT INTO "MaintenanceTicket" ("id", "condominiumId", "unitId", "title", "description", "category", "priority", "status", "estimatedCost", "reportedAt", "createdAt", "updatedAt") VALUES
('tk000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', NULL,                                   'Limpeza da caixa d''água',          'Higienização semestral obrigatória.',    'plumbing',    'medium', 'reported',     800.00,  NOW(), NOW(), NOW()),
('tk000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'un000000-0000-0000-0000-000000000006', 'Infiltração na Suíte Principal',    'Vazamento vindo do teto.',               'plumbing',    'high',   'in_progress',  1200.00, NOW(), NOW(), NOW()),
('tk000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', NULL,                                   'Troca da Bomba Principal da Piscina','A bomba do filtro leste parou de funcionar.', 'common_area', 'urgent', 'reported', 2850.00, NOW(), NOW(), NOW());

-- 13. Ticket Comments
INSERT INTO "TicketComment" ("id", "ticketId", "authorName", "comment", "createdAt") VALUES
('tc000000-0000-0000-0000-000000000001', 'tk000000-0000-0000-0000-000000000001', 'Sistema GCV', 'Chamado registrado no banco de dados.', NOW()),
('tc000000-0000-0000-0000-000000000002', 'tk000000-0000-0000-0000-000000000002', 'Sistema GCV', 'Chamado registrado no banco de dados.', NOW()),
('tc000000-0000-0000-0000-000000000003', 'tk000000-0000-0000-0000-000000000003', 'Sistema GCV', 'Chamado registrado no banco de dados.', NOW());

-- 14. Documents
INSERT INTO "Document" ("id", "condominiumId", "unitId", "title", "category", "requiredRole", "filePath", "createdAt", "updatedAt") VALUES
('do000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', NULL, 'Regulamento Interno GCV',                    'regulation', 'resident', 'uploads/regulamento.pdf', NOW(), NOW()),
('do000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', NULL, 'Ata da Assembleia Trimestral - Maio 2026',   'minutes',    'resident', 'uploads/ata_maio.pdf',    NOW(), NOW());

-- 15. Document Versions
INSERT INTO "DocumentVersion" ("id", "documentId", "versionNumber", "filePath", "uploadedBy", "createdAt") VALUES
('dv000000-0000-0000-0000-000000000001', 'do000000-0000-0000-0000-000000000001', 1, 'uploads/regulamento.pdf', 'sindico@gcv.com.br', NOW()),
('dv000000-0000-0000-0000-000000000002', 'do000000-0000-0000-0000-000000000002', 1, 'uploads/ata_maio.pdf',    'sindico@gcv.com.br', NOW());

-- 16. Audit Events
INSERT INTO "AuditEvent" ("id", "accountId", "userId", "userEmail", "action", "entity", "entityId", "details", "createdAt") VALUES
('ae000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'sindico@gcv.com.br', 'auth_login', 'User', 'u0000000-0000-0000-0000-000000000001', 'Síndico realizou o bootstrap do sistema.', NOW());
