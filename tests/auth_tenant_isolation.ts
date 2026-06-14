import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api/v1';

async function runTests() {
  console.log("Running Auth & Tenant Isolation tests...");

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
  console.log(`✔ Scoped access allowed. Found condominium: ${condos[0].name} (${condoId})`);

  // 4. Test tenantGuard - access a dummy condominium ID (not in memberships)
  const dummyCondoId = '00000000-0000-0000-0000-000000000000';
  console.log(`Testing tenantGuard: accessing dummy condo ${dummyCondoId} as syndic...`);
  const guardRes = await fetch(`${BASE_URL}/condominiums/${dummyCondoId}/units`, {
    headers: { Cookie: cookie },
  });
  assert.strictEqual(guardRes.status, 403, "Should return 403 for unauthorized condominium context");
  console.log("✔ Cross-tenant access blocked successfully (403)");

  // 5. Test resident login and role restriction
  console.log("Logging in as resident (carlos.ramos@email.com)...");
  const resLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'carlos.ramos@email.com' }),
  });
  const resCookie = resLoginRes.headers.get('set-cookie')!;

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

  console.log("All tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
