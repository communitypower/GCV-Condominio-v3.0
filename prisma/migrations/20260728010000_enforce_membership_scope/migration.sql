DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "condominiumId" IS NULL
    GROUP BY "userId", "accountId", "role"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce account membership uniqueness: duplicates exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "UnitRelationship"
    WHERE "endDate" IS NULL
    GROUP BY "unitId", "personId", "role"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce active unit relationship uniqueness: duplicates exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "Membership_account_scope_key"
  ON "Membership" ("userId", "accountId", "role")
  WHERE "condominiumId" IS NULL;

CREATE UNIQUE INDEX "UnitRelationship_active_key"
  ON "UnitRelationship" ("unitId", "personId", "role")
  WHERE "endDate" IS NULL;

CREATE FUNCTION "validate_membership_tenant_scope"() RETURNS trigger AS $$
BEGIN
  IF NEW."condominiumId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Condominium"
    WHERE "id" = NEW."condominiumId" AND "accountId" = NEW."accountId"
  ) THEN
    RAISE EXCEPTION 'Membership condominium does not belong to account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Membership_tenant_scope_check"
BEFORE INSERT OR UPDATE OF "accountId", "condominiumId" ON "Membership"
FOR EACH ROW EXECUTE FUNCTION "validate_membership_tenant_scope"();
