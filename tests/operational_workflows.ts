import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api/v1';

async function runTests() {
  console.log("Running GCV Operational Workflows tests...");

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

  // 2. Test Maintenance Ticket Workflow
  console.log("Creating a new maintenance ticket...");
  const createTicketRes = await fetch(`${BASE_URL}/condominiums/${condoId}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: syndicCookie
    },
    body: JSON.stringify({
      title: "Reparo Corretivo Fiação Guarita",
      description: "Curtos-circuitos ocasionais desarmando disjuntores da guarita técnica.",
      category: "electrical",
      priority: "high",
      estimatedCost: 350.00
    })
  });
  assert.strictEqual(createTicketRes.status, 201, "Should create ticket successfully");
  const ticket = (await createTicketRes.json()) as any;
  assert.ok(ticket.id, "Ticket should have an ID");
  assert.strictEqual(ticket.status, 'reported', "Ticket status should initially be reported");
  console.log(`✔ Ticket created successfully: ${ticket.title} (${ticket.id})`);

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

  // 3. Test Billing Tracker Workflow
  console.log("Fetching billing charges...");
  const chargesRes = await fetch(`${BASE_URL}/condominiums/${condoId}/charges`, {
    headers: { Cookie: syndicCookie }
  });
  const charges = (await chargesRes.json()) as any[];
  assert.ok(charges.length > 0, "Should return seeded billing charges");
  const pendingCharge = charges.find(c => c.status === 'pending');
  assert.ok(pendingCharge, "Should have a pending charge to test");
  console.log(`Found pending charge: ${pendingCharge.id} for unit ${pendingCharge.unit.number}`);

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
  const auditRes = await fetch(`${BASE_URL}/accounts/${accountId}/audit`, {
    headers: { Cookie: syndicCookie }
  });
  assert.strictEqual(auditRes.status, 200, "Should allow fetching audit logs");
  const auditLogs = (await auditRes.json()) as any[];
  const lastEvent = auditLogs[0];
  assert.strictEqual(lastEvent.entity, 'Charge', "Last audit event should be related to the Charge update");
  assert.strictEqual(lastEvent.action, 'update', "Last audit event action should be update");
  console.log(`✔ Audit log verified: "${lastEvent.details}"`);

  console.log("All GCV Operational Workflows tests completed with SUCCESS.");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
