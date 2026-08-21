import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3201/api/v1';
const ORIGIN = new URL(BASE_URL).origin;
const marker = `TEST_ROLE_FLOW_${Date.now()}`;
const accountName = `${marker} Account`;
const syndicEmail = `test_role_syndic_${Date.now()}@example.com`;
const residentEmail = `test_role_resident_${Date.now()}@example.com`;
const createdEmails = [syndicEmail, residentEmail];

type JsonResponse = { status: number; payload: any; cookie?: string };

async function request(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown } = {}
): Promise<JsonResponse> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Origin: ORIGIN,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return {
    status: response.status,
    payload: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

function expectStatus(response: JsonResponse, expected: number, operation: string) {
  assert.equal(response.status, expected, `${operation}: HTTP ${response.status} ${JSON.stringify(response.payload)}`);
}

function tokenFromDelivery(delivery: { acceptanceUrl: string }) {
  const token = new URL(delivery.acceptanceUrl).pathname.split('/').at(-1);
  assert.ok(token, 'Invitation delivery must contain a token.');
  return decodeURIComponent(token);
}

async function cleanup() {
  const account = await prisma.account.findFirst({ where: { name: accountName }, select: { id: true } });
  if (account) await prisma.account.delete({ where: { id: account.id } });
  const users = await prisma.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true, personId: true },
  });
  const userIds = users.map((user) => user.id);
  const personIds = users.flatMap((user) => user.personId ? [user.personId] : []);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.person.deleteMany({ where: { id: { in: personIds }, user: null, relationships: { none: {} } } });
}

async function run() {
  await cleanup();

  const administratorLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'vitorlcastro92@gmail.com', password: 'platform-admin-local-123' },
  });
  expectStatus(administratorLogin, 200, 'Platform administrator login');
  assert.equal(administratorLogin.payload.user.isSystemAdmin, true);
  assert.ok(administratorLogin.cookie);

  const onboarding = await request('/onboarding/system/condominiums', {
    method: 'POST',
    cookie: administratorLogin.cookie,
    body: {
      accountName,
      condominiumName: `${marker} Condominium`,
      condominiumAddress: 'Rua do Fluxo, 100',
      syndicName: `${marker} Syndic`,
      syndicEmail,
      syndicPhone: '11999990001',
    },
  });
  expectStatus(onboarding, 201, 'Administrator condominium onboarding');
  const condominiumId = onboarding.payload.condominium.id as string;
  const accountId = onboarding.payload.account.id as string;
  assert.equal(onboarding.payload.invitation.role, 'syndic');
  assert.equal(onboarding.payload.invitation.status, 'sent');

  const administratorCondominiums = await request('/condominiums', { cookie: administratorLogin.cookie });
  expectStatus(administratorCondominiums, 200, 'Administrator condominium visibility');
  const administratorSeesNewCondominium = administratorCondominiums.payload.some(
    (condominium: { id: string }) => condominium.id === condominiumId
  );
  const administratorOperationalAccess = await request(`/condominiums/${condominiumId}/buildings`, {
    cookie: administratorLogin.cookie,
  });
  assert.equal(administratorSeesNewCondominium, true);
  expectStatus(administratorOperationalAccess, 200, 'Platform administrator global tenant access');
  assert.deepEqual(administratorLogin.payload.user.memberships, []);

  const syndicToken = tokenFromDelivery(onboarding.payload.delivery);
  const syndicAcceptance = await request(`/onboarding/invitations/${syndicToken}/accept`, {
    method: 'POST',
    body: { password: 'syndic-test-password', name: `${marker} Syndic`, phone: '11999990001' },
  });
  expectStatus(syndicAcceptance, 200, 'Syndic invitation acceptance');
  assert.equal(syndicAcceptance.payload.status, 'accepted');

  const syndicLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: syndicEmail, password: 'syndic-test-password' },
  });
  expectStatus(syndicLogin, 200, 'Syndic login');
  assert.ok(syndicLogin.cookie);
  assert.equal(syndicLogin.payload.user.memberships[0].role, 'syndic');
  assert.equal(syndicLogin.payload.user.memberships[0].status, 'active');

  const building = await request(`/condominiums/${condominiumId}/buildings`, {
    method: 'POST',
    cookie: syndicLogin.cookie,
    body: { name: `${marker} Block A` },
  });
  expectStatus(building, 201, 'Syndic building creation');
  const unit = await request(`/condominiums/${condominiumId}/units`, {
    method: 'POST',
    cookie: syndicLogin.cookie,
    body: {
      number: '101',
      type: 'apartment',
      status: 'occupied',
      fractionalShare: 0.01,
      buildingId: building.payload.id,
    },
  });
  expectStatus(unit, 201, 'Syndic unit creation');

  const residentInvitation = await request(`/condominiums/${condominiumId}/residents`, {
    method: 'POST',
    cookie: syndicLogin.cookie,
    body: {
      name: `${marker} Resident`,
      email: residentEmail,
      phone: '11999990002',
      unitId: unit.payload.id,
      role: 'owner',
    },
  });
  expectStatus(residentInvitation, 202, 'Syndic resident invitation');
  assert.equal(residentInvitation.payload.invitation.role, 'resident');
  assert.equal(residentInvitation.payload.invitation.status, 'sent');

  const residentToken = tokenFromDelivery(residentInvitation.payload.delivery);
  const residentAcceptance = await request(`/onboarding/invitations/${residentToken}/accept`, {
    method: 'POST',
    body: { password: 'resident-test-password', name: `${marker} Resident`, phone: '11999990002' },
  });
  expectStatus(residentAcceptance, 200, 'Resident invitation acceptance');
  assert.equal(residentAcceptance.payload.status, 'accepted');

  const residentLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: residentEmail, password: 'resident-test-password' },
  });
  expectStatus(residentLogin, 200, 'Resident login');
  assert.ok(residentLogin.cookie);
  assert.equal(residentLogin.payload.user.memberships[0].role, 'resident');
  assert.equal(residentLogin.payload.user.memberships[0].accountId, accountId);

  const residentCondominiums = await request('/condominiums', { cookie: residentLogin.cookie });
  expectStatus(residentCondominiums, 200, 'Resident condominium visibility');
  assert.deepEqual(residentCondominiums.payload.map((condominium: { id: string }) => condominium.id), [condominiumId]);

  const residentUnits = await request(`/condominiums/${condominiumId}/units`, { cookie: residentLogin.cookie });
  expectStatus(residentUnits, 200, 'Resident unit visibility');
  assert.equal(residentUnits.payload.length, 1);
  assert.equal(residentUnits.payload[0].id, unit.payload.id);
  assert.equal(residentUnits.payload[0].relationships.length, 1);
  assert.equal(residentUnits.payload[0].relationships[0].person.email, residentEmail);

  const residentCannotCreateBuilding = await request(`/condominiums/${condominiumId}/buildings`, {
    method: 'POST',
    cookie: residentLogin.cookie,
    body: { name: `${marker} Forbidden Block` },
  });
  expectStatus(residentCannotCreateBuilding, 403, 'Resident administration restriction');
  const residentCannotManageInvitations = await request(`/condominiums/${condominiumId}/invitations`, {
    cookie: residentLogin.cookie,
  });
  expectStatus(residentCannotManageInvitations, 403, 'Resident invitation restriction');

  const invitationAudits = await prisma.auditEvent.count({
    where: { accountId, condominiumId, entity: 'Invitation' },
  });
  assert.ok(invitationAudits >= 4, 'Invitation create and accept operations must be audited.');

  console.log(JSON.stringify({
    administrator: {
      onboarding: 'passed',
      seesAllCondominiums: administratorSeesNewCondominium,
      operationalAccessStatus: administratorOperationalAccess.status,
    },
    syndic: { activation: 'passed', residentInvitation: 'passed' },
    resident: { activation: 'passed', ownUnitOnly: 'passed', administrationBlocked: 'passed' },
    auditEvents: invitationAudits,
  }, null, 2));
}

run()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
