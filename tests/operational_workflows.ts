import assert from 'assert';
import { PrismaClient, UnitStatus, UnitType } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function runTests() {
  console.log("Running GCV Operational Workflows tests...");
  let ticketId: string | null = null;
  let chargeId: string | null = null;
  let billingPeriodId: string | null = null;
  let tempUnitId: string | null = null;
  let tempBuildingId: string | null = null;
  let equipmentId: string | null = null;
  let planId: string | null = null;
  let commentId: string | null = null;

  try {
    // 1. Authenticate as Syndic
    console.log("Logging in as syndic...");
    const syndicLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sindico@gcv.com.br' }),
    });
    const syndicCookie = syndicLoginRes.headers.get('set-cookie')!;

    // Fetch condos to get active condo ID
    const condosRes = await fetch(`${BASE_URL}/condominiums`, {
      headers: { Cookie: syndicCookie }
    });
    const condos = (await condosRes.json()) as any[];
    const condoId = condos[0].id;
    const accountId = condos[0].accountId;

    const tempBuilding = await prisma.building.create({
      data: {
        name: `Operational Workflow Test Building ${Date.now()}`,
        condominiumId: condoId,
      },
    });
    tempBuildingId = tempBuilding.id;

    const tempUnit = await prisma.unit.create({
      data: {
        number: `OPS-${Date.now()}`,
        type: UnitType.apartment,
        status: UnitStatus.occupied,
        fractionalShare: 0.001,
        buildingId: tempBuilding.id,
      },
    });
    tempUnitId = tempUnit.id;

    // 2. Test Maintenance Ticket Workflow
    console.log("Testing maintenance ticket validation...");
    const invalidTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        title: "",
        description: "Invalid ticket should be rejected.",
        category: "not_a_category",
        priority: "high",
      })
    });
    assert.strictEqual(invalidTicketRes.status, 400, "Should reject invalid ticket payload");
    console.log("✔ Invalid maintenance ticket payload rejected successfully (400)");

    console.log("Creating a new maintenance ticket...");
    const createTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        title: `Reparo Corretivo Fiação Guarita - Test ${Date.now()}`,
        description: "Curtos-circuitos ocasionais desarmando disjuntores da guarita técnica.",
        category: "electrical",
        priority: "high",
        estimatedCost: 350.00
      })
    });
    assert.strictEqual(createTicketRes.status, 201, "Should create ticket successfully");
    const ticket = (await createTicketRes.json()) as any;
    assert.ok(ticket.id, "Ticket should have an ID");
    ticketId = ticket.id;
    assert.strictEqual(ticket.status, 'reported', "Ticket status should initially be reported");
    console.log(`✔ Ticket created successfully: ${ticket.title} (${ticket.id})`);

    const invalidDirectResolutionRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert.strictEqual(invalidDirectResolutionRes.status, 409, "Should reject reported -> resolved transition");
    const unchangedTicket = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    assert.strictEqual(unchangedTicket.status, 'reported', "Rejected transition must not alter ticket status");

    // Add Comment
    console.log("Adding comment to the ticket...");
    const commentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets/${ticket.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        comment: "Eletricista agendado para amanhã de manhã às 9h."
      })
    });
    assert.strictEqual(commentRes.status, 201, "Should add comment successfully");
    const comment = (await commentRes.json()) as any;
    commentId = comment.id;
    console.log("✔ Comment added successfully");

    // Transition Status (reported -> in_progress)
    console.log("Transitioning ticket status to in_progress...");
    const patchTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        status: "in_progress",
        assignedStaff: "Eletrotécnica J. Silva"
      })
    });
    assert.strictEqual(patchTicketRes.status, 200, "Should update ticket successfully");
    const patchedTicket = (await patchTicketRes.json()) as any;
    assert.strictEqual(patchedTicket.status, 'in_progress', "Status should be updated");
    assert.strictEqual(patchedTicket.assignedStaff, 'Eletrotécnica J. Silva', "Assignee should be updated");
    console.log("✔ Ticket status transitioned successfully");

    const resolveTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({ status: 'resolved', actualCost: 325 }),
    });
    assert.strictEqual(resolveTicketRes.status, 200, "Should resolve an in-progress ticket");
    const resolvedTicket = (await resolveTicketRes.json()) as any;
    assert.strictEqual(resolvedTicket.status, 'resolved');
    assert.ok(resolvedTicket.resolvedAt, "Resolved ticket should record resolvedAt");

    const reopenResolvedTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    assert.strictEqual(reopenResolvedTicketRes.status, 409, "Should reject transitions from terminal resolved status");

    // 3. Test Billing Tracker Workflow using a disposable charge
    console.log("Testing billing validation...");
    const invalidChargeRes = await fetch(`${BASE_URL}/condominiums/${condoId}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        unitId: "not-a-uuid",
        monthString: "2099-99",
        amount: -1,
        dueDate: "invalid-date",
        description: "",
      })
    });
    assert.strictEqual(invalidChargeRes.status, 400, "Should reject invalid charge payload");
    console.log("✔ Invalid billing payload rejected successfully (400)");

    console.log("Testing equipment validation...");
    const invalidEquipmentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/equipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        name: '',
        location: '',
        category: '',
        status: 'not_a_status',
      })
    });
    assert.strictEqual(invalidEquipmentRes.status, 400, "Should reject invalid equipment payload");
    console.log("✔ Invalid equipment payload rejected successfully (400)");

    const missingEquipmentDatesRes = await fetch(`${BASE_URL}/condominiums/${condoId}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({
        name: `Equipment without dates ${Date.now()}`,
        location: 'Casa de máquinas',
        category: 'Bomba',
        status: 'operational',
      }),
    });
    assert.strictEqual(missingEquipmentDatesRes.status, 400, "Unknown equipment dates must not default to today");

    const equipmentDates = {
      installDate: '2020-01-15T00:00:00.000Z',
      lastInspection: '2026-01-10T00:00:00.000Z',
      nextInspection: '2027-01-10T00:00:00.000Z',
    };
    const createEquipmentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({
        name: `TEST_OPS_Bomba ${Date.now()}`,
        location: 'Casa de máquinas',
        category: 'Bomba',
        status: 'operational',
        ...equipmentDates,
      }),
    });
    assert.strictEqual(createEquipmentRes.status, 201, "Should create equipment with explicit dates");
    const equipment = (await createEquipmentRes.json()) as any;
    equipmentId = equipment.id;
    assert.strictEqual(equipment.installDate, equipmentDates.installDate, "Install date must be preserved exactly");
    assert.strictEqual(equipment.lastInspection, equipmentDates.lastInspection, "Inspection date must not become today");

    const updateEquipmentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/equipment/${equipment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({ status: 'maintenance' }),
    });
    assert.strictEqual(updateEquipmentRes.status, 200, "Should update equipment");
    const updatedEquipment = (await updateEquipmentRes.json()) as any;
    assert.strictEqual(updatedEquipment.installDate, equipmentDates.installDate, "Unsent dates must remain unchanged");
    assert.strictEqual(updatedEquipment.status, 'maintenance');

    console.log("Testing maintenance plan validation...");
    const invalidPlanRes = await fetch(`${BASE_URL}/condominiums/${condoId}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        equipmentId: 'not-a-uuid',
        title: '',
        description: '',
        frequency: 'not_a_frequency',
        nextOccurrence: 'not-a-date',
        status: 'not_a_status',
      })
    });
    assert.strictEqual(invalidPlanRes.status, 400, "Should reject invalid maintenance plan payload");
    console.log("✔ Invalid maintenance plan payload rejected successfully (400)");

    const createPlanRes = await fetch(`${BASE_URL}/condominiums/${condoId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({
        equipmentId: equipment.id,
        title: `TEST_OPS_Plano ${Date.now()}`,
        description: 'Inspeção preventiva do equipamento de teste.',
        frequency: 'annual',
        nextOccurrence: '2027-01-10T00:00:00.000Z',
        status: 'active',
      }),
    });
    assert.strictEqual(createPlanRes.status, 201, "Should create maintenance plan");
    const plan = (await createPlanRes.json()) as any;
    planId = plan.id;

    const updatePlanRes = await fetch(`${BASE_URL}/condominiums/${condoId}/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: syndicCookie },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.strictEqual(updatePlanRes.status, 200, "Should update maintenance plan");
    assert.strictEqual(((await updatePlanRes.json()) as any).status, 'suspended');

    console.log("Creating disposable billing charge...");
    const monthString = `2099-${String((Date.now() % 12) + 1).padStart(2, '0')}`;

    const createChargeRes = await fetch(`${BASE_URL}/condominiums/${condoId}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        unitId: tempUnit.id,
        monthString,
        amount: 123.45,
        dueDate: `${monthString}-10`,
        description: `Cobrança operacional descartável ${Date.now()}`
      })
    });
    assert.strictEqual(createChargeRes.status, 201, "Should create disposable charge successfully");
    const pendingCharge = (await createChargeRes.json()) as any;
    assert.strictEqual(pendingCharge.status, 'pending', "Disposable charge should start pending");
    chargeId = pendingCharge.id;
    billingPeriodId = pendingCharge.billingPeriodId;
    console.log(`Created disposable charge: ${pendingCharge.id} for unit ${pendingCharge.unit.number}`);

    // Mark Charge as Paid
    console.log(`Updating charge ${pendingCharge.id} status to paid...`);
    const patchChargeRes = await fetch(`${BASE_URL}/condominiums/${condoId}/charges/${pendingCharge.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({ status: "paid" })
    });
    assert.strictEqual(patchChargeRes.status, 200, "Should update charge status successfully");
    const updatedCharge = (await patchChargeRes.json()) as any;
    assert.strictEqual(updatedCharge.status, 'paid', "Charge status should be paid");
    assert.ok(updatedCharge.paidAt, "paidAt timestamp should be set");
    console.log("✔ Billing charge status updated successfully");

    // Verify Audit Log entry was generated
    console.log("Fetching audit logs to verify entry creation...");
    const auditRes = await fetch(`${BASE_URL}/accounts/${accountId}/audit?condominiumId=${condoId}`, {
      headers: { Cookie: syndicCookie }
    });
    assert.strictEqual(auditRes.status, 200, "Should allow fetching audit logs");
    const auditLogs = (await auditRes.json()) as any[];
    const chargeAudit = auditLogs.find((event) => event.entity === 'Charge' && event.entityId === pendingCharge.id);
    assert.ok(chargeAudit, "Should find an audit event for the disposable charge");
    assert.strictEqual(chargeAudit.action, 'update', "Charge audit event action should be update");
    assert.ok(auditLogs.some((event) => event.entity === 'MaintenanceTicket' && event.entityId === ticket.id && event.action === 'create'), "Ticket creation must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'MaintenanceTicket' && event.entityId === ticket.id && event.action === 'update' && event.details.includes('in_progress')), "Ticket status transition must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'TicketComment' && event.entityId === comment.id && event.action === 'create'), "Ticket comment must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'Equipment' && event.entityId === equipment.id && event.action === 'create'), "Equipment creation must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'Equipment' && event.entityId === equipment.id && event.action === 'update'), "Equipment update must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'MaintenancePlan' && event.entityId === plan.id && event.action === 'create'), "Plan creation must be audited");
    assert.ok(auditLogs.some((event) => event.entity === 'MaintenancePlan' && event.entityId === plan.id && event.action === 'update'), "Plan update must be audited");
    console.log(`✔ Audit log verified: "${chargeAudit.details}"`);

    console.log("All GCV Operational Workflows tests completed with SUCCESS.");
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { details: 'Login mock realizado em ambiente local/teste.' },
    });

    if (ticketId) {
      if (commentId) {
        await prisma.auditEvent.deleteMany({ where: { entity: 'TicketComment', entityId: commentId } });
      }
      await prisma.ticketComment.deleteMany({ where: { ticketId } });
      await prisma.ticketStatusHistory.deleteMany({ where: { ticketId } });
      await prisma.auditEvent.deleteMany({ where: { entity: 'MaintenanceTicket', entityId: ticketId } });
      await prisma.maintenanceTicket.deleteMany({ where: { id: ticketId } });
    }

    if (planId) {
      await prisma.auditEvent.deleteMany({ where: { entity: 'MaintenancePlan', entityId: planId } });
      await prisma.maintenancePlan.deleteMany({ where: { id: planId } });
    }

    if (equipmentId) {
      await prisma.auditEvent.deleteMany({ where: { entity: 'Equipment', entityId: equipmentId } });
      await prisma.equipment.deleteMany({ where: { id: equipmentId } });
    }

    if (chargeId) {
      await prisma.auditEvent.deleteMany({ where: { entity: 'Charge', entityId: chargeId } });
      await prisma.chargeLineItem.deleteMany({ where: { chargeId } });
      await prisma.charge.deleteMany({ where: { id: chargeId } });
    }

    if (tempUnitId) {
      await prisma.unit.deleteMany({ where: { id: tempUnitId } });
    }

    if (tempBuildingId) {
      await prisma.building.deleteMany({ where: { id: tempBuildingId } });
    }

    if (billingPeriodId) {
      const remainingCharges = await prisma.charge.count({ where: { billingPeriodId } });
      if (remainingCharges === 0) {
        await prisma.billingPeriod.deleteMany({ where: { id: billingPeriodId } });
      }
    }

    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
