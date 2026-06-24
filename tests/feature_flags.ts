import assert from 'assert';
import { AuditAction, PrismaClient } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const API_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, '');
const prisma = new PrismaClient();

const FEATURE_AUDIT_DETAILS = [
  'Tentativa bloqueada: assistente de IA desabilitado.',
  'Tentativa bloqueada: integração GitHub desabilitada.',
  'Tentativa bloqueada: exportações demo desabilitadas.',
];

async function runTests() {
  console.log('Running feature flag protection tests...');

  try {
    await prisma.auditEvent.deleteMany({
      where: { details: { in: FEATURE_AUDIT_DETAILS } },
    });

    const loginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sindico@gcv.com.br' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Mock login should succeed for flag tests');
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie, 'Mock login should return a session cookie');

    const aiRes = await fetch(`${API_ORIGIN}/api/gemini/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ prompt: 'teste', contextData: {} }),
    });
    assert.strictEqual(aiRes.status, 403, 'Disabled AI assistant should return 403');

    const githubRes = await fetch(`${API_ORIGIN}/api/auth/github/url`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(githubRes.status, 403, 'Disabled GitHub integration should return 403');

    const demoRes = await fetch(`${API_ORIGIN}/api/demo/github-profile`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(demoRes.status, 403, 'Disabled demo exports should return 403');

    for (const details of FEATURE_AUDIT_DETAILS) {
      const count = await prisma.auditEvent.count({
        where: {
          action: AuditAction.export,
          details,
        },
      });
      assert.ok(count > 0, `Expected audit event for: ${details}`);
    }

    console.log('All feature flag protection tests completed with SUCCESS.');
  } finally {
    await prisma.auditEvent.deleteMany({
      where: {
        details: {
          in: [
            ...FEATURE_AUDIT_DETAILS,
            'Login mock realizado em ambiente local/teste.',
          ],
        },
      },
    });
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
