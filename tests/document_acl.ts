import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api/v1';

async function runTests() {
  console.log("Running Document ACL Verification tests...");

  // 1. Login as Syndic to find document IDs and condo ID
  console.log("Logging in as syndic to collect metadata...");
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
  
  // Fetch documents to get the seeded document IDs
  const docsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
    headers: { Cookie: syndicCookie }
  });
  const documents = (await docsRes.json()) as any[];
  assert.ok(documents.length >= 2, "Should have seeded at least two documents");

  const publicDoc = documents.find(d => d.unitId === null);
  assert.ok(publicDoc, "Should have a public document");

  // Create a unit-restricted document for testing
  // Let's find unit IDs in condo
  const unitsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/units`, {
    headers: { Cookie: syndicCookie }
  });
  const units = (await unitsRes.json()) as any[];
  
  // Find Carlos Eduardo Ramos's unit (A-101) vs Mariana's unit (A-102)
  const unitA101 = units.find(u => u.number === '101');
  const unitA102 = units.find(u => u.number === '102');
  assert.ok(unitA101 && unitA102, "Seeded units should contain A-101 and A-102");

  console.log(`Creating private document for Unit A-101 (${unitA101.id})...`);
  const createPrivateRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: syndicCookie
    },
    body: JSON.stringify({
      title: "Extrato Financeiro Restrito A-101",
      category: "billing",
      requiredRole: "resident",
      unitId: unitA101.id,
      filePath: "uploads/private_a101.pdf"
    })
  });
  const privateDoc = (await createPrivateRes.json()) as any;
  assert.ok(privateDoc.id, "Should have created private document successfully");

  // 2. Login as Resident of unit A-101 (carlos.ramos@email.com)
  console.log("Logging in as Resident Carlos (A-101)...");
  const carlosLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'carlos.ramos@email.com' }),
  });
  const carlosCookie = carlosLoginRes.headers.get('set-cookie')!;

  // 3. Login as Resident of unit A-102 (mariana.costa@email.com)
  console.log("Logging in as Resident Mariana (A-102)...");
  const marianaLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mariana.costa@email.com' }),
  });
  const marianaCookie = marianaLoginRes.headers.get('set-cookie')!;

  // 4. Test access permissions
  // Carlos (A-101) downloads public document -> should succeed (200)
  console.log("Testing: Resident Carlos downloading public document...");
  const downloadPublicRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${publicDoc.id}/download`, {
    headers: { Cookie: carlosCookie }
  });
  assert.strictEqual(downloadPublicRes.status, 200, "Carlos should be allowed to download public documents");
  console.log("✔ Resident successfully accessed public document");

  // Carlos (A-101) downloads private document scoped to A-101 -> should succeed (200)
  console.log("Testing: Resident Carlos downloading private document scoped to A-101...");
  const downloadPrivateCarlosRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
    headers: { Cookie: carlosCookie }
  });
  assert.strictEqual(downloadPrivateCarlosRes.status, 200, "Carlos should be allowed to download documents scoped to unit A-101");
  console.log("✔ Resident successfully accessed their unit-scoped document");

  // Mariana (A-102) downloads private document scoped to A-101 -> should fail (403)
  console.log("Testing: Resident Mariana trying to download private document scoped to A-101...");
  const downloadPrivateMarianaRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
    headers: { Cookie: marianaCookie }
  });
  assert.strictEqual(downloadPrivateMarianaRes.status, 403, "Mariana should be blocked from downloading document scoped to another unit");
  console.log("✔ Cross-unit document access blocked successfully (403)");

  // Syndic downloads private document scoped to A-101 -> should succeed (200)
  console.log("Testing: Syndic downloading private document scoped to A-101...");
  const downloadPrivateSyndicRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
    headers: { Cookie: syndicCookie }
  });
  assert.strictEqual(downloadPrivateSyndicRes.status, 200, "Syndic should bypass unit-scopes for all documents");
  console.log("✔ Syndic successfully bypassed unit-scoped document restrictions");

  console.log("All Document ACL tests completed with SUCCESS.");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
