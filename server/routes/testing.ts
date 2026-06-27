import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const TEST_PREFIX = 'TEST_E2E_';

function testingEnabled() {
  return process.env.ENABLE_E2E_TESTING === 'true' && Boolean(process.env.E2E_TEST_SECRET);
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

  const results: Record<string, number> = {};

  const tickets = await prisma.maintenanceTicket.findMany({
    where: {
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
      monthString: { startsWith: '2099-' },
      charges: { none: {} },
    },
  })).count;

  results.maintenancePlans = (await prisma.maintenancePlan.deleteMany({
    where: {
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { description: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  results.equipment = (await prisma.equipment.deleteMany({
    where: {
      OR: [
        { name: { startsWith: TEST_PREFIX } },
        { location: { startsWith: TEST_PREFIX } },
        { category: { startsWith: TEST_PREFIX } },
      ],
    },
  })).count;

  const units = await prisma.unit.findMany({
    where: {
      OR: [
        { number: { startsWith: TEST_PREFIX } },
        { building: { name: { startsWith: TEST_PREFIX } } },
      ],
    },
    select: { id: true },
  });
  const unitIds = units.map((unit) => unit.id);
  results.unitRelationships = (await prisma.unitRelationship.deleteMany({ where: { unitId: { in: unitIds } } })).count;
  results.units = (await prisma.unit.deleteMany({ where: { id: { in: unitIds } } })).count;

  results.users = (await prisma.user.deleteMany({ where: { email: { startsWith: 'test_e2e_' } } })).count;
  results.people = (await prisma.person.deleteMany({ where: { email: { startsWith: 'test_e2e_' } } })).count;

  results.buildings = (await prisma.building.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } })).count;

  results.auditEvents = (await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { details: { contains: TEST_PREFIX } },
        { entityId: { in: [...ticketIds, ...chargeIds, ...documentIds, ...unitIds] } },
      ],
    },
  })).count;

  res.json({ prefix: TEST_PREFIX, results });
});

export default router;
