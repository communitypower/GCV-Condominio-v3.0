import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { AuditAction, PlatformRole, PrismaClient } from '@prisma/client';
import authRouter from '../server/routes/auth';

const prisma = new PrismaClient();
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}/api/v1/auth`;
const AUTH_AUDIT_TEST_DETAILS = [
  'Tentativa de login bloqueada pela allowlist beta.',
  'Login por senha realizado com sucesso.',
  'Tentativa de login Google sem pessoa ou usuário cadastrado.',
  'Conta Google vinculada a novo usuário.',
  'Login Google realizado com sucesso.',
  'Conta Google vinculada ao usuário.',
  'Conta Microsoft vinculada ao usuário.',
  'Login Microsoft realizado com sucesso.',
];

// Generate RSA keys for signing mock JWTs
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const publicKeyJwk = publicKey.export({ format: 'jwk' }) as any;
publicKeyJwk.kid = 'test-kid';
publicKeyJwk.use = 'sig';
publicKeyJwk.alg = 'RS256';

// Helper to sign JWT
function signJwt(payload: any, kid = 'test-kid') {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const tokenInput = `${base64Header}.${base64Payload}`;
  const signature = crypto.sign('SHA256', Buffer.from(tokenInput), privateKey).toString('base64url');
  return `${tokenInput}.${signature}`;
}

// Global fetch mock to intercept openid-client OIDC requests
const originalFetch = globalThis.fetch;
let mockClaims: any = null;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

  // 1. Google OIDC configuration discovery
  if (urlStr === 'https://accounts.google.com/.well-known/openid-configuration') {
    return new Response(JSON.stringify({
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
      response_types_supported: ['code'],
      id_token_signing_alg_values_supported: ['RS256']
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 2. Google JWKS
  if (urlStr === 'https://www.googleapis.com/oauth2/v3/certs') {
    return new Response(JSON.stringify({
      keys: [publicKeyJwk]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 3. Google Token endpoint
  if (urlStr === 'https://oauth2.googleapis.com/token') {
    const idToken = signJwt({
      iss: 'https://accounts.google.com',
      sub: mockClaims.sub,
      aud: 'test-google-client-id',
      email: mockClaims.email,
      name: mockClaims.name,
      email_verified: mockClaims.email_verified,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 60,
    });

    return new Response(JSON.stringify({
      access_token: 'mock-google-access-token',
      token_type: 'Bearer',
      id_token: idToken,
      expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 4. Microsoft OIDC configuration discovery
  if (urlStr === 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration') {
    return new Response(JSON.stringify({
      issuer: 'https://login.microsoftonline.com/common/v2.0',
      authorization_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      token_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      response_types_supported: ['code'],
      id_token_signing_alg_values_supported: ['RS256']
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 5. Microsoft JWKS
  if (urlStr === 'https://login.microsoftonline.com/common/discovery/v2.0/keys') {
    return new Response(JSON.stringify({
      keys: [publicKeyJwk]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 6. Microsoft Token endpoint
  if (urlStr === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
    const idToken = signJwt({
      iss: 'https://login.microsoftonline.com/common/v2.0',
      sub: mockClaims.sub,
      aud: 'test-microsoft-client-id',
      email: mockClaims.email,
      name: mockClaims.name,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 60,
    });

    return new Response(JSON.stringify({
      access_token: 'mock-microsoft-access-token',
      token_type: 'Bearer',
      id_token: idToken,
      expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Fallback to original fetch for local test requests
  return originalFetch(input, init);
};

// Set environment variables for tests
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_TENANT_ID = 'common';
process.env.SESSION_SECRET = 'gcv_local_secret_session_key';
process.env.PASSWORD_RESET_TEST_MODE = 'true';
process.env.APP_URL = `http://localhost:${PORT}`;
process.env.NODE_ENV = 'test';

// Start test app
const app = express();
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use('/api/v1/auth', authRouter);

let server: any;

async function setup() {
  return new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });
}

async function teardown() {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await prisma.$disconnect();
}

// Parse cookie helpers
function getCookieValue(cookieHeader: string, name: string): string | null {
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [k, v] = pair.trim().split('=');
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

async function runTests() {
  await setup();
  let allowlistTestAccountId: string | null = null;
  let allowlistTestUserId: string | null = null;

  try {
    console.log('\n--- Running OAuth flow tests ---\n');
    await prisma.auditEvent.deleteMany({
      where: { details: { in: AUTH_AUDIT_TEST_DETAILS } },
    });

    const originalNodeEnv = process.env.NODE_ENV;
    const originalBetaAllowedEmails = process.env.BETA_ALLOWED_EMAILS;
    const allowlistTestEmail = 'beta-allowlist-test@gcv.com.br';
    const allowlistTestPassword = 'beta-allowlist-test-password';

    await prisma.auditEvent.deleteMany({ where: { userEmail: allowlistTestEmail } });
    await prisma.membership.deleteMany({ where: { user: { email: allowlistTestEmail } } });
    await prisma.user.deleteMany({ where: { email: allowlistTestEmail } });
    await prisma.account.deleteMany({ where: { name: 'Beta Allowlist Test Account' } });

    const allowlistTestAccount = await prisma.account.create({
      data: { name: 'Beta Allowlist Test Account' },
    });
    allowlistTestAccountId = allowlistTestAccount.id;

    const allowlistTestUser = await prisma.user.create({
      data: {
        email: allowlistTestEmail,
        passwordHash: bcrypt.hashSync(allowlistTestPassword, 10),
      },
    });
    allowlistTestUserId = allowlistTestUser.id;

    await prisma.membership.create({
      data: {
        userId: allowlistTestUser.id,
        accountId: allowlistTestAccount.id,
        role: PlatformRole.admin,
      },
    });

    console.log('Test 0: Testing provisioned membership access beyond the legacy beta allowlist...');
    try {
      process.env.NODE_ENV = 'staging';
      process.env.BETA_ALLOWED_EMAILS = 'beta-only@example.com';

      const mockLoginRes = await fetch(`${BASE_URL}/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: allowlistTestEmail }),
      });
      assert.strictEqual(mockLoginRes.status, 403, 'Mock login should be blocked in staging');

      const provisionedLoginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: allowlistTestEmail, password: allowlistTestPassword }),
      });
      assert.strictEqual(provisionedLoginRes.status, 200, 'Provisioned staging user should not depend on the legacy allowlist');
      assert.ok(provisionedLoginRes.headers.get('set-cookie')?.includes('gcv_session'), 'Provisioned login should set session cookie');

      process.env.BETA_ALLOWED_EMAILS = allowlistTestEmail;

      const allowedLoginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: allowlistTestEmail, password: allowlistTestPassword }),
      });
      assert.strictEqual(allowedLoginRes.status, 200, 'Allowlisted staging user should log in');
      assert.ok(allowedLoginRes.headers.get('set-cookie')?.includes('gcv_session'), 'Allowlisted login should set session cookie');

      const allowedAudit = await prisma.auditEvent.findFirst({
          where: {
            userEmail: allowlistTestEmail,
            action: AuditAction.auth_login,
            details: 'Login por senha realizado com sucesso.',
          },
        });
      assert.ok(allowedAudit, 'Allowed staging login should be audited');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalBetaAllowedEmails === undefined) {
        delete process.env.BETA_ALLOWED_EMAILS;
      } else {
        process.env.BETA_ALLOWED_EMAILS = originalBetaAllowedEmails;
      }
    }
    console.log('✔ Provisioned membership is the primary production access control.');

    // Setup helper data: ensure a pre-registered Person exists for testing signup
    const preRegisteredEmail = 'new-social-user@gcv.com.br';
    
    // Clean up if leftover from previous aborted tests
    const leftoverUser = await prisma.user.findUnique({ where: { email: preRegisteredEmail } });
    if (leftoverUser) {
      await prisma.auditEvent.deleteMany({ where: { userId: leftoverUser.id } });
      await prisma.oauthAccount.deleteMany({ where: { userId: leftoverUser.id } });
      await prisma.user.delete({ where: { id: leftoverUser.id } });
    }
    await prisma.person.deleteMany({ where: { email: preRegisteredEmail } });

    const person = await prisma.person.create({
      data: {
        name: 'Pre Registered </script><script>globalThis.oauthXss=true</script>',
        email: preRegisteredEmail,
        phone: '11999999999',
      },
    });

    // Clean up syndic's oauth relationships if any
    const syndic = await prisma.user.findUnique({ where: { email: 'sindico@gcv.com.br' } });
    if (syndic) {
      await prisma.oauthAccount.deleteMany({ where: { userId: syndic.id } });
    }

    // ==========================================
    // Test 1: Google login URL redirect
    // ==========================================
    console.log('Test 1: Testing Google Auth URL Generation...');
    const urlRes = await fetch(`${BASE_URL}/google/login`, {
      redirect: 'manual',
      headers: { Host: 'attacker.example' },
    });
    assert.strictEqual(urlRes.status, 302, 'Should redirect to Google authorization page');
    const redirectUrl = urlRes.headers.get('location')!;
    assert.ok(redirectUrl.includes('accounts.google.com'), 'Redirect location should be google');
    assert.ok(redirectUrl.includes('state='), 'Redirect URL should include state parameter');
    assert.ok(redirectUrl.includes('code_challenge='), 'Redirect URL should include PKCE code_challenge');
    assert.strictEqual(
      new URL(redirectUrl).searchParams.get('redirect_uri'),
      `${BASE_URL}/google/callback`,
      'OAuth redirect must come from APP_URL, never the request Host header'
    );
    console.log('✔ Google login URL generated correctly.');

    // Save cookie details from login response
    const stateCookie = urlRes.headers.get('set-cookie')!;
    assert.ok(stateCookie.includes('gcv_oauth_state'), 'Should set state cookie');
    const stateCookieVal = getCookieValue(stateCookie, 'gcv_oauth_state');
    assert.ok(stateCookieVal, 'OAuth state cookie should not be empty');

    // ==========================================
    // Test 2: Google callback for unregistered user (returns 403)
    // ==========================================
    console.log('\nTest 2: Testing Google Callback for unregistered email...');
    
    const expectedState = new URL(redirectUrl).searchParams.get('state');
    assert.ok(expectedState, 'Authorization redirect should expose the public OAuth state');
    assert.ok(!stateCookieVal.includes(expectedState), 'OAuth cookie must keep state and PKCE data opaque');

    mockClaims = {
      sub: 'google-sub-unregistered',
      email: 'not-registered@gcv.com.br',
      name: 'Not Registered',
      email_verified: true,
    };

    const callbackRes = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${expectedState}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal}`,
      },
    });

    assert.strictEqual(callbackRes.status, 403, 'Should return 403 Forbidden for unregistered email');
    const callbackText = await callbackRes.text();
    assert.ok(callbackText.includes('Acesso Não Autorizado'), 'Should notify user about unauthorized access');
    const deniedCsp = callbackRes.headers.get('content-security-policy') || '';
    assert.ok(deniedCsp.includes("script-src 'nonce-"), 'Denied callback should set a nonce-based CSP');
    assert.ok(!deniedCsp.includes("'unsafe-inline'"), 'OAuth callback CSP must not allow unsafe inline code');
    console.log('✔ Unregistered OAuth login correctly rejected with 403.');

    // ==========================================
    // Test 3: Google callback for pre-registered Person (Sign up & Link)
    // ==========================================
    console.log('\nTest 3: Testing Google Callback for pre-registered Person...');
    mockClaims = {
      sub: 'google-sub-registered-new',
      email: preRegisteredEmail,
      name: 'Pre Registered </script><script>globalThis.oauthXss=true</script>',
      email_verified: true,
    };

    // Get a fresh state cookie
    const urlRes2 = await fetch(`${BASE_URL}/google/login`, { redirect: 'manual' });
    const stateCookie2 = urlRes2.headers.get('set-cookie')!;
    const stateCookieVal2 = getCookieValue(stateCookie2, 'gcv_oauth_state')!;
    const expectedState2 = new URL(urlRes2.headers.get('location')!).searchParams.get('state');
    assert.ok(expectedState2, 'Fresh authorization redirect should expose OAuth state');

    const callbackRes2 = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${expectedState2}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal2}`,
        Host: 'attacker.example',
      },
    });

    assert.strictEqual(callbackRes2.status, 200, 'Callback should succeed');
    const callbackText2 = await callbackRes2.text();
    assert.ok(callbackText2.includes('GOOGLE_AUTH_SUCCESS'), 'Should postMessage GOOGLE_AUTH_SUCCESS');
    assert.ok(callbackText2.includes('"isSystemAdmin":false'), 'Google payload should expose system-admin state');
    assert.ok(callbackText2.includes('"memberships":[]'), 'Google payload should expose only active memberships');
    const successCsp = callbackRes2.headers.get('content-security-policy') || '';
    assert.ok(successCsp.includes("script-src 'nonce-"), 'Callback should set a nonce-based CSP');
    assert.ok(!successCsp.includes("'unsafe-inline'"), 'OAuth callback CSP must not allow unsafe inline code');
    assert.ok(!callbackText2.includes('</script><script>globalThis.oauthXss'), 'Provider claims must not break out of the callback script');
    assert.ok(callbackText2.includes('\\u003c/script\\u003e'), 'Inline JSON should escape HTML-significant characters');
    assert.ok(!callbackText2.includes('attacker.example'), 'Callback payload must not trust the request Host header');
    
    // Check cookie
    const sessionCookieHeader = callbackRes2.headers.get('set-cookie')!;
    assert.ok(sessionCookieHeader.includes('gcv_session'), 'Should return a gcv_session cookie');

    // Confirm DB mapping
    const createdUser = await prisma.user.findUnique({
      where: { email: preRegisteredEmail },
      include: { oauthAccounts: true },
    });
    assert.ok(createdUser, 'User should be created in database');
    assert.strictEqual(createdUser.personId, person.id, 'User should be linked to Person');
    assert.strictEqual(createdUser.oauthAccounts.length, 1, 'Should have 1 linked oauth account');
    assert.strictEqual(createdUser.oauthAccounts[0].provider, 'google', 'Provider should be google');
    assert.strictEqual(createdUser.oauthAccounts[0].providerUserId, 'google-sub-registered-new', 'Provider sub should match');
    console.log('✔ User created and linked to Person successfully.');

    // ==========================================
    // Test 4: Google callback linking to existing User
    // ==========================================
    console.log('\nTest 4: Testing Google Callback linking to existing User...');
    
    mockClaims = {
      sub: 'google-sub-syndic',
      email: 'sindico@gcv.com.br',
      name: 'Cassiano Marins',
      email_verified: true,
    };

    const urlRes3 = await fetch(`${BASE_URL}/google/login`, { redirect: 'manual' });
    const stateCookie3 = urlRes3.headers.get('set-cookie')!;
    const stateCookieVal3 = getCookieValue(stateCookie3, 'gcv_oauth_state')!;
    const expectedState3 = new URL(urlRes3.headers.get('location')!).searchParams.get('state');
    assert.ok(expectedState3, 'Existing-user authorization redirect should expose OAuth state');

    const callbackRes3 = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${expectedState3}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal3}`,
      },
    });

    assert.strictEqual(callbackRes3.status, 200, 'Callback should succeed');
    const callbackText3 = await callbackRes3.text();
    assert.ok(callbackText3.includes('"isSystemAdmin":false'), 'Existing Google payload should expose system-admin state');
    
    const syndicUser = await prisma.user.findUnique({
      where: { email: 'sindico@gcv.com.br' },
      include: { oauthAccounts: true },
    });
    assert.ok(syndicUser, 'Syndic user should exist');
    const hasGoogleLink = syndicUser.oauthAccounts.some(acc => acc.provider === 'google' && acc.providerUserId === 'google-sub-syndic');
    assert.ok(hasGoogleLink, 'OAuth account link should be created in DB');
    console.log('✔ Existing user linked successfully.');

    // ==========================================
    // Test 5: Microsoft is explicitly unavailable during beta
    // ==========================================
    console.log('\nTest 5: Testing Microsoft OAuth beta shutdown...');
    const microsoftLinksBefore = await prisma.oauthAccount.count({ where: { provider: 'microsoft' } });
    const msUrlRes = await fetch(`${BASE_URL}/microsoft/login`, { redirect: 'manual' });
    assert.strictEqual(msUrlRes.status, 501, 'Microsoft login must be unavailable during beta');
    assert.strictEqual(msUrlRes.headers.get('location'), null, 'Microsoft login must not redirect');
    assert.strictEqual((await msUrlRes.json()).code, 'MICROSOFT_OAUTH_UNAVAILABLE');
    const callbackResMs = await fetch(`${BASE_URL}/microsoft/callback?code=untrusted&state=untrusted`);
    assert.strictEqual(callbackResMs.status, 501, 'Microsoft callback must not process claims during beta');
    assert.strictEqual((await callbackResMs.json()).code, 'MICROSOFT_OAUTH_UNAVAILABLE');
    const microsoftLinks = await prisma.oauthAccount.count({ where: { provider: 'microsoft' } });
    assert.strictEqual(microsoftLinks, microsoftLinksBefore, 'Disabled Microsoft endpoints must not create account links');
    console.log('✔ Microsoft OAuth is explicitly unavailable.');

    // ==========================================
    // Test 6: Password reset anti-enumeration and one-time token
    // ==========================================
    console.log('\nTest 6: Testing password reset lifecycle...');
    const preResetLogin = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: allowlistTestEmail, password: allowlistTestPassword }),
    });
    assert.strictEqual(preResetLogin.status, 200);
    const preResetCookie = preResetLogin.headers.get('set-cookie');
    assert.ok(preResetCookie, 'Pre-reset login must provide a session for revocation verification');
    const unknownReset = await fetch(`${BASE_URL}/password-reset/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'unknown@gcv.invalid' }),
    });
    const knownReset = await fetch(`${BASE_URL}/password-reset/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: allowlistTestEmail }),
    });
    assert.strictEqual(unknownReset.status, 202);
    assert.strictEqual(knownReset.status, 202);
    const unknownBody = await unknownReset.json();
    const knownBody = await knownReset.json();
    assert.strictEqual(unknownBody.message, knownBody.message, 'Password reset response must not enumerate accounts');
    assert.strictEqual(unknownBody.resetToken, undefined, 'Unknown accounts must never receive a token');
    assert.ok(knownBody.resetToken, 'Test mode should expose the reset token for verification');
    assert.ok(knownBody.resetUrl.startsWith(`${process.env.APP_URL}/reset-password?token=`), 'Reset URL must use APP_URL');
    const firstTokenHash = crypto.createHash('sha256').update(knownBody.resetToken).digest('hex');
    const storedReset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: firstTokenHash } });
    assert.ok(storedReset, 'Reset request must persist a hashed token');
    assert.notStrictEqual(storedReset.tokenHash, knownBody.resetToken, 'Raw reset token must never be stored');
    assert.ok(storedReset.requestedIp, 'Reset request must record the source IP');
    await prisma.passwordResetToken.update({
      where: { id: storedReset.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expiredReset = await fetch(`${BASE_URL}/password-reset/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: knownBody.resetToken, password: 'ExpiredSecurePassword123' }),
    });
    assert.strictEqual(expiredReset.status, 400, 'Expired reset tokens must be rejected');

    const freshReset = await fetch(`${BASE_URL}/password-reset/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: allowlistTestEmail }),
    });
    const freshResetBody = await freshReset.json();
    const freshTokenHash = crypto.createHash('sha256').update(freshResetBody.resetToken).digest('hex');
    const supersededToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: firstTokenHash } });
    assert.ok(supersededToken?.usedAt, 'A new request must invalidate older open tokens');

    const weakPassword = await fetch(`${BASE_URL}/password-reset/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: freshResetBody.resetToken, password: 'weak' }),
    });
    assert.strictEqual(weakPassword.status, 400, 'Weak passwords must be rejected');

    const newPassword = 'NewSecurePassword123';
    const completedReset = await fetch(`${BASE_URL}/password-reset/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: freshResetBody.resetToken, password: newPassword }),
    });
    assert.strictEqual(completedReset.status, 200, 'Valid reset token should update the password');
    const consumedToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: freshTokenHash } });
    assert.ok(consumedToken?.usedAt, 'Successful reset must persist token consumption');
    const revokedSession = await fetch(`${BASE_URL}/me`, { headers: { Cookie: preResetCookie! } });
    assert.strictEqual(revokedSession.status, 401, 'Password reset must revoke sessions issued before the reset');
    const replayReset = await fetch(`${BASE_URL}/password-reset/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: freshResetBody.resetToken, password: 'AnotherSecurePassword123' }),
    });
    assert.strictEqual(replayReset.status, 400, 'Reset token must be single-use');
    const loginWithResetPassword = await fetch(`${BASE_URL}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: allowlistTestEmail, password: newPassword }),
    });
    assert.strictEqual(loginWithResetPassword.status, 200, 'The new password should authenticate');
    const resetAudit = await prisma.auditEvent.findFirst({
      where: { userId: allowlistTestUser.id, details: { startsWith: 'Senha redefinida com token ' } },
    });
    assert.ok(resetAudit, 'Successful password reset must be audited');
    console.log('✔ Password reset is anti-enumerating, expiring by design and single-use.');

    // Clean up test users & data
    const finalClean = await prisma.user.findUnique({ where: { email: preRegisteredEmail } });
    if (finalClean) {
      await prisma.auditEvent.deleteMany({ where: { userId: finalClean.id } });
      await prisma.oauthAccount.deleteMany({ where: { userId: finalClean.id } });
      await prisma.user.delete({ where: { id: finalClean.id } });
    }
    await prisma.person.deleteMany({ where: { email: preRegisteredEmail } });
    // Clean up syndic links to restore seed state
    await prisma.oauthAccount.deleteMany({ where: { userId: syndicUser.id } });
    await prisma.auditEvent.deleteMany({
      where: { details: { in: AUTH_AUDIT_TEST_DETAILS } },
    });

    console.log('\nAll OAuth flow tests completed successfully!\n');
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { details: { in: AUTH_AUDIT_TEST_DETAILS } },
    });
    if (allowlistTestAccountId) {
      await prisma.auditEvent.deleteMany({ where: { accountId: allowlistTestAccountId } });
      await prisma.membership.deleteMany({ where: { accountId: allowlistTestAccountId } });
      await prisma.account.deleteMany({ where: { id: allowlistTestAccountId } });
    }
    if (allowlistTestUserId) {
      await prisma.user.deleteMany({ where: { id: allowlistTestUserId } });
    }
    await teardown();
  }
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  await teardown();
  process.exit(1);
});
