import assert from 'assert';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MembershipStatus,
  PlatformRole,
  PrismaClient,
  RelationshipRole,
  UnitStatus,
  UnitType,
} from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function runTests() {
  console.log("Running Auth & Tenant Isolation tests...");
  let foreignAccountId: string | null = null;
  let foreignCondoId: string | null = null;
  let foreignAdminUserId: string | null = null;
  let foreignAdminPersonId: string | null = null;
  let testResidentUserId: string | null = null;
  let testResidentPersonId: string | null = null;
  let testResidentUnitId: string | null = null;
  let testResidentBuildingId: string | null = null;
  let testResidentEmail: string | null = null;
  let restrictedTicketId: string | null = null;

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

    const syndicCreateCondoRes = await fetch(`${BASE_URL}/condominiums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Condomínio indevido',
        address: 'Rua sem autorização, 1',
        accountId: condos[0].accountId,
      }),
    });
    assert.strictEqual(
      syndicCreateCondoRes.status,
      403,
      'Syndic must not create condominiums through the platform-only endpoint'
    );

    const privilegedInvitationRes = await fetch(`${BASE_URL}/condominiums/${condoId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        email: `unauthorized-syndic-${Date.now()}@example.com`,
        name: 'Unauthorized Syndic',
        role: PlatformRole.syndic,
      }),
    });
    assert.strictEqual(
      privilegedInvitationRes.status,
      400,
      'Tenant invitation endpoint must accept resident invitations only'
    );

    const managerLogin = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'zelador@gcv.com.br' }),
    });
    assert.strictEqual(managerLogin.status, 200);
    const managerCookie = managerLogin.headers.get('set-cookie')!;
    const managerResidentInvite = await fetch(`${BASE_URL}/condominiums/${condoId}/residents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerCookie },
      body: JSON.stringify({
        name: 'Convite não autorizado',
        email: `manager-invite-${Date.now()}@example.com`,
        phone: '11999999999',
        unitId: '00000000-0000-0000-0000-000000000000',
        role: RelationshipRole.tenant,
      }),
    });
    assert.strictEqual(managerResidentInvite.status, 403, 'Manager must not onboard residents');
    console.log('✔ Condominium and resident onboarding privileges are separated');

    const foreignAdminEmail = `foreign-admin-${Date.now()}@example.com`;
    const foreignAdminPerson = await prisma.person.create({
      data: { name: 'Foreign Admin', email: foreignAdminEmail, phone: '000000000' },
    });
    foreignAdminPersonId = foreignAdminPerson.id;
    const foreignAdmin = await prisma.user.create({
      data: {
        email: foreignAdminEmail,
        personId: foreignAdminPerson.id,
        memberships: {
          create: {
            accountId: foreignAccount.id,
            condominiumId: null,
            role: PlatformRole.admin,
          },
        },
      },
    });
    foreignAdminUserId = foreignAdmin.id;
    const foreignAdminLogin = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: foreignAdminEmail }),
    });
    assert.strictEqual(foreignAdminLogin.status, 200, 'Foreign admin mock login should succeed');
    const foreignAdminCookie = foreignAdminLogin.headers.get('set-cookie')!;

    const foreignAdminCondosRes = await fetch(`${BASE_URL}/condominiums`, {
      headers: { Cookie: foreignAdminCookie },
    });
    const foreignAdminCondos = (await foreignAdminCondosRes.json()) as any[];
    assert.ok(foreignAdminCondos.some((condo) => condo.id === foreignCondoId));
    assert.ok(!foreignAdminCondos.some((condo) => condo.id === condoId), 'Admin list must remain account-scoped');

    const foreignAdminCrossTenantRes = await fetch(`${BASE_URL}/condominiums/${condoId}/residents`, {
      headers: { Cookie: foreignAdminCookie },
    });
    assert.strictEqual(foreignAdminCrossTenantRes.status, 403, 'Admin role from another account must not bypass tenant scope');
    console.log('✔ Admin privileges remain scoped to their own account');

    // 4. Test tenantGuard - access a dummy condominium ID (not in memberships)
    const dummyCondoId = '00000000-0000-0000-0000-000000000000';
    console.log(`Testing tenantGuard: accessing dummy condo ${dummyCondoId} as syndic...`);
    const guardRes = await fetch(`${BASE_URL}/condominiums/${dummyCondoId}/units`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(guardRes.status, 404, "Should return 404 for nonexistent condominium context");
    console.log("✔ Dummy nonexistent condominium access blocked successfully (404)");

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

    const ownRelationships = await prisma.unitRelationship.findMany({
      where: {
        endDate: null,
        person: { user: { email: 'carlos.ramos@email.com' } },
        unit: { building: { condominiumId: condoId } },
      },
      select: { unitId: true, personId: true },
    });
    assert.ok(ownRelationships.length > 0, 'Seed resident should have at least one unit relationship');

    const residentsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/residents`, {
      headers: { Cookie: resCookie },
    });
    assert.strictEqual(residentsRes.status, 200);
    const visibleRelationships = (await residentsRes.json()) as any[];
    assert.ok(visibleRelationships.length > 0);
    assert.ok(
      visibleRelationships.every((relationship) => relationship.person.email === 'carlos.ramos@email.com'),
      'Resident must only receive their own PII and relationships'
    );

    const residentUnitsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/units`, {
      headers: { Cookie: resCookie },
    });
    assert.strictEqual(residentUnitsRes.status, 200);
    const residentUnits = (await residentUnitsRes.json()) as any[];
    const ownUnitIds = new Set(ownRelationships.map((relationship) => relationship.unitId));
    assert.ok(residentUnits.length > 0, 'Resident should receive their active units');
    assert.ok(
      residentUnits.every((unit) => ownUnitIds.has(unit.id)),
      'Resident units endpoint must not return units belonging to other residents'
    );
    assert.ok(
      residentUnits.every((unit) =>
        unit.relationships.length > 0 &&
        unit.relationships.every((relationship: any) =>
          relationship.person.email === 'carlos.ramos@email.com'
        )
      ),
      'Resident units endpoint must not expose another resident PII'
    );

    const otherUnit = await prisma.unit.findFirst({
      where: {
        building: { condominiumId: condoId },
        id: { notIn: ownRelationships.map((relationship) => relationship.unitId) },
      },
    });
    assert.ok(otherUnit, 'Seed should contain another unit for ticket visibility test');
    const restrictedTicket = await prisma.maintenanceTicket.create({
      data: {
        condominiumId: condoId,
        unitId: otherUnit!.id,
        title: `Restricted ticket ${Date.now()}`,
        description: 'Must not be visible or commentable by another resident.',
        category: MaintenanceCategory.other,
        priority: MaintenancePriority.low,
        status: MaintenanceStatus.reported,
      },
    });
    restrictedTicketId = restrictedTicket.id;
    const restrictedCommentRes = await fetch(
      `${BASE_URL}/condominiums/${condoId}/tickets/${restrictedTicket.id}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resCookie },
        body: JSON.stringify({ comment: 'Cross-unit comment must fail.' }),
      }
    );
    assert.strictEqual(restrictedCommentRes.status, 403, 'Resident must not comment on another unit ticket');
    console.log('✔ Resident PII and ticket comments follow unit visibility');

    const testBuilding = await prisma.building.create({
      data: { name: `Resident Idempotency ${Date.now()}`, condominiumId: condoId },
    });
    testResidentBuildingId = testBuilding.id;
    const testUnit = await prisma.unit.create({
      data: {
        number: `RES-${Date.now()}`,
        type: UnitType.apartment,
        status: UnitStatus.occupied,
        fractionalShare: 0.001,
        buildingId: testBuilding.id,
      },
    });
    testResidentUnitId = testUnit.id;
    testResidentEmail = `resident-idempotency-${Date.now()}@example.com`;
    const residentPayload = {
      name: 'Resident Idempotency',
      email: testResidentEmail,
      phone: '11999999999',
      unitId: testUnit.id,
      role: RelationshipRole.owner,
    };
    const createResidentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/residents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(residentPayload),
    });
    assert.strictEqual(createResidentRes.status, 202, 'Resident invitation should be accepted for delivery');
    const testResident = await prisma.user.findUnique({
      where: { email: testResidentEmail },
      include: { person: { include: { relationships: true } }, memberships: true },
    });
    assert.ok(testResident?.person);
    testResidentUserId = testResident!.id;
    testResidentPersonId = testResident!.person!.id;
    assert.strictEqual(testResident!.passwordHash, null, 'Invited resident must not receive a shared password');
    assert.strictEqual(testResident!.person!.relationships.length, 0, 'Pending invitation must not grant unit access');
    assert.strictEqual(testResident!.memberships.length, 1, 'Invitation must create a single pending membership');
    assert.strictEqual(testResident!.memberships[0].status, MembershipStatus.pending);
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: testResident!.memberships[0].id },
        data: { status: MembershipStatus.active, activatedAt: new Date() },
      }),
      prisma.unitRelationship.create({
        data: {
          personId: testResidentPersonId,
          unitId: testUnit.id,
          role: RelationshipRole.owner,
        },
      }),
    ]);
    console.log('✔ Resident invitation is transactional, pending, and passwordless');

    const sharedIdentityPatchRes = await fetch(
      `${BASE_URL}/condominiums/${condoId}/units/${testUnit.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          status: UnitStatus.vacant,
          ownerName: 'Mutated Shared Identity',
        }),
      }
    );
    assert.strictEqual(
      sharedIdentityPatchRes.status,
      409,
      'Unit editing must reject mutation of an identity linked to an application user'
    );
    const unchangedUnit = await prisma.unit.findUnique({ where: { id: testUnit.id } });
    const unchangedPerson = await prisma.person.findUnique({ where: { id: testResidentPersonId } });
    assert.strictEqual(unchangedUnit?.status, UnitStatus.occupied, 'Rejected owner update must roll back unit changes');
    assert.strictEqual(unchangedPerson?.name, residentPayload.name, 'Rejected owner update must preserve global identity');

    await prisma.membership.create({
      data: {
        userId: testResidentUserId,
        accountId: foreignAccount.id,
        condominiumId: foreignCondo.id,
        role: PlatformRole.admin,
      },
    });
    const dualRoleLogin = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testResidentEmail }),
    });
    assert.strictEqual(dualRoleLogin.status, 200);
    const dualRoleCookie = dualRoleLogin.headers.get('set-cookie')!;

    const dualRoleUnitsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/units`, {
      headers: { Cookie: dualRoleCookie },
    });
    assert.strictEqual(dualRoleUnitsRes.status, 200);
    const dualRoleUnits = (await dualRoleUnitsRes.json()) as any[];
    assert.deepStrictEqual(
      dualRoleUnits.map((unit) => unit.id),
      [testUnit.id],
      'Admin role in another tenant must not grant management visibility in this condominium'
    );
    assert.ok(
      dualRoleUnits[0].relationships.every(
        (relationship: any) => relationship.person.email === testResidentEmail
      ),
      'Cross-tenant role must not expose other residents PII'
    );

    const procurementRes = await fetch(`${BASE_URL}/condominiums/${condoId}/purchase-requests`, {
      headers: { Cookie: dualRoleCookie },
    });
    assert.strictEqual(procurementRes.status, 403, 'Procurement listing must be staff-only in the current tenant');

    const scopedChargesRes = await fetch(`${BASE_URL}/condominiums/${condoId}/charges`, {
      headers: { Cookie: dualRoleCookie },
    });
    assert.strictEqual(scopedChargesRes.status, 200);
    const scopedCharges = (await scopedChargesRes.json()) as any[];
    assert.ok(
      scopedCharges.every((charge) => charge.unitId === testUnit.id),
      'Foreign admin role must not expose condominium-wide charges'
    );

    const scopedDocumentsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
      headers: { Cookie: dualRoleCookie },
    });
    assert.strictEqual(scopedDocumentsRes.status, 200);
    const scopedDocuments = (await scopedDocumentsRes.json()) as any[];
    assert.ok(
      scopedDocuments.every((document) =>
        document.requiredRole === PlatformRole.resident &&
        (document.unitId === null || document.unitId === testUnit.id)
      ),
      'Foreign admin role must not expose staff or other-unit documents'
    );

    await prisma.unitRelationship.updateMany({
      where: { personId: testResidentPersonId, unitId: testUnit.id, endDate: null },
      data: { endDate: new Date() },
    });
    const endedRelationshipUnitsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/units`, {
      headers: { Cookie: dualRoleCookie },
    });
    assert.strictEqual(endedRelationshipUnitsRes.status, 200);
    assert.deepStrictEqual(
      await endedRelationshipUnitsRes.json(),
      [],
      'Ended unit relationships must immediately revoke unit visibility'
    );

    const endedRelationshipTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: dualRoleCookie },
      body: JSON.stringify({
        title: 'Ended relationship ticket',
        description: 'This request must be denied.',
        category: MaintenanceCategory.other,
        priority: MaintenancePriority.low,
        unitId: testUnit.id,
      }),
    });
    assert.strictEqual(
      endedRelationshipTicketRes.status,
      403,
      'Ended unit relationships must not authorize maintenance requests'
    );
    console.log('✔ Scoped roles, active relationships, procurement ACL, and identity updates are isolated');

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
    if (testResidentEmail && (!testResidentUserId || !testResidentPersonId)) {
      const partialUser = await prisma.user.findFirst({
        where: { email: { equals: testResidentEmail, mode: 'insensitive' } },
      });
      const partialPerson = await prisma.person.findFirst({
        where: { email: { equals: testResidentEmail, mode: 'insensitive' } },
      });
      testResidentUserId = testResidentUserId ?? partialUser?.id ?? null;
      testResidentPersonId = testResidentPersonId ?? partialPerson?.id ?? null;
    }
    if (restrictedTicketId) {
      await prisma.maintenanceTicket.deleteMany({ where: { id: restrictedTicketId } });
    }
    if (testResidentPersonId) {
      await prisma.unitRelationship.deleteMany({ where: { personId: testResidentPersonId } });
    }
    if (testResidentEmail) {
      await prisma.invitation.deleteMany({ where: { emailNormalized: testResidentEmail } });
    }
    if (testResidentUserId) {
      await prisma.membership.deleteMany({ where: { userId: testResidentUserId } });
      await prisma.user.deleteMany({ where: { id: testResidentUserId } });
    }
    if (testResidentPersonId) {
      await prisma.person.deleteMany({ where: { id: testResidentPersonId } });
    }
    if (testResidentUnitId) {
      await prisma.unit.deleteMany({ where: { id: testResidentUnitId } });
    }
    if (testResidentBuildingId) {
      await prisma.building.deleteMany({ where: { id: testResidentBuildingId } });
    }
    if (foreignAdminUserId) {
      await prisma.auditEvent.deleteMany({ where: { userId: foreignAdminUserId } });
      await prisma.membership.deleteMany({ where: { userId: foreignAdminUserId } });
      await prisma.user.deleteMany({ where: { id: foreignAdminUserId } });
    }
    if (foreignAdminPersonId) {
      await prisma.person.deleteMany({ where: { id: foreignAdminPersonId } });
    }

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
