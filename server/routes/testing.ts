import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const TEST_PREFIX = 'TEST_E2E_';

function testingEnabled() {
  return process.env.NODE_ENV !== 'production'
    && process.env.ENABLE_E2E_TESTING === 'true'
    && Boolean(process.env.E2E_TEST_SECRET);
}

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
}

function assertTestingAccess(req: any, res: any) {
  if (!testingEnabled()) {
    res.status(404).json({ error: 'Not found.' });
    return false;
  }

  if (req.get('x-e2e-secret') !== process.env.E2E_TEST_SECRET) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }

  return true;
}

router.post('/session', async (req, res) => {
  if (!assertTestingAccess(req, res)) return;

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'E-mail is required.' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { person: true, memberships: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.cookie('gcv_session', user.id, {
    httpOnly: true,
    signed: true,
    secure: isProductionLike(),
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.person?.name || 'User',
      memberships: user.memberships,
    },
  });
});

router.post('/cleanup', async (req, res) => {
  if (!assertTestingAccess(req, res)) return;

  const condominiumId = String(req.body?.condominiumId || '').trim();
  if (!condominiumId) {
    return res.status(400).json({ error: 'condominiumId is required for tenant-safe cleanup.' });
  }
  const condominium = await prisma.condominium.findUnique({
    where: { id: condominiumId },
    select: { id: true },
  });
  if (!condominium) {
    return res.status(404).json({ error: 'Condominium not found.' });
  }

  const results: Record<string, number> = {};

  const tickets = await prisma.maintenanceTicket.findMany({
    where: {
      condominiumId,
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { description: { startsWith: TEST_PREFIX } },
        { assignedStaff: { startsWith: TEST_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const ticketIds = tickets.map((ticket) => ticket.id);
  results.ticketComments = (await prisma.ticketComment.deleteMany({ where: { ticketId: { in: ticketIds } } })).count;
  results.ticketStatusHistory = (await prisma.ticketStatusHistory.deleteMany({ where: { ticketId: { in: ticketIds } } })).count;
  results.maintenanceTickets = (await prisma.maintenanceTicket.deleteMany({ where: { id: { in: ticketIds } } })).count;

  const documents = await prisma.document.findMany({
    where: {
      condominiumId,
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { filePath: { startsWith: TEST_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const documentIds = documents.map((document) => document.id);
  results.documentVersions = (await prisma.documentVersion.deleteMany({ where: { documentId: { in: documentIds } } })).count;
  results.documents = (await prisma.document.deleteMany({ where: { id: { in: documentIds } } })).count;

  const charges = await prisma.charge.findMany({
    where: {
      billingPeriod: { condominiumId },
      OR: [
        { description: { startsWith: TEST_PREFIX } },
        { billingPeriod: { monthString: { startsWith: '2099-' } } },
      ],
    },
    select: { id: true },
  });
  const chargeIds = charges.map((charge) => charge.id);
  results.chargeLineItems = (await prisma.chargeLineItem.deleteMany({ where: { chargeId: { in: chargeIds } } })).count;
  results.charges = (await prisma.charge.deleteMany({ where: { id: { in: chargeIds } } })).count;
  results.billingPeriods = (await prisma.billingPeriod.deleteMany({
    where: {
      condominiumId,
      monthString: { startsWith: '2099-' },
      charges: { none: {} },
    },
  })).count;

  results.maintenancePlans = (await prisma.maintenancePlan.deleteMany({
    where: {
      condominiumId,
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { description: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  results.equipment = (await prisma.equipment.deleteMany({
    where: {
      condominiumId,
      OR: [
        { name: { startsWith: TEST_PREFIX } },
        { location: { startsWith: TEST_PREFIX } },
        { category: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  results.purchaseRequests = (await prisma.purchaseRequest.deleteMany({
    where: {
      condominiumId,
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { supplier: { startsWith: TEST_PREFIX } },
        { items: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  results.paymentOrders = (await prisma.paymentOrder.deleteMany({
    where: {
      condominiumId,
      OR: [
        { recipient: { startsWith: TEST_PREFIX } },
        { description: { startsWith: TEST_PREFIX } },
        { paymentReference: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  results.announcements = (await prisma.announcement.deleteMany({
    where: {
      condominiumId,
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { body: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  const units = await prisma.unit.findMany({
    where: {
      building: { condominiumId },
      OR: [
        { number: { startsWith: TEST_PREFIX } },
        { building: { name: { startsWith: TEST_PREFIX } } },
      ],
    },
    select: { id: true },
  });
  const unitIds = units.map((unit) => unit.id);

  const testUsers = await prisma.user.findMany({
    where: {
      email: { startsWith: 'test_e2e_' },
      memberships: { some: { condominiumId } },
    },
    select: { id: true, personId: true },
  });
  const testUserIds = testUsers.map((user) => user.id);
  const testPersonIds = testUsers.flatMap((user) => user.personId ? [user.personId] : []);
  const invitations = await prisma.invitation.findMany({
    where: {
      condominiumId,
      OR: [
        { emailNormalized: { startsWith: 'test_e2e_' } },
        { invitedName: { startsWith: TEST_PREFIX } },
        { unitId: { in: unitIds } },
      ],
    },
    select: { id: true },
  });
  const invitationIds = invitations.map((invitation) => invitation.id);
  results.invitations = (await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } })).count;
  results.unitRelationships = (await prisma.unitRelationship.deleteMany({
    where: {
      OR: [
        { unitId: { in: unitIds } },
        { personId: { in: testPersonIds } },
      ],
    },
  })).count;
  results.memberships = (await prisma.membership.deleteMany({
    where: { userId: { in: testUserIds }, condominiumId },
  })).count;
  results.users = (await prisma.user.deleteMany({
    where: { id: { in: testUserIds }, memberships: { none: {} } },
  })).count;
  results.people = (await prisma.person.deleteMany({
    where: {
      id: { in: testPersonIds },
      user: null,
      relationships: { none: {} },
    },
  })).count;
  results.units = (await prisma.unit.deleteMany({ where: { id: { in: unitIds } } })).count;

  results.buildings = (await prisma.building.deleteMany({
    where: { condominiumId, name: { startsWith: TEST_PREFIX } },
  })).count;

  results.auditEvents = (await prisma.auditEvent.deleteMany({
    where: {
      condominiumId,
      OR: [
        { details: { contains: TEST_PREFIX } },
        { entityId: { in: [...ticketIds, ...chargeIds, ...documentIds, ...unitIds, ...invitationIds] } },
      ],
    },
  })).count;

  res.json({ prefix: TEST_PREFIX, condominiumId, results });
});

export default router;
