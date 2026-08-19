import assert from 'assert';
import {
  InvitationStatus,
  MembershipStatus,
  PlatformRole,
  PrismaClient,
  RelationshipRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import { requireAuth, tenantGuard } from '../server/middleware/auth';
import authRouter from '../server/routes/auth';
import {
  acceptInvitation,
  closeInvitation,
  createInvitation,
  inspectInvitation,
  listInvitations,
  resendInvitation,
} from '../server/services/invitations';
import { onboardCondominium } from '../server/services/onboarding';

const prisma = new PrismaClient();
const marker = `test_invite_${Date.now()}`;
const createdEmails = [
  `${marker}@example.com`,
  `${marker}_cancel@example.com`,
  `${marker}_syndic@example.com`,
  `${marker}_admin@example.com`,
];
let authServer: ReturnType<express.Express['listen']> | null = null;
let authBaseUrl = '';
let existingActorMembershipId: string | null = null;

async function startAuthServer() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'invitation-lifecycle-test-secret';
  const app = express();
  app.use(express.json());
  app.use(cookieParser(process.env.SESSION_SECRET));
  app.use('/api/v1/auth', authRouter);
  await new Promise<void>((resolve) => {
    authServer = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = authServer.address();
  assert.ok(address && typeof address === 'object');
  authBaseUrl = `http://127.0.0.1:${address.port}/api/v1/auth`;
}

function tokenFromDelivery(delivery: object) {
  const typedDelivery = delivery as { acceptanceUrl?: string };
  assert.ok(typedDelivery.acceptanceUrl, 'Manual delivery must return an acceptance URL');
  const segments = new URL(typedDelivery.acceptanceUrl).pathname.split('/');
  return decodeURIComponent(segments.at(-1)!);
}

function mockResponse() {
  const state = { statusCode: 200, payload: undefined as unknown };
  return {
    state,
    response: {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        state.payload = payload;
        return this;
      },
    } as any,
  };
}

async function cleanUp() {
  if (existingActorMembershipId) {
    await prisma.membership.deleteMany({ where: { id: existingActorMembershipId } });
    existingActorMembershipId = null;
  }
  const users = await prisma.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true, personId: true },
  });
  const userIds = users.map((user) => user.id);
  const personIds = users.flatMap((user) => user.personId ? [user.personId] : []);
  const accounts = await prisma.account.findMany({
    where: { name: `${marker} account` },
    select: { id: true },
  });
  const accountIds = accounts.map((account) => account.id);

  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { accountId: { in: accountIds } },
        { details: { contains: marker } },
      ],
    },
  });
  await prisma.invitation.deleteMany({
    where: {
      OR: [
        { emailNormalized: { in: createdEmails } },
        { accountId: { in: accountIds } },
      ],
    },
  });
  await prisma.unitRelationship.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.membership.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { accountId: { in: accountIds } }] },
  });
  await prisma.condominium.deleteMany({ where: { accountId: { in: accountIds } } });
  await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.person.deleteMany({ where: { id: { in: personIds } } });
}

async function run() {
  delete process.env.INVITATION_EMAIL_WEBHOOK_URL;
  await cleanUp();
  await startAuthServer();

  const condominium = await prisma.condominium.findFirstOrThrow({
    include: {
      account: true,
      buildings: { include: { units: true } },
      memberships: {
        where: { role: PlatformRole.syndic, status: MembershipStatus.active },
        include: { user: true },
      },
    },
  });
  const actor = condominium.memberships[0]?.user;
  const unit = condominium.buildings.flatMap((building) => building.units)[0];
  assert.ok(actor && unit, 'Seed must contain an active syndic and a unit');

  const created = await createInvitation(prisma, {
    accountId: condominium.accountId,
    condominiumId: condominium.id,
    unitId: unit.id,
    email: createdEmails[0].toUpperCase(),
    name: marker,
    phone: '11999990000',
    role: PlatformRole.resident,
    relationshipRole: RelationshipRole.tenant,
    invitedById: actor.id,
    invitedByEmail: actor.email,
  });
  assert.strictEqual(created.delivery.method, 'manual_link');
  assert.ok(!('tokenHash' in created.invitation), 'Invitation hash must never be serialized');
  const firstToken = tokenFromDelivery(created.delivery);

  const pendingMembership = await prisma.membership.findUniqueOrThrow({
    where: { id: created.invitation.membershipId! },
    include: { user: true },
  });
  assert.strictEqual(pendingMembership.status, MembershipStatus.pending);
  assert.strictEqual(
    await prisma.unitRelationship.count({ where: { personId: pendingMembership.user.personId! } }),
    0,
    'Unit access must not exist before acceptance'
  );

  const pendingRequest: any = { signedCookies: { gcv_session: pendingMembership.userId } };
  const pendingAuthResponse = mockResponse();
  let authenticated = false;
  await requireAuth(pendingRequest, pendingAuthResponse.response, () => {
    authenticated = true;
  });
  assert.ok(authenticated, 'Pending users must retain a session for invitation acceptance');
  assert.strictEqual(pendingRequest.user.memberships.length, 0);
  assert.strictEqual(pendingRequest.user.pendingMemberships.length, 1);

  const pendingMockLogin = await fetch(`${authBaseUrl}/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: createdEmails[0] }),
  });
  assert.strictEqual(pendingMockLogin.status, 200);
  const pendingMockPayload = await pendingMockLogin.json() as any;
  assert.deepStrictEqual(pendingMockPayload.user.memberships, []);
  assert.strictEqual(pendingMockPayload.user.isSystemAdmin, false);
  const pendingCookie = pendingMockLogin.headers.get('set-cookie');
  assert.ok(pendingCookie);
  const pendingMe = await fetch(`${authBaseUrl}/me`, { headers: { Cookie: pendingCookie! } });
  const pendingMePayload = await pendingMe.json() as any;
  assert.deepStrictEqual(pendingMePayload.user.memberships, []);
  assert.strictEqual(pendingMePayload.user.isSystemAdmin, false);

  const tenantResponse = mockResponse();
  pendingRequest.params = { condoId: condominium.id };
  pendingRequest.query = {};
  await tenantGuard(pendingRequest, tenantResponse.response, () => {
    throw new Error('Pending membership must not pass tenantGuard');
  });
  assert.strictEqual(tenantResponse.state.statusCode, 403);

  const inspected = await inspectInvitation(prisma, firstToken);
  assert.strictEqual(inspected.email, createdEmails[0]);
  assert.strictEqual(inspected.requiresExistingAccountLogin, false);

  const rotated = await resendInvitation(prisma, {
    invitationId: created.invitation.id,
    condominiumId: condominium.id,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  const rotatedToken = tokenFromDelivery(rotated.delivery);
  assert.notStrictEqual(rotatedToken, firstToken);
  await assert.rejects(() => inspectInvitation(prisma, firstToken), /Convite inválido/);

  const accepted = await acceptInvitation(prisma, {
    token: rotatedToken,
    password: 'test-password-123',
    name: `${marker} accepted`,
  });
  assert.strictEqual(accepted.status, InvitationStatus.accepted);

  const activeMembership = await prisma.membership.findUniqueOrThrow({
    where: { id: created.invitation.membershipId! },
  });
  assert.strictEqual(activeMembership.status, MembershipStatus.active);
  const relationship = await prisma.unitRelationship.findFirstOrThrow({
    where: { person: { email: createdEmails[0] }, unitId: unit.id, endDate: null },
  });
  assert.strictEqual(relationship.role, RelationshipRole.tenant);
  assert.ok(await prisma.auditEvent.count({
    where: {
      condominiumId: condominium.id,
      entity: 'Invitation',
      entityId: created.invitation.id,
    },
  }));

  await closeInvitation(prisma, {
    invitationId: created.invitation.id,
    condominiumId: condominium.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'revoke',
  });
  assert.strictEqual(
    (await prisma.membership.findUniqueOrThrow({ where: { id: activeMembership.id } })).status,
    MembershipStatus.revoked
  );
  assert.ok((await prisma.unitRelationship.findUniqueOrThrow({ where: { id: relationship.id } })).endDate);

  const cancelled = await createInvitation(prisma, {
    accountId: condominium.accountId,
    condominiumId: condominium.id,
    unitId: unit.id,
    email: createdEmails[1],
    name: `${marker} cancel`,
    role: PlatformRole.resident,
    relationshipRole: RelationshipRole.dependent,
    invitedById: actor.id,
    invitedByEmail: actor.email,
  });
  await prisma.user.update({
    where: { email: createdEmails[1] },
    data: { passwordHash: await bcrypt.hash('test-password-123', 10) },
  });
  const pendingPasswordLogin = await fetch(`${authBaseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: createdEmails[1], password: 'test-password-123' }),
  });
  assert.strictEqual(pendingPasswordLogin.status, 200);
  const pendingPasswordPayload = await pendingPasswordLogin.json() as any;
  assert.deepStrictEqual(pendingPasswordPayload.user.memberships, []);
  await closeInvitation(prisma, {
    invitationId: cancelled.invitation.id,
    condominiumId: condominium.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'cancel',
  });
  assert.strictEqual(
    (await prisma.invitation.findUniqueOrThrow({ where: { id: cancelled.invitation.id } })).status,
    InvitationStatus.cancelled
  );

  const existing = await createInvitation(prisma, {
    accountId: condominium.accountId,
    condominiumId: condominium.id,
    email: actor.email,
    name: actor.email,
    role: PlatformRole.vendor,
    invitedById: actor.id,
    invitedByEmail: actor.email,
  });
  existingActorMembershipId = existing.invitation.membershipId;
  const existingToken = tokenFromDelivery(existing.delivery);
  await assert.rejects(
    () => acceptInvitation(prisma, { token: existingToken, password: 'test-password-123' }),
    /Entre na conta existente/
  );
  const existingAccepted = await acceptInvitation(prisma, {
    token: existingToken,
    authenticatedUserId: actor.id,
  });
  assert.strictEqual(existingAccepted.status, InvitationStatus.accepted);

  const adminPerson = await prisma.person.create({
    data: { name: marker, email: createdEmails[3], phone: '' },
  });
  const admin = await prisma.user.create({
    data: {
      email: createdEmails[3],
      personId: adminPerson.id,
      passwordHash: await bcrypt.hash('test-password-123', 10),
      isSystemAdmin: true,
    },
  });
  const adminLogin = await fetch(`${authBaseUrl}/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email }),
  });
  const adminPayload = await adminLogin.json() as any;
  assert.strictEqual(adminPayload.user.isSystemAdmin, true);
  assert.deepStrictEqual(adminPayload.user.memberships, []);
  const onboarding = await onboardCondominium(prisma, {
    accountName: `${marker} account`,
    condominiumName: `${marker} condominium`,
    condominiumAddress: 'Rua de Teste, 1',
    syndicName: `${marker} syndic`,
    syndicEmail: createdEmails[2],
    actorId: admin.id,
    actorEmail: admin.email,
  });
  assert.strictEqual(onboarding.invitation.status, InvitationStatus.sent);
  assert.strictEqual(onboarding.delivery.method, 'manual_link');
  assert.strictEqual(onboarding.syndic.email, createdEmails[2]);
  assert.strictEqual(onboarding.syndic.name, `${marker} syndic`);
  assert.ok(onboarding.syndic.id);
  assert.ok(await prisma.auditEvent.count({
    where: {
      accountId: onboarding.account.id,
      condominiumId: onboarding.condominium.id,
      entity: 'CondominiumOnboarding',
    },
  }));

  const listed = await listInvitations(prisma, condominium.id);
  assert.ok(listed.length >= 3);
  assert.ok(listed.every((invitation) => !('tokenHash' in invitation)));
  const residentInvitation = listed.find((invitation) => invitation.id === created.invitation.id);
  assert.deepStrictEqual(residentInvitation?.unit, {
    number: unit.number,
    building: {
      name: condominium.buildings.find((building) =>
        building.units.some((candidate) => candidate.id === unit.id)
      )!.name,
    },
  });
  console.log('Invitation and access lifecycle tests completed with SUCCESS.');
}

run()
  .finally(async () => {
    if (authServer) {
      await new Promise<void>((resolve, reject) => {
        authServer!.close((error) => error ? reject(error) : resolve());
      });
    }
    await cleanUp();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
