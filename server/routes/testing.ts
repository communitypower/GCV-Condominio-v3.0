import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const TEST_PREFIX = 'TEST_E2E_';

function testingEnabled() {
  return process.env.ENABLE_E2E_TESTING === 'true' && Boolean(process.env.E2E_TEST_SECRET);
}

router.post('/cleanup', async (req, res) => {
  if (!testingEnabled()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  if (req.get('x-e2e-secret') !== process.env.E2E_TEST_SECRET) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

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
