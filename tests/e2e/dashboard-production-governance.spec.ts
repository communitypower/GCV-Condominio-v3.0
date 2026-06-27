import { expect, request as playwrightRequest, test } from '@playwright/test';
import { apiLogin, createTestBuilding, createTestUnit, expectStatus, firstCondominium } from './helpers/api';
import { cleanupE2EData, TEST_PREFIX, uniqueName } from './helpers/cleanup';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isProductionTarget = baseURL.includes('gcv-app-production-production.up.railway.app');

test.beforeEach(async ({ request }) => {
  if (isProductionTarget) {
    expect(process.env.E2E_TEST_SECRET, 'E2E_TEST_SECRET is required for production E2E cleanup').toBeTruthy();
  }
  await cleanupE2EData(request, baseURL);
});

test.afterEach(async ({ request }) => {
  await cleanupE2EData(request, baseURL);
});

test('production API rejects unauthenticated, invalid, and resident-forbidden operations', async ({ request }) => {
  const unauthenticated = await request.get(`${baseURL}/api/v1/condominiums`);
  await expectStatus(unauthenticated, 401);

  await apiLogin(request, baseURL);
  const condo = await firstCondominium(request, baseURL);

  const invalidBuilding = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/buildings`, {
    headers: { origin: baseURL },
    data: { name: '' },
  });
  await expectStatus(invalidBuilding, 400);

  const invalidUnit = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/units`, {
    headers: { origin: baseURL },
    data: {
      number: '',
      type: 'not_a_type',
      status: 'not_a_status',
      fractionalShare: -1,
      buildingId: 'not-a-uuid',
    },
  });
  await expectStatus(invalidUnit, 400);

  const invalidEquipment = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/equipment`, {
    headers: { origin: baseURL },
    data: {
      name: '',
      location: '',
      category: '',
      status: 'not_a_status',
    },
  });
  await expectStatus(invalidEquipment, 400);

  const invalidCharge = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/charges`, {
    headers: { origin: baseURL },
    data: {
      unitId: 'not-a-uuid',
      monthString: '2099-99',
      amount: -1,
      dueDate: 'not-a-date',
      description: '',
    },
  });
  await expectStatus(invalidCharge, 400);

  const invalidAudit = await request.post(`${baseURL}/api/v1/accounts/${condo.accountId}/audit`, {
    headers: { origin: baseURL },
    data: {
      title: '',
      content: '',
      type: 'not_a_type',
    },
  });
  await expectStatus(invalidAudit, 400);

  const invalidDocument = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/documents`, {
    headers: { origin: baseURL },
    data: {
      title: '',
      category: '',
      requiredRole: 'not_a_role',
      filePath: '',
    },
  });
  await expectStatus(invalidDocument, 400);

  const residentContext = await playwrightRequest.newContext({ baseURL });
  try {
    await apiLogin(residentContext, baseURL, 'carlos.ramos@email.com', 'resident123');

    const residentBuilding = await residentContext.post(`${baseURL}/api/v1/condominiums/${condo.id}/buildings`, {
      headers: { origin: baseURL },
      data: { name: `${TEST_PREFIX}Forbidden Building` },
    });
    await expectStatus(residentBuilding, 403);

    const residentEquipment = await residentContext.post(`${baseURL}/api/v1/condominiums/${condo.id}/equipment`, {
      headers: { origin: baseURL },
      data: {
        name: `${TEST_PREFIX}Forbidden Equipment`,
        location: `${TEST_PREFIX}Casa de Maquinas`,
        category: 'security',
        status: 'operational',
      },
    });
    await expectStatus(residentEquipment, 403);

    const residentAudit = await residentContext.get(`${baseURL}/api/v1/accounts/${condo.accountId}/audit`);
    await expectStatus(residentAudit, 403);
  } finally {
    await residentContext.dispose();
  }
});

test('production API supports full test-data lifecycle for buildings, units, plans, tickets, charges, residents, documents, and audit logs', async ({ request }) => {
  await apiLogin(request, baseURL);
  const condo = await firstCondominium(request, baseURL);

  const building = await createTestBuilding(request, baseURL, condo.id, uniqueName('BUILDING_FULL'));
  const unit = await createTestUnit(request, baseURL, condo.id, building.id, uniqueName('UNIT_FULL'));

  const unitPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/units/${unit.id}`, {
    headers: { origin: baseURL },
    data: { status: 'maintenance', fractionalShare: 0.002 },
  });
  await expectStatus(unitPatch, 200);
  expect((await unitPatch.json()).status).toBe('maintenance');

  const residentEmail = `test_e2e_${Date.now()}@example.com`;
  const resident = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/residents`, {
    headers: { origin: baseURL },
    data: {
      name: `${TEST_PREFIX}Resident Full`,
      email: residentEmail,
      phone: '11999999999',
      unitId: unit.id,
      role: 'owner',
    },
  });
  await expectStatus(resident, 201);

  const equipment = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/equipment`, {
    headers: { origin: baseURL },
    data: {
      name: uniqueName('EQUIPMENT_FULL'),
      location: `${TEST_PREFIX}Barrilete`,
      category: `${TEST_PREFIX}Hidraulica`,
      status: 'operational',
    },
  });
  await expectStatus(equipment, 201);
  const equipmentBody = await equipment.json();

  const equipmentPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/equipment/${equipmentBody.id}`, {
    headers: { origin: baseURL },
    data: { status: 'maintenance' },
  });
  await expectStatus(equipmentPatch, 200);
  expect((await equipmentPatch.json()).status).toBe('maintenance');

  const plan = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/plans`, {
    headers: { origin: baseURL },
    data: {
      equipmentId: equipmentBody.id,
      title: uniqueName('PLAN_FULL'),
      description: `${TEST_PREFIX}Plano com ciclo completo`,
      frequency: 'monthly',
      nextOccurrence: '2099-12-10',
      status: 'active',
    },
  });
  await expectStatus(plan, 201);
  const planBody = await plan.json();

  const planPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/plans/${planBody.id}`, {
    headers: { origin: baseURL },
    data: { status: 'suspended' },
  });
  await expectStatus(planPatch, 200);

  const planDelete = await request.delete(`${baseURL}/api/v1/condominiums/${condo.id}/plans/${planBody.id}`, {
    headers: { origin: baseURL },
  });
  await expectStatus(planDelete, 200);

  const ticket = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/tickets`, {
    headers: { origin: baseURL },
    data: {
      title: uniqueName('TICKET_FULL'),
      description: `${TEST_PREFIX}Chamado ciclo completo`,
      category: 'plumbing',
      priority: 'medium',
      unitId: unit.id,
      estimatedCost: 210,
    },
  });
  await expectStatus(ticket, 201);
  const ticketBody = await ticket.json();

  const ticketComment = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/tickets/${ticketBody.id}/comments`, {
    headers: { origin: baseURL },
    data: { comment: `${TEST_PREFIX}Comentario de acompanhamento` },
  });
  await expectStatus(ticketComment, 201);

  const ticketResolved = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/tickets/${ticketBody.id}`, {
    headers: { origin: baseURL },
    data: { status: 'resolved', assignedStaff: `${TEST_PREFIX}Equipe manutencao`, actualCost: 199.9 },
  });
  await expectStatus(ticketResolved, 200);
  expect((await ticketResolved.json()).status).toBe('resolved');

  const charge = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/charges`, {
    headers: { origin: baseURL },
    data: {
      unitId: unit.id,
      monthString: '2099-10',
      amount: 456.78,
      dueDate: '2099-10-10',
      description: `${TEST_PREFIX}Cobranca ciclo completo`,
    },
  });
  await expectStatus(charge, 201);
  const chargeBody = await charge.json();
  expect(chargeBody.barcode).toBeTruthy();
  expect(chargeBody.pixQrCode).toBeTruthy();

  const chargePaid = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/charges/${chargeBody.id}/status`, {
    headers: { origin: baseURL },
    data: { status: 'paid' },
  });
  await expectStatus(chargePaid, 200);
  expect((await chargePaid.json()).paidAt).toBeTruthy();

  const document = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/documents`, {
    headers: { origin: baseURL },
    data: {
      title: uniqueName('DOCUMENT_FULL'),
      category: 'operations',
      requiredRole: 'resident',
      unitId: unit.id,
      filePath: `${TEST_PREFIX}full-document.pdf`,
    },
  });
  await expectStatus(document, 201);
  const documentBody = await document.json();

  const download = await request.get(`${baseURL}/api/v1/condominiums/${condo.id}/documents/${documentBody.id}/download`);
  await expectStatus(download, 200);
  expect(download.headers()['content-type']).toContain('application/pdf');

  const audit = await request.post(`${baseURL}/api/v1/accounts/${condo.accountId}/audit`, {
    headers: { origin: baseURL },
    data: {
      title: uniqueName('AUDIT_FULL'),
      content: `${TEST_PREFIX}Log ciclo completo`,
      type: 'admin',
    },
  });
  await expectStatus(audit, 201);
});
