import assert from 'assert';
import { PrismaClient, UnitStatus, UnitType } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function runTests() {
  console.log("Running Auth & Tenant Isolation tests...");
  let foreignAccountId: string | null = null;
  let foreignCondoId: string | null = null;

  try {
    const foreignAccount = await prisma.account.create({
      data: { name: `Foreign Tenant Test ${Date.now()}` },
    });
    foreignAccountId = foreignAccount.id;

    const foreignCondo = await prisma.condominium.create({
      data: {
        name: `Foreign Condo Test ${Date.now()}`,
        address: "Rua Teste Cross Tenant, 123",
        accountId: foreignAccount.id,
      },
    });
    foreignCondoId = foreignCondo.id;

    const foreignBuilding = await prisma.building.create({
      data: {
        name: "Foreign Block",
        condominiumId: foreignCondo.id,
      },
    });

    await prisma.unit.create({
      data: {
        number: "999",
        type: UnitType.apartment,
        status: UnitStatus.occupied,
        fractionalShare: 0.01,
        buildingId: foreignBuilding.id,
      },
    });

    // 1. Verify unauthenticated access fails
    console.log("Testing unauthenticated access to /condominiums...");
    const unauthRes = await fetch(`${BASE_URL}/condominiums`);
    assert.strictEqual(unauthRes.status, 401, "Should return 401 for unauthenticated requests");
    console.log("✔ Unauthenticated access rejected successfully (401)");

    // 2. Perform Mock Login for syndic
    console.log("Logging in as syndic (sindico@gcv.com.br)...");
    const loginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sindico@gcv.com.br' }),
    });
    assert.strictEqual(loginRes.status, 200, "Mock login should succeed");
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie, "Should return session cookie");
    console.log("✔ Syndic logged in successfully");

    // 3. Fetch condominiums with syndic session
    console.log("Fetching condominiums as syndic...");
    const condosRes = await fetch(`${BASE_URL}/condominiums`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(condosRes.status, 200, "Should allow fetching condominiums");
    const condos = (await condosRes.json()) as any[];
    assert.ok(condos.length > 0, "Should return at least one condominium");
    const condoId = condos[0].id;
    assert.ok(!condos.some((condo) => condo.id === foreignCondoId), "Condominium list must not include another tenant");
    console.log(`✔ Scoped access allowed. Found condominium: ${condos[0].name} (${condoId})`);

    // 4. Test tenantGuard - access a dummy condominium ID (not in memberships)
    const dummyCondoId = '00000000-0000-0000-0000-000000000000';
    console.log(`Testing tenantGuard: accessing dummy condo ${dummyCondoId} as syndic...`);
    const guardRes = await fetch(`${BASE_URL}/condominiums/${dummyCondoId}/units`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(guardRes.status, 403, "Should return 403 for unauthorized condominium context");
    console.log("✔ Dummy cross-tenant access blocked successfully (403)");

    console.log("Testing tenantGuard: accessing real foreign tenant condo as syndic...");
    const foreignUnitsRes = await fetch(`${BASE_URL}/condominiums/${foreignCondoId}/units`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(foreignUnitsRes.status, 403, "Should return 403 for real foreign condominium context");
    console.log("✔ Real cross-tenant condominium access blocked successfully (403)");

    console.log("Testing tenantGuard: accessing real foreign tenant audit log as syndic...");
    const foreignAuditRes = await fetch(`${BASE_URL}/accounts/${foreignAccountId}/audit`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(foreignAuditRes.status, 403, "Should return 403 for real foreign account context");
    console.log("✔ Real cross-tenant account access blocked successfully (403)");

    // 5. Test resident login and role restriction
    console.log("Logging in as resident (carlos.ramos@email.com)...");
    const resLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'carlos.ramos@email.com' }),
    });
    const resCookie = resLoginRes.headers.get('set-cookie')!;

    // Test role restriction: Resident trying to create a building block
    console.log("Testing role restriction: resident trying to create a building block...");
    const createBuildingRes = await fetch(`${BASE_URL}/condominiums/${condoId}/buildings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: resCookie,
      },
      body: JSON.stringify({ name: 'Bloco C' }),
    });
    assert.strictEqual(createBuildingRes.status, 403, "Should return 403 for insufficient privileges");
    console.log("✔ Role restriction enforced successfully (403)");

    console.log("Testing building validation as syndic...");
    const invalidBuildingRes = await fetch(`${BASE_URL}/condominiums/${condoId}/buildings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ name: '' }),
    });
    assert.strictEqual(invalidBuildingRes.status, 400, "Should reject invalid building payload");
    console.log("✔ Invalid building payload rejected successfully (400)");

    console.log("Testing unit validation as syndic...");
    const invalidUnitRes = await fetch(`${BASE_URL}/condominiums/${condoId}/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        number: '',
        type: 'not_a_type',
        status: 'not_a_status',
        fractionalShare: -1,
        buildingId: 'not-a-uuid',
      }),
    });
    assert.strictEqual(invalidUnitRes.status, 400, "Should reject invalid unit payload");
    console.log("✔ Invalid unit payload rejected successfully (400)");

    console.log("Testing resident validation as syndic...");
    const invalidResidentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/residents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: '',
        email: 'not-email',
        phone: '',
        unitId: 'not-a-uuid',
        role: 'not_a_role',
      }),
    });
    assert.strictEqual(invalidResidentRes.status, 400, "Should reject invalid resident payload");
    console.log("✔ Invalid resident payload rejected successfully (400)");

    console.log("Testing role restriction: resident trying to read account audit logs...");
    const accountId = condos[0].accountId;
    const residentAuditRes = await fetch(`${BASE_URL}/accounts/${accountId}/audit`, {
      headers: { Cookie: resCookie },
    });
    assert.strictEqual(residentAuditRes.status, 403, "Should return 403 for resident audit access");
    console.log("✔ Resident audit access blocked successfully (403)");

    console.log("Testing audit validation as syndic...");
    const invalidAuditRes = await fetch(`${BASE_URL}/accounts/${accountId}/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        title: '',
        content: '',
        type: 'not_a_type',
      }),
    });
    assert.strictEqual(invalidAuditRes.status, 400, "Should reject invalid audit payload");
    console.log("✔ Invalid audit payload rejected successfully (400)");

    console.log("All tests passed successfully!");
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { details: 'Login mock realizado em ambiente local/teste.' },
    });

    if (foreignCondoId) {
      await prisma.unit.deleteMany({ where: { building: { condominiumId: foreignCondoId } } });
      await prisma.building.deleteMany({ where: { condominiumId: foreignCondoId } });
      await prisma.condominium.deleteMany({ where: { id: foreignCondoId } });
    }

    if (foreignAccountId) {
      await prisma.auditEvent.deleteMany({ where: { accountId: foreignAccountId } });
      await prisma.account.deleteMany({ where: { id: foreignAccountId } });
    }

    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
