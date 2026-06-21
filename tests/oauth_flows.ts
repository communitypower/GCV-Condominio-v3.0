import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import authRouter from '../server/routes/auth';

const prisma = new PrismaClient();
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}/api/v1/auth`;

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

  try {
    console.log('\n--- Running OAuth flow tests ---\n');

    // Setup helper data: ensure a pre-registered Person exists for testing signup
    const preRegisteredEmail = 'new-social-user@gcv.com.br';
    
    // Clean up if leftover from previous aborted tests
    const leftoverUser = await prisma.user.findUnique({ where: { email: preRegisteredEmail } });
    if (leftoverUser) {
      await prisma.oauthAccount.deleteMany({ where: { userId: leftoverUser.id } });
      await prisma.user.delete({ where: { id: leftoverUser.id } });
    }
    await prisma.person.deleteMany({ where: { email: preRegisteredEmail } });

    const person = await prisma.person.create({
      data: {
        name: 'Pre Registered Person',
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
    const urlRes = await fetch(`${BASE_URL}/google/login`, { redirect: 'manual' });
    assert.strictEqual(urlRes.status, 302, 'Should redirect to Google authorization page');
    const redirectUrl = urlRes.headers.get('location')!;
    assert.ok(redirectUrl.includes('accounts.google.com'), 'Redirect location should be google');
    assert.ok(redirectUrl.includes('state='), 'Redirect URL should include state parameter');
    assert.ok(redirectUrl.includes('code_challenge='), 'Redirect URL should include PKCE code_challenge');
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
    
    // Parse the state from cookie (it is a signed cookie, but for testing we can extract it or pass it back)
    // To pass verification, we extract the state from the cookie contents
    // In Express, signed cookies look like: s%3A{JSON}%2B{HMAC}
    const rawVal = stateCookieVal.substring(2); // Remove 's:' prefix
    const jsonStr = rawVal.split('.')[0]; // Remove signature
    const parsedState = JSON.parse(jsonStr);

    mockClaims = {
      sub: 'google-sub-unregistered',
      email: 'not-registered@gcv.com.br',
      name: 'Not Registered',
      email_verified: true,
    };

    const callbackRes = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${parsedState.state}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal}`,
      },
    });

    assert.strictEqual(callbackRes.status, 403, 'Should return 403 Forbidden for unregistered email');
    const callbackText = await callbackRes.text();
    assert.ok(callbackText.includes('não está cadastrado'), 'Should notify user about lack of invitation/registration');
    console.log('✔ Unregistered OAuth login correctly rejected with 403.');

    // ==========================================
    // Test 3: Google callback for pre-registered Person (Sign up & Link)
    // ==========================================
    console.log('\nTest 3: Testing Google Callback for pre-registered Person...');
    mockClaims = {
      sub: 'google-sub-registered-new',
      email: preRegisteredEmail,
      name: 'Pre Registered Person',
      email_verified: true,
    };

    // Get a fresh state cookie
    const urlRes2 = await fetch(`${BASE_URL}/google/login`, { redirect: 'manual' });
    const stateCookie2 = urlRes2.headers.get('set-cookie')!;
    const stateCookieVal2 = getCookieValue(stateCookie2, 'gcv_oauth_state')!;
    const rawVal2 = stateCookieVal2.substring(2);
    const parsedState2 = JSON.parse(rawVal2.split('.')[0]);

    const callbackRes2 = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${parsedState2.state}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal2}`,
      },
    });

    assert.strictEqual(callbackRes2.status, 200, 'Callback should succeed');
    const callbackText2 = await callbackRes2.text();
    assert.ok(callbackText2.includes('GOOGLE_AUTH_SUCCESS'), 'Should postMessage GOOGLE_AUTH_SUCCESS');
    
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
    const rawVal3 = stateCookieVal3.substring(2);
    const parsedState3 = JSON.parse(rawVal3.split('.')[0]);

    const callbackRes3 = await fetch(`${BASE_URL}/google/callback?code=mock_code&state=${parsedState3.state}`, {
      headers: {
        Cookie: `gcv_oauth_state=${stateCookieVal3}`,
      },
    });

    assert.strictEqual(callbackRes3.status, 200, 'Callback should succeed');
    
    const syndicUser = await prisma.user.findUnique({
      where: { email: 'sindico@gcv.com.br' },
      include: { oauthAccounts: true },
    });
    assert.ok(syndicUser, 'Syndic user should exist');
    const hasGoogleLink = syndicUser.oauthAccounts.some(acc => acc.provider === 'google' && acc.providerUserId === 'google-sub-syndic');
    assert.ok(hasGoogleLink, 'OAuth account link should be created in DB');
    console.log('✔ Existing user linked successfully.');

    // ==========================================
    // Test 5: Microsoft login URL redirect
    // ==========================================
    console.log('\nTest 5: Testing Microsoft Auth URL Generation...');
    const msUrlRes = await fetch(`${BASE_URL}/microsoft/login`, { redirect: 'manual' });
    assert.strictEqual(msUrlRes.status, 302, 'Should redirect to Microsoft authorization page');
    const msRedirectUrl = msUrlRes.headers.get('location')!;
    assert.ok(msRedirectUrl.includes('login.microsoftonline.com'), 'Redirect location should be microsoft');
    assert.ok(msRedirectUrl.includes('state='), 'Redirect URL should include state parameter');
    console.log('✔ Microsoft login URL generated correctly.');

    const msStateCookie = msUrlRes.headers.get('set-cookie')!;
    assert.ok(msStateCookie.includes('gcv_oauth_state_ms'), 'Should set microsoft state cookie');
    const msStateCookieVal = getCookieValue(msStateCookie, 'gcv_oauth_state_ms')!;

    // ==========================================
    // Test 6: Microsoft callback linking to existing User
    // ==========================================
    console.log('\nTest 6: Testing Microsoft Callback linking to existing User...');
    
    // Clean up ms link for syndic
    await prisma.oauthAccount.deleteMany({ where: { userId: syndicUser.id, provider: 'microsoft' } });

    const rawValMs = msStateCookieVal.substring(2);
    const parsedStateMs = JSON.parse(rawValMs.split('.')[0]);

    mockClaims = {
      sub: 'microsoft-sub-syndic',
      email: 'sindico@gcv.com.br',
      name: 'Cassiano Marins (MS)',
    };

    const callbackResMs = await fetch(`${BASE_URL}/microsoft/callback?code=mock_code&state=${parsedStateMs.state}`, {
      headers: {
        Cookie: `gcv_oauth_state_ms=${msStateCookieVal}`,
      },
    });

    assert.strictEqual(callbackResMs.status, 200, 'Callback should succeed');
    const callbackTextMs = await callbackResMs.text();
    assert.ok(callbackTextMs.includes('MICROSOFT_AUTH_SUCCESS'), 'Should postMessage MICROSOFT_AUTH_SUCCESS');

    const syndicUserMs = await prisma.user.findUnique({
      where: { email: 'sindico@gcv.com.br' },
      include: { oauthAccounts: true },
    });
    const hasMsLink = syndicUserMs!.oauthAccounts.some(acc => acc.provider === 'microsoft' && acc.providerUserId === 'microsoft-sub-syndic');
    assert.ok(hasMsLink, 'OAuth account link should be created in DB for Microsoft');
    console.log('✔ Microsoft user linked successfully.');

    // Clean up test users & data
    const finalClean = await prisma.user.findUnique({ where: { email: preRegisteredEmail } });
    if (finalClean) {
      await prisma.oauthAccount.deleteMany({ where: { userId: finalClean.id } });
      await prisma.user.delete({ where: { id: finalClean.id } });
    }
    await prisma.person.deleteMany({ where: { email: preRegisteredEmail } });
    // Clean up syndic links to restore seed state
    await prisma.oauthAccount.deleteMany({ where: { userId: syndicUser.id } });

    console.log('\nAll OAuth flow tests completed successfully!\n');
  } finally {
    await teardown();
  }
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  await teardown();
  process.exit(1);
});
