import { Router } from 'express';
import { AuditAction, MembershipStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as openid from 'openid-client';
import { createCipheriv, createDecipheriv, createHash, randomBytes, webcrypto } from 'node:crypto';
import { hasPlatformAdminAccess, isApprovedPlatformAdminEmail } from '../services/system-admin';
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  deliverPasswordReset,
  hashPasswordResetToken,
  passwordResetTokenFingerprint,
} from '../services/password-reset';
import { clearSessionCookie, parseSession, setSessionCookie } from '../services/session';

const router = Router();
const prisma = new PrismaClient();

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

type AuthAuditUser = {
  id: string;
  email: string;
  memberships: { accountId: string }[];
};

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
}

function getAllowedBetaEmails() {
  return new Set(
    (process.env.BETA_ALLOWED_EMAILS || '')
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function isEnvironmentAccessAllowed(email: string) {
  if (!isProductionLike()) return true;
  const normalizedEmail = email.trim().toLowerCase();
  if (getAllowedBetaEmails().has(normalizedEmail) || isApprovedPlatformAdminEmail(normalizedEmail)) return true;

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: {
      isSystemAdmin: true,
      memberships: {
        where: { status: { in: [MembershipStatus.pending, MembershipStatus.active] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  return Boolean(user?.memberships.length);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getTrustedAppUrl() {
  const configured = process.env.APP_URL || (isProductionLike() ? '' : 'http://localhost:3000');
  if (!configured) throw new Error('APP_URL não configurada.');
  const appUrl = new URL(configured);
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash || appUrl.pathname !== '/') {
    throw new Error('APP_URL inválida.');
  }
  if (isProductionLike() && appUrl.protocol !== 'https:') {
    throw new Error('APP_URL deve usar HTTPS neste ambiente.');
  }
  if (!['http:', 'https:'].includes(appUrl.protocol)) throw new Error('APP_URL inválida.');
  return appUrl;
}

function oauthCallbackUrl(provider: 'google') {
  return new URL(`/api/v1/auth/${provider}/callback`, getTrustedAppUrl()).toString();
}

function oauthStateKey() {
  return createHash('sha256')
    .update(`${process.env.SESSION_SECRET || 'gcv_local_secret'}:oauth-state`, 'utf8')
    .digest();
}

function sealOAuthState(value: { state: string; codeVerifier: string }) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', oauthStateKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [
    'v1',
    initializationVector.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

function openOAuthState(value: string) {
  const [format, encodedIv, encodedCiphertext, encodedTag, extra] = value.split('.');
  if (format !== 'v1' || !encodedIv || !encodedCiphertext || !encodedTag || extra !== undefined) return null;

  try {
    const initializationVector = Buffer.from(encodedIv, 'base64url');
    const authenticationTag = Buffer.from(encodedTag, 'base64url');
    if (initializationVector.length !== 12 || authenticationTag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', oauthStateKey(), initializationVector);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    if (!parsed || typeof parsed.state !== 'string' || typeof parsed.codeVerifier !== 'string') return null;
    return { state: parsed.state, codeVerifier: parsed.codeVerifier };
  } catch {
    return null;
  }
}

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function sendOAuthPage(res: any, input: {
  status?: number;
  title: string;
  message: string;
  success?: { type: 'GOOGLE_AUTH_SUCCESS'; user: ReturnType<typeof toAuthUserPayload> };
}) {
  const nonce = randomBytes(18).toString('base64url');
  const trustedAppUrl = input.success ? getTrustedAppUrl() : null;
  const appOrigin = trustedAppUrl?.origin;
  const script = input.success
    ? `const targetOrigin=${serializeForInlineScript(appOrigin)};const message=${serializeForInlineScript({ type: input.success.type, payload: { user: input.success.user } })};if(window.opener){window.opener.postMessage(message,targetOrigin);setTimeout(()=>window.close(),1200);}else{window.location.assign(${serializeForInlineScript(trustedAppUrl!.toString())});}`
    : 'function closeWindow(){window.close();}';
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(input.status || 200).type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title>
<style nonce="${nonce}">body{font-family:sans-serif;text-align:center;padding:45px;background:#0c0d10;color:#e2e8f0}h2{color:${input.success ? '#10b981' : '#ef4444'}}p{color:#94a3b8}button{margin-top:15px;padding:10px 20px;background:#ef4444;color:white;border:0;border-radius:8px;cursor:pointer;font-weight:bold}</style></head>
<body><h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.message)}</p>${input.success ? '' : `<button id="close-window" type="button">Fechar janela</button>`}<script nonce="${nonce}">${script}${input.success ? '' : 'document.getElementById("close-window").addEventListener("click",closeWindow);'}</script></body></html>`);
}

function toAuthUserPayload(user: {
  id: string;
  email: string;
  isSystemAdmin: boolean;
  person?: { name: string } | null;
  memberships: { status: MembershipStatus }[];
}, fallbackName = 'User') {
  return {
    id: user.id,
    email: user.email,
    name: user.person?.name || fallbackName,
    isSystemAdmin: hasPlatformAdminAccess(user),
    memberships: user.memberships.filter(
      (membership) => membership.status === MembershipStatus.active
    ),
  };
}

async function writeAuthAudit(
  req: any,
  user: AuthAuditUser | null | undefined,
  action: AuditAction,
  details: string,
  entity = 'User',
  entityId?: string
) {
  if (!user) return;

  const accountIds = [...new Set(user.memberships.map((membership) => membership.accountId).filter(Boolean))];
  if (accountIds.length === 0) return;

  await Promise.all(
    accountIds.map((accountId) =>
      prisma.auditEvent.create({
        data: {
          accountId,
          userId: user.id,
          userEmail: user.email,
          action,
          entity,
          entityId: entityId || user.id,
          details,
          ipAddress: req.ip,
        },
      })
    )
  );
}

async function writeAuthFailureForEmail(req: any, email: string, details: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    include: { memberships: true },
  });
  await writeAuthAudit(req, user, AuditAction.auth_failed, details);
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      include: { person: true, memberships: true },
    });

    if (!user) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    if (!user.passwordHash) {
      await writeAuthAudit(req, user, AuditAction.auth_failed, 'Tentativa de login por senha para usuário sem senha local.');
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await writeAuthAudit(req, user, AuditAction.auth_failed, 'Tentativa de login com senha inválida.');
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    if (!(await isEnvironmentAccessAllowed(user.email))) {
      await writeAuthAudit(req, user, AuditAction.auth_failed, 'Tentativa de login bloqueada pela allowlist beta.');
      return res.status(403).json({ error: "Usuário não habilitado para este ambiente." });
    }

    setSessionCookie(res, user);
    await writeAuthAudit(req, user, AuditAction.auth_login, 'Login por senha realizado com sucesso.');

    res.json({
      message: "Autenticado com sucesso.",
      user: toAuthUserPayload(user),
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Erro interno ao realizar login." });
  }
});

const PASSWORD_RESET_RESPONSE = 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.';

// POST /api/v1/auth/password-reset/request
router.post('/password-reset/request', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) {
    return res.status(202).json({ message: PASSWORD_RESET_RESPONSE });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { memberships: true },
    });

    // OAuth-only identities cannot silently acquire a local password through this flow.
    if (user?.passwordHash) {
      const { token, tokenHash, expiresAt } = createPasswordResetToken();
      const resetUrl = buildPasswordResetUrl(token);
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt, requestedIp: req.ip },
        });
      });
      await writeAuthAudit(req, user, AuditAction.update, 'Recuperação de senha solicitada.', 'User', user.id);
      try {
        await deliverPasswordReset({ email: user.email, resetUrl, expiresAt });
      } catch (deliveryError) {
        console.error('Password Reset Delivery Error:', deliveryError);
        await writeAuthAudit(req, user, AuditAction.auth_failed, 'Falha ao entregar recuperação de senha.', 'User', user.id);
      }

      if (process.env.NODE_ENV === 'test' && process.env.PASSWORD_RESET_TEST_MODE === 'true') {
        return res.status(202).json({ message: PASSWORD_RESET_RESPONSE, resetToken: token, resetUrl });
      }
    }

    return res.status(202).json({ message: PASSWORD_RESET_RESPONSE });
  } catch (error) {
    console.error('Password Reset Request Error:', error);
    return res.status(202).json({ message: PASSWORD_RESET_RESPONSE });
  }
});

// POST /api/v1/auth/password-reset/complete
router.post('/password-reset/complete', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!token || password.length < 12 || password.length > 128
    || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Token inválido ou senha fora da política.' });
  }

  try {
    const tokenHash = hashPasswordResetToken(token);
    const newPasswordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { memberships: true } } },
      });
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || !resetToken.user.passwordHash) {
        return { ok: false as const, user: resetToken?.user || null };
      }

      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return { ok: false as const, user: resetToken.user };

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash, sessionVersion: { increment: 1 } },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
        data: { usedAt: new Date() },
      });
      return { ok: true as const, user: resetToken.user };
    });

    if (!result.ok) {
      await writeAuthAudit(req, result.user, AuditAction.auth_failed, 'Token de recuperação de senha inválido, expirado ou utilizado.', 'User', result.user?.id);
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    clearSessionCookie(res);
    await writeAuthAudit(
      req,
      result.user,
      AuditAction.update,
      `Senha redefinida com token ${passwordResetTokenFingerprint(token)}.`,
      'User',
      result.user.id
    );
    return res.json({ message: 'Senha redefinida com sucesso. Faça login novamente.' });
  } catch (error) {
    console.error('Password Reset Completion Error:', error);
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  }
});

// POST /api/v1/auth/mock-login
router.post('/mock-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    return res.status(403).json({ error: "Login mock desabilitado em ambiente de produção/homologação." });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "E-mail é obrigatório." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      include: { person: true, memberships: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "Usuário mock não encontrado. Use um e-mail do seed (ex: sindico@gcv.com.br ou carlos.ramos@email.com).",
      });
    }

    setSessionCookie(res, user);
    await writeAuthAudit(req, user, AuditAction.auth_login, 'Login mock realizado em ambiente local/teste.');

    res.json({
      message: "Autenticado com sucesso via mock login.",
      user: toAuthUserPayload(user, 'Mock User'),
    });
  } catch (error) {
    console.error("Mock Login Error:", error);
    res.status(500).json({ error: "Erro interno ao realizar login mock." });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res) => {
  const session = parseSession(req.signedCookies?.gcv_session);

  try {
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        include: { memberships: true },
      });
      await writeAuthAudit(req, user, AuditAction.auth_logout, 'Logout realizado com sucesso.');
    }

    clearSessionCookie(res);
    res.json({ message: "Desconectado com sucesso." });
  } catch (error) {
    console.error("Logout Error:", error);
    clearSessionCookie(res);
    res.status(500).json({ error: "Erro interno ao realizar logout." });
  }
});

// GET /api/v1/auth/me
router.get('/me', async (req, res) => {
  const session = parseSession(req.signedCookies?.gcv_session);
  if (!session) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { person: true, memberships: true },
    });

    if (!user || user.sessionVersion !== session.sessionVersion) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    res.json({
      user: toAuthUserPayload(user, 'Mock User'),
    });
  } catch (error) {
    console.error("Auth Me Error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// OAuth helpers lazily discovering metadata configurations
let googleConfigCache: any = null;
async function getGoogleConfig() {
  if (!googleConfigCache) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados.");
    }
    googleConfigCache = await openid.discovery(
      new URL('https://accounts.google.com'),
      clientId,
      clientSecret
    );
  }
  return googleConfigCache;
}

// GET /api/v1/auth/google/login
router.get('/google/login', async (req, res) => {
  try {
    const googleConfig = await getGoogleConfig();
    const state = openid.randomState();
    const codeVerifier = openid.randomPKCECodeVerifier();
    const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);

    const redirectUri = oauthCallbackUrl('google');

    res.cookie('gcv_oauth_state', sealOAuthState({ state, codeVerifier }), {
      httpOnly: true,
      signed: true,
      secure: isProductionLike(),
      maxAge: 10 * 60 * 1000, // 10 minutes
      sameSite: 'lax',
    });

    const authorizationUrl = openid.buildAuthorizationUrl(googleConfig, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authorizationUrl.href);
  } catch (error: any) {
    console.error("Google Auth URL Error:", error);
    return sendOAuthPage(res, { status: 500, title: 'Erro na autenticação', message: 'Não foi possível iniciar o login com o Google.' });
  }
});

// GET /api/v1/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const oauthCookie = req.signedCookies?.gcv_oauth_state;
  res.clearCookie('gcv_oauth_state');

  if (!oauthCookie) {
    return res.status(400).send("Sessão OAuth expirada ou inválida.");
  }

  let expectedState: string;
  let codeVerifier: string;
  const parsedOAuthState = openOAuthState(oauthCookie);
  if (!parsedOAuthState) {
    return res.status(400).send("Dados OAuth corrompidos.");
  }
  expectedState = parsedOAuthState.state;
  codeVerifier = parsedOAuthState.codeVerifier;

  try {
    const googleConfig = await getGoogleConfig();
    const currentUrl = new URL(req.originalUrl || req.url, getTrustedAppUrl().origin);

    const tokens = await openid.authorizationCodeGrant(googleConfig, currentUrl, {
      expectedState,
      pkceCodeVerifier: codeVerifier,
    });

    const claims = tokens.claims();
    if (!claims) {
      throw new Error("Não foi possível validar as credenciais do Google.");
    }

    const providerUserId = claims.sub as string;
    const email = claims.email as string;
    const name = (claims.name || "Google User") as string;
    const emailVerified = claims.email_verified as boolean;

    if (!email) {
      throw new Error("E-mail não fornecido pelo Google.");
    }
    if (emailVerified !== true) {
      await writeAuthFailureForEmail(req, email, 'Tentativa de login Google com e-mail não verificado.');
      return sendOAuthPage(res, { status: 403, title: 'Acesso não autorizado', message: 'O Google não confirmou este endereço de e-mail.' });
    }

    if (!(await isEnvironmentAccessAllowed(email))) {
      await writeAuthFailureForEmail(req, email, 'Tentativa de login Google bloqueada pela allowlist beta.');
      return sendOAuthPage(res, { status: 403, title: 'Acesso Não Autorizado', message: `O e-mail ${email} não está habilitado para este ambiente.` });
    }

    // 1. Check if OAuth account is already linked
    let oauthAccount = await prisma.oauthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId,
        },
      },
      include: { user: { include: { person: true, memberships: true } } },
    });

    let user = oauthAccount?.user;

    if (!user) {
      // 2. Lookup existing user by email
      let existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { person: true, memberships: true },
      });

      if (existingUser) {
        // Link account
        await prisma.oauthAccount.create({
          data: {
            userId: existingUser.id,
            provider: 'google',
            providerUserId,
            email,
          },
        });
        user = existingUser;
        await writeAuthAudit(req, user, AuditAction.auth_login, 'Conta Google vinculada ao usuário.', 'OauthAccount', providerUserId);
      } else {
        // 3. Check if a Person is pre-registered
        const existingPerson = await prisma.person.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });

        if (!existingPerson) {
          await writeAuthFailureForEmail(req, email, 'Tentativa de login Google sem pessoa ou usuário cadastrado.');
          return sendOAuthPage(res, { status: 403, title: 'Acesso Não Autorizado', message: `O e-mail ${email} não está habilitado para este ambiente.` });
        }

        // Create new User
        const newUser = await prisma.user.create({
          data: {
            email: email.trim().toLowerCase(),
            personId: existingPerson.id,
          },
        });

        // Link OAuth account
        await prisma.oauthAccount.create({
          data: {
            userId: newUser.id,
            provider: 'google',
            providerUserId,
            email,
          },
        });

        user = await prisma.user.findUnique({
          where: { id: newUser.id },
          include: { person: true, memberships: true },
        }) as any;
        await writeAuthAudit(req, user, AuditAction.auth_login, 'Conta Google vinculada a novo usuário.', 'OauthAccount', providerUserId);
      }
    }

    if (!user) {
      throw new Error("Erro ao carregar ou criar usuário.");
    }

    setSessionCookie(res, user);
    await writeAuthAudit(req, user, AuditAction.auth_login, 'Login Google realizado com sucesso.');

    const payloadUser = toAuthUserPayload(user);

    return sendOAuthPage(res, {
      title: 'Autenticação concluída',
      message: `Autenticado como ${payloadUser.name}. Esta janela fechará automaticamente.`,
      success: { type: 'GOOGLE_AUTH_SUCCESS', user: payloadUser },
    });
  } catch (error: any) {
    console.error("Google Callback Error:", error);
    return sendOAuthPage(res, { status: 500, title: 'Erro na autenticação', message: 'Não foi possível concluir a autenticação com o Google.' });
  }
});

// GET /api/v1/auth/microsoft/login
router.get('/microsoft/login', (_req, res) => res.status(501).json({
  code: 'MICROSOFT_OAUTH_UNAVAILABLE',
  error: 'Login com Microsoft indisponível durante o beta.',
}));

// GET /api/v1/auth/microsoft/callback
router.get('/microsoft/callback', (_req, res) => {
  res.clearCookie('gcv_oauth_state_ms');
  return res.status(501).json({
    code: 'MICROSOFT_OAUTH_UNAVAILABLE',
    error: 'Login com Microsoft indisponível durante o beta.',
  });
});

export default router;
