DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Building" GROUP BY "condominiumId", "name" HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate Building condominiumId/name values must be reconciled before migration';

  ELSIF EXISTS (
    SELECT 1 FROM "Unit" GROUP BY "buildingId", "number" HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate Unit buildingId/number values must be reconciled before migration';

  ELSIF EXISTS (
    SELECT 1 FROM "BillingPeriod" GROUP BY "condominiumId", "monthString" HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate BillingPeriod condominiumId/monthString values must be reconciled before migration';

  ELSIF EXISTS (
    SELECT 1 FROM "Charge" GROUP BY "billingPeriodId", "unitId" HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate Charge billingPeriodId/unitId values must be reconciled before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Building_condominiumId_name_key" ON "Building"("condominiumId", "name");
CREATE UNIQUE INDEX "Unit_buildingId_number_key" ON "Unit"("buildingId", "number");
CREATE UNIQUE INDEX "BillingPeriod_condominiumId_monthString_key" ON "BillingPeriod"("condominiumId", "monthString");
CREATE UNIQUE INDEX "Charge_billingPeriodId_unitId_key" ON "Charge"("billingPeriodId", "unitId");
