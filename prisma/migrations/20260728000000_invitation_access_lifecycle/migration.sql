-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'sent', 'accepted', 'expired', 'cancelled', 'revoked');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSystemAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Membership"
  ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "activatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT;

UPDATE "Membership"
SET "activatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "status" = 'active' AND "activatedAt" IS NULL;

-- Refuse to install case-insensitive uniqueness while ambiguous identities exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User" GROUP BY lower("email") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce normalized User email uniqueness: duplicates exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Person" GROUP BY lower("email") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce normalized Person email uniqueness: duplicates exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_email_normalized_key" ON "User" (lower("email"));
CREATE UNIQUE INDEX "Person_email_normalized_key" ON "Person" (lower("email"));

-- CreateTable
CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "condominiumId" TEXT NOT NULL,
  "unitId" TEXT,
  "emailNormalized" TEXT NOT NULL,
  "invitedName" TEXT NOT NULL,
  "invitedPhone" TEXT,
  "role" "PlatformRole" NOT NULL,
  "relationshipRole" "RelationshipRole",
  "tokenHash" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "membershipId" TEXT,
  "unitRelationshipId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_condominiumId_status_createdAt_idx" ON "Invitation"("condominiumId", "status", "createdAt");
CREATE INDEX "Invitation_emailNormalized_status_idx" ON "Invitation"("emailNormalized", "status");
CREATE INDEX "Invitation_expiresAt_status_idx" ON "Invitation"("expiresAt", "status");
CREATE INDEX "Invitation_membershipId_idx" ON "Invitation"("membershipId");
CREATE INDEX "Invitation_unitRelationshipId_idx" ON "Invitation"("unitRelationshipId");
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");
CREATE INDEX "Membership_condominiumId_status_idx" ON "Membership"("condominiumId", "status");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_condominiumId_fkey"
  FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey"
  FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_unitRelationshipId_fkey"
  FOREIGN KEY ("unitRelationshipId") REFERENCES "UnitRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
