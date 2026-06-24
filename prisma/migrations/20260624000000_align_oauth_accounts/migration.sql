-- Align persisted auth schema with the current Prisma model.

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "OauthAccount" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "provider"       TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OauthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OauthAccount_provider_providerUserId_key"
    ON "OauthAccount"("provider", "providerUserId");

ALTER TABLE "OauthAccount"
    ADD CONSTRAINT "OauthAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
