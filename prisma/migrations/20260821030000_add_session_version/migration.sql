-- Incrementing this value invalidates every previously issued signed session.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
