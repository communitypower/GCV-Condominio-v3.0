import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as openid from 'openid-client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { person: true, memberships: true },
    });

    if (!user) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    // Set signed cookie (expires in 24h)
    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      message: "Autenticado com sucesso.",
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.name || "User",
        memberships: user.memberships,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Erro interno ao realizar login." });
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
    const user = await prisma.user.findUnique({
      where: { email },
      include: { person: true, memberships: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "Usuário mock não encontrado. Use um e-mail do seed (ex: sindico@gcv.com.br ou carlos.ramos@email.com).",
      });
    }

    // Set signed cookie (expires in 24h)
    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      message: "Autenticado com sucesso via mock login.",
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.name || "Mock User",
        memberships: user.memberships,
      },
    });
  } catch (error) {
    console.error("Mock Login Error:", error);
    res.status(500).json({ error: "Erro interno ao realizar login mock." });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('gcv_session');
  res.json({ message: "Desconectado com sucesso." });
});

// GET /api/v1/auth/me
router.get('/me', async (req, res) => {
  const sessionUserId = req.signedCookies?.gcv_session;
  if (!sessionUserId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      include: { person: true, memberships: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.name || "Mock User",
        memberships: user.memberships,
      },
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

let microsoftConfigCache: any = null;
async function getMicrosoftConfig() {
  if (!microsoftConfigCache) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    if (!clientId || !clientSecret) {
      throw new Error("MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET não configurados.");
    }
    microsoftConfigCache = await openid.discovery(
      new URL(`https://login.microsoftonline.com/${tenantId}/v2.0`),
      clientId,
      clientSecret
    );
  }
  return microsoftConfigCache;
}

// GET /api/v1/auth/google/login
router.get('/google/login', async (req, res) => {
  try {
    const googleConfig = await getGoogleConfig();
    const state = openid.randomState();
    const codeVerifier = openid.randomPKCECodeVerifier();
    const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);

    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    res.cookie('gcv_oauth_state', JSON.stringify({ state, codeVerifier, redirectUri }), {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
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
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
          <h2>Erro na Autenticação</h2>
          <p>Não foi possível iniciar o login com o Google: ${error.message}</p>
          <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
        </body>
      </html>
    `);
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
  let expectedRedirectUri: string;
  try {
    const parsed = JSON.parse(oauthCookie);
    expectedState = parsed.state;
    codeVerifier = parsed.codeVerifier;
    expectedRedirectUri = parsed.redirectUri;
  } catch (e) {
    return res.status(400).send("Dados OAuth corrompidos.");
  }

  try {
    const googleConfig = await getGoogleConfig();
    const currentUrl = new URL(req.originalUrl || req.url, `${req.protocol}://${req.get('host')}`);

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
      let existingUser = await prisma.user.findUnique({
        where: { email },
        include: { person: true, memberships: true },
      });

      if (existingUser) {
        if (emailVerified !== true) {
          throw new Error("E-mail do Google não verificado.");
        }
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
      } else {
        // 3. Check if a Person is pre-registered
        const existingPerson = await prisma.person.findUnique({
          where: { email },
        });

        if (!existingPerson) {
          return res.status(403).send(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
                <h2>Acesso Não Autorizado</h2>
                <p>O e-mail <strong>${email}</strong> não está cadastrado no sistema GCV.</p>
                <p style="color: #94A3B8; font-size: 13px;">Entre em contato com a administração do condomínio para obter um convite.</p>
                <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
              </body>
            </html>
          `);
        }

        // Create new User
        const newUser = await prisma.user.create({
          data: {
            email,
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
      }
    }

    if (!user) {
      throw new Error("Erro ao carregar ou criar usuário.");
    }

    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    const payloadUser = {
      id: user.id,
      email: user.email,
      name: user.person?.name || "User",
      memberships: user.memberships,
    };

    res.send(`
      <html>
        <head>
          <title>Autenticação Concluída</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; background: #0c0d10; color: #E2E8F0; }
            .loader { border: 4px solid #14161A; border-top: 4px solid #10b981; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h3 { color: #10B981; margin-top: 15px; }
            p { font-size: 13px; color: #94A3B8; }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <h3>Login realizado com sucesso!</h3>
          <p>Autenticado como: <strong>${payloadUser.name}</strong></p>
          <p>Esta janela fechará automaticamente...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                payload: {
                  user: ${JSON.stringify(payloadUser)}
                }
              }, '*');
              setTimeout(() => {
                window.close();
              }, 1200);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Google Callback Error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
          <h2>Erro na Autenticação</h2>
          <p>Não foi possível concluir a autenticação com o Google: ${error.message}</p>
          <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
        </body>
      </html>
    `);
  }
});

// GET /api/v1/auth/microsoft/login
router.get('/microsoft/login', async (req, res) => {
  try {
    const microsoftConfig = await getMicrosoftConfig();
    const state = openid.randomState();
    const codeVerifier = openid.randomPKCECodeVerifier();
    const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);

    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/microsoft/callback`;
    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    res.cookie('gcv_oauth_state_ms', JSON.stringify({ state, codeVerifier, redirectUri }), {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
      maxAge: 10 * 60 * 1000, // 10 minutes
      sameSite: 'lax',
    });

    const authorizationUrl = openid.buildAuthorizationUrl(microsoftConfig, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authorizationUrl.href);
  } catch (error: any) {
    console.error("Microsoft Auth URL Error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
          <h2>Erro na Autenticação</h2>
          <p>Não foi possível iniciar o login com a Microsoft: ${error.message}</p>
          <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
        </body>
      </html>
    `);
  }
});

// GET /api/v1/auth/microsoft/callback
router.get('/microsoft/callback', async (req, res) => {
  const oauthCookie = req.signedCookies?.gcv_oauth_state_ms;
  res.clearCookie('gcv_oauth_state_ms');

  if (!oauthCookie) {
    return res.status(400).send("Sessão OAuth expirada ou inválida.");
  }

  let expectedState: string;
  let codeVerifier: string;
  let expectedRedirectUri: string;
  try {
    const parsed = JSON.parse(oauthCookie);
    expectedState = parsed.state;
    codeVerifier = parsed.codeVerifier;
    expectedRedirectUri = parsed.redirectUri;
  } catch (e) {
    return res.status(400).send("Dados OAuth corrompidos.");
  }

  try {
    const microsoftConfig = await getMicrosoftConfig();
    const currentUrl = new URL(req.originalUrl || req.url, `${req.protocol}://${req.get('host')}`);

    const tokens = await openid.authorizationCodeGrant(microsoftConfig, currentUrl, {
      expectedState,
      pkceCodeVerifier: codeVerifier,
    });

    const claims = tokens.claims();
    if (!claims) {
      throw new Error("Não foi possível validar as credenciais do Microsoft.");
    }

    const providerUserId = claims.sub as string;
    const email = (claims.email || (claims as any).preferred_username) as string;
    const name = (claims.name || (claims as any).preferred_username || "Microsoft User") as string;
    const emailVerified = true; 

    if (!email) {
      throw new Error("E-mail não fornecido pela Microsoft.");
    }

    // 1. Check if OAuth account is already linked
    let oauthAccount = await prisma.oauthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'microsoft',
          providerUserId,
        },
      },
      include: { user: { include: { person: true, memberships: true } } },
    });

    let user = oauthAccount?.user;

    if (!user) {
      // 2. Lookup existing user by email
      let existingUser = await prisma.user.findUnique({
        where: { email },
        include: { person: true, memberships: true },
      });

      if (existingUser) {
        if (emailVerified !== true) {
          throw new Error("E-mail da Microsoft não verificado.");
        }
        // Link account
        await prisma.oauthAccount.create({
          data: {
            userId: existingUser.id,
            provider: 'microsoft',
            providerUserId,
            email,
          },
        });
        user = existingUser;
      } else {
        // 3. Check if a Person is pre-registered
        const existingPerson = await prisma.person.findUnique({
          where: { email },
        });

        if (!existingPerson) {
          return res.status(403).send(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
                <h2>Acesso Não Autorizado</h2>
                <p>O e-mail <strong>${email}</strong> não está cadastrado no sistema GCV.</p>
                <p style="color: #94A3B8; font-size: 13px;">Entre em contato com a administração do condomínio para obter um convite.</p>
                <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
              </body>
            </html>
          `);
        }

        // Create new User
        const newUser = await prisma.user.create({
          data: {
            email,
            personId: existingPerson.id,
          },
        });

        // Link OAuth account
        await prisma.oauthAccount.create({
          data: {
            userId: newUser.id,
            provider: 'microsoft',
            providerUserId,
            email,
          },
        });

        user = await prisma.user.findUnique({
          where: { id: newUser.id },
          include: { person: true, memberships: true },
        }) as any;
      }
    }

    if (!user) {
      throw new Error("Erro ao carregar ou criar usuário.");
    }

    const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
      secure: isProductionOrStaging,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    const payloadUser = {
      id: user.id,
      email: user.email,
      name: user.person?.name || "User",
      memberships: user.memberships,
    };

    res.send(`
      <html>
        <head>
          <title>Autenticação Concluída</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; background: #0c0d10; color: #E2E8F0; }
            .loader { border: 4px solid #14161A; border-top: 4px solid #10b981; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h3 { color: #10B981; margin-top: 15px; }
            p { font-size: 13px; color: #94A3B8; }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <h3>Login realizado com sucesso!</h3>
          <p>Autenticado como: <strong>${payloadUser.name}</strong></p>
          <p>Esta janela fechará automaticamente...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'MICROSOFT_AUTH_SUCCESS', 
                payload: {
                  user: ${JSON.stringify(payloadUser)}
                }
              }, '*');
              setTimeout(() => {
                window.close();
              }, 1200);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Microsoft Callback Error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
          <h2>Erro na Autenticação</h2>
          <p>Não foi possível concluir a autenticação com a Microsoft: ${error.message}</p>
          <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
        </body>
      </html>
    `);
  }
});

export default router;
