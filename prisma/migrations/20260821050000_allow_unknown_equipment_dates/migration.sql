-- Unknown dates must remain unknown instead of being replaced with fabricated
-- current dates during equipment registration.
ALTER TABLE "Equipment"
  ALTER COLUMN "lastInspection" DROP NOT NULL,
  ALTER COLUMN "nextInspection" DROP NOT NULL,
  ALTER COLUMN "installDate" DROP NOT NULL;
