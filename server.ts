import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { AuditAction, PrismaClient } from "@prisma/client";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "crypto";

import authRouter from "./server/routes/auth";
import condosRouter from "./server/routes/condominiums";
import buildingsRouter from "./server/routes/buildings";
import unitsRouter from "./server/routes/units";
import residentsRouter from "./server/routes/residents";
import maintenanceRouter from "./server/routes/maintenance";
import billingRouter from "./server/routes/billing";
import equipmentRouter from "./server/routes/equipment";
import documentsRouter from "./server/routes/documents";
import auditRouter from "./server/routes/audit";
import testingRouter from "./server/routes/testing";
import importsRouter from "./server/routes/imports";
import procurementRouter from "./server/routes/procurement";
import paymentsRouter from "./server/routes/payments";
import announcementsRouter from "./server/routes/announcements";
import { requireAuth } from "./server/middleware/auth";
import { createCsrfProtection } from "./server/middleware/csrf";

dotenv.config();

const prisma = new PrismaClient();
const ENVIRONMENT = process.env.NODE_ENV || "development";
const isProductionLike = ENVIRONMENT === "production" || ENVIRONMENT === "staging";
const shouldServeStatic = isProductionLike || ENVIRONMENT === "test";
const PORT = parseInt(process.env.PORT || "3000", 10);
const httpRequestCounts = new Map<string, number>();
const httpRequestDurationMs = new Map<string, number>();

function assertRequiredEnv() {
  const required = ["DATABASE_URL"];

  if (isProductionLike) {
    required.push(
      "APP_URL",
      "SESSION_SECRET",
      "BETA_ALLOWED_EMAILS",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID"
    );
  }

  if (process.env.ENABLE_AI_ASSISTANT === "true") {
    required.push("GEMINI_API_KEY");
  }

  if (process.env.ENABLE_GITHUB_INTEGRATION === "true") {
    required.push("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (!Number.isInteger(PORT) || PORT <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }
}

assertRequiredEnv();

const app = express();
app.set('trust proxy', 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  const requestId = req.get("x-request-id") || randomUUID();
  res.setHeader("x-request-id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    const latencyMs = Date.now() - startedAt;
    const metricKey = `${req.method}|${res.statusCode}`;
    httpRequestCounts.set(metricKey, (httpRequestCounts.get(metricKey) || 0) + 1);
    httpRequestDurationMs.set(metricKey, (httpRequestDurationMs.get(metricKey) || 0) + latencyMs);

    console.log(JSON.stringify({
      level: "info",
      event: "http_request",
      requestId,
      environment: ENVIRONMENT,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
    }));
  });

  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(process.env.SESSION_SECRET || "gcv_local_secret"));
app.use(createCsrfProtection({
  enabled: isProductionLike,
  appUrl: process.env.APP_URL,
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProductionLike ? 20 : 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProductionLike ? 20 : 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use(generalLimiter);

// API Router Mounts
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/condominiums", condosRouter);
app.use("/api/v1/condominiums", buildingsRouter);
app.use("/api/v1/condominiums", unitsRouter);
app.use("/api/v1/condominiums", residentsRouter);
app.use("/api/v1/condominiums", maintenanceRouter);
app.use("/api/v1/condominiums", billingRouter);
app.use("/api/v1/condominiums", equipmentRouter);
app.use("/api/v1/condominiums", documentsRouter);
app.use("/api/v1/condominiums", importsRouter);
app.use("/api/v1/condominiums", procurementRouter);
app.use("/api/v1/condominiums", paymentsRouter);
app.use("/api/v1/condominiums", announcementsRouter);
app.use("/api/v1/accounts", auditRouter);
app.use("/api/v1/testing", testingRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get("/livez", (req, res) => {
  res.json({
    status: "alive",
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString()
  });
});

app.get("/readyz", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ready",
      environment: ENVIRONMENT,
      checks: {
        database: "ok"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Readiness check failed:", error);
    res.status(503).json({
      status: "not_ready",
      environment: ENVIRONMENT,
      checks: {
        database: "failed"
      },
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/metrics", (req, res) => {
  const lines = [
    "# HELP gcv_process_uptime_seconds Process uptime in seconds.",
    "# TYPE gcv_process_uptime_seconds gauge",
    `gcv_process_uptime_seconds ${process.uptime().toFixed(3)}`,
    "# HELP gcv_http_requests_total Total HTTP requests by method and status.",
    "# TYPE gcv_http_requests_total counter",
  ];

  for (const [key, count] of httpRequestCounts.entries()) {
    const [method, status] = key.split("|");
    lines.push(`gcv_http_requests_total{method="${method}",status="${status}"} ${count}`);
  }

  lines.push(
    "# HELP gcv_http_request_duration_ms_sum Total HTTP request duration in milliseconds by method and status.",
    "# TYPE gcv_http_request_duration_ms_sum counter"
  );

  for (const [key, duration] of httpRequestDurationMs.entries()) {
    const [method, status] = key.split("|");
    lines.push(`gcv_http_request_duration_ms_sum{method="${method}",status="${status}"} ${duration}`);
  }

  lines.push(
    "# HELP gcv_http_request_duration_ms_count HTTP request duration sample count by method and status.",
    "# TYPE gcv_http_request_duration_ms_count counter"
  );

  for (const [key, count] of httpRequestCounts.entries()) {
    const [method, status] = key.split("|");
    lines.push(`gcv_http_request_duration_ms_count{method="${method}",status="${status}"} ${count}`);
  }

  res.type("text/plain").send(`${lines.join("\n")}\n`);
});

type FeatureName = "AI_ASSISTANT" | "GITHUB_INTEGRATION" | "DEMO_EXPORTS";

async function auditFeatureAttempt(req: any, feature: FeatureName, details: string, entityId?: string) {
  const user = req.user;
  if (!user?.memberships?.length) return;

  const accountIds: string[] = [...new Set(user.memberships.map((membership: any) => membership.accountId).filter(Boolean) as string[])];
  await Promise.all(accountIds.map((accountId) =>
    prisma.auditEvent.create({
      data: {
        accountId,
        userId: user.id,
        userEmail: user.email,
        action: AuditAction.export,
        entity: feature,
        entityId,
        details,
        ipAddress: req.ip,
      },
    })
  ));
}

// Middleware to restrict GitHub integration
const checkGithubIntegration = async (req: any, res: express.Response, next: express.NextFunction) => {
  if (process.env.ENABLE_GITHUB_INTEGRATION !== "true") {
    await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "Tentativa bloqueada: integração GitHub desabilitada.");
    return res.status(403).json({ error: "Integração com GitHub desabilitada neste ambiente." });
  }
  next();
};

const checkDemoExports = async (req: any, res: express.Response, next: express.NextFunction) => {
  if (process.env.ENABLE_DEMO_EXPORTS !== "true") {
    await auditFeatureAttempt(req, "DEMO_EXPORTS", "Tentativa bloqueada: exportações demo desabilitadas.");
    return res.status(403).json({ error: "Exportações demo desabilitadas neste ambiente." });
  }
  next();
};

// Lazy initialize GoogleGenAI with warning on missing key
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Endpoint to interact with Gemini
app.post("/api/gemini/chat", sensitiveLimiter, requireAuth, async (req: any, res) => {
  try {
    if (process.env.ENABLE_AI_ASSISTANT !== "true") {
      await auditFeatureAttempt(req, "AI_ASSISTANT", "Tentativa bloqueada: assistente de IA desabilitado.");
      return res.status(403).json({ error: "Assistente de IA desabilitado neste ambiente." });
    }

    const { prompt, contextData } = req.body;
    await auditFeatureAttempt(req, "AI_ASSISTANT", "Consulta enviada ao assistente de IA.");
    const ai = getGeminiClient();

    const edificioNome = contextData?.edificioNome || "Condomínio Bella Vista Premium";
    const systemInstruction = `Você é o "G.C.V. Engenheiro Assistente IA", um analista e consultor inteligente de engenharia predial e gestão condominiável de alto padrão do ${edificioNome} (GCV).
Sua missão é ajudar os síndicos, zeladores e moradores analisando dados cadastrais, ordens de serviço, finanças e manutenção predial.

Aqui está o conjunto completo de dados ATUAIS do condomínio em formato JSON para você realizar suas consultas e análises:
${JSON.stringify(contextData || {}, null, 2)}

Instruções importantes:
1. Sempre responda em português brasileiro formatado de forma limpa, direta, encorajadora e profissional com Markdown elegante.
2. Seja preciso ao consultar os dados fornecidos. Se perguntarem pela taxa de adimplência, unidades atrasadas, equipamentos críticos ou ordens de serviço pendentes, consulte diretamente estes registros no JSON recebido.
3. Se solicitado um relatório (financeiro, operacional, inventário ou de planos), gere-o com uma estrutura profissional contendo resumo executivo, detalhamento estatístico e recomendações técnicas claras de engenharia ou finanças.
4. Evite inventar informações que contrariem o estado real dos dados no JSON.
5. Seja focado em soluções de engenharia predial preventiva e melhores práticas de economia condominial.`;

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    // Process chat using generateContent with system instruction
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Erro ao consultar a Inteligência Artificial. Verifique a chave de API." });
  }
});

// GET /api/auth/github/url
app.get("/api/auth/github/url", sensitiveLimiter, requireAuth, checkGithubIntegration, async (req: any, res) => {
  const redirectUri = (req.query.redirectUri as string) || `${req.protocol}://${req.get("host")}/auth/callback`;
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID;

  if (!clientId) {
    return res.status(400).json({ error: "As chaves GITHUB_CLIENT_ID não estão configuradas nas variáveis do AI Studio." });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user,user:email,gist",
    state: Math.random().toString(36).substring(7),
  });

  await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "URL de OAuth GitHub gerada.");
  res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
});

// GET /auth/callback & /auth/callback/
const callbackHandler = async (req: any, res: any) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("No code provided.");
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.CLIENT_SECRET;

  try {
    // Exchange code for token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Unable to fetch access token from GitHub: " + JSON.stringify(tokenData));
    }

    // Fetch user details from GitHub Profile Api
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": "aistudio-build-github-oauth",
      },
    });

    const userData = (await userResponse.json()) as any;

    // Send success html back to opener window and close
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
          <h3>Conexão obtida com sucesso!</h3>
          <p>Autenticado como: <strong>${userData.name || userData.login}</strong></p>
          <p>Esta janela fechará automaticamente...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                payload: {
                  token: ${JSON.stringify(accessToken)},
                  username: ${JSON.stringify(userData.login)},
                  name: ${JSON.stringify(userData.name || userData.login)},
                  avatarUrl: ${JSON.stringify(userData.avatar_url)},
                  profileUrl: ${JSON.stringify(userData.html_url)},
                  email: ${JSON.stringify(userData.email || '')},
                  publicRepos: ${JSON.stringify(userData.public_repos || 0)},
                  followers: ${JSON.stringify(userData.followers || 0)}
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
    console.error("OAuth callback error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 45px; background: #0c0d10; color: #EF4444;">
          <h2>Erro na Autenticação</h2>
          <p>Não foi possível concluir a autenticação com o GitHub: ${error.message}</p>
          <button onclick="window.close()" style="margin-top: 15px; padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Fechar Janela</button>
        </body>
      </html>
    `);
  }
};

app.get("/auth/callback", checkGithubIntegration, callbackHandler);
app.get("/auth/callback/", checkGithubIntegration, callbackHandler);

// POST /api/github/create-gist
app.post("/api/github/create-gist", sensitiveLimiter, requireAuth, checkGithubIntegration, async (req: any, res) => {
  const { token, filename, content, description } = req.body;
  if (!token) {
    await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "Tentativa de criação de Gist sem token GitHub.");
    return res.status(401).json({ error: "Não autorizado: token ausente." });
  }
  try {
    await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "Tentativa de criação de Gist privado.", filename);
    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "aistudio-build-github-oauth",
      },
      body: JSON.stringify({
        description: description || "Relatório de Engenharia Predial GCV",
        public: false,
        files: {
          [filename || "relatorio-gcv.md"]: {
            content: content || "# Relatório GCV",
          },
        },
      }),
    });
    const data = (await response.json()) as any;
    if (response.status !== 201) {
      throw new Error(data.message || "Erro desconhecido ao cadastrar Gist");
    }
    res.json({ url: data.html_url, id: data.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos
app.get("/api/github/repos", sensitiveLimiter, requireAuth, checkGithubIntegration, async (req: any, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "Tentativa de listar repositórios sem token GitHub.");
    return res.status(401).json({ error: "Token ausente" });
  }
  try {
    await auditFeatureAttempt(req, "GITHUB_INTEGRATION", "Listagem de repositórios GitHub solicitada.");
    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=10", {
      headers: {
        Authorization: authHeader,
        "User-Agent": "aistudio-build-github-oauth",
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/demo/github-profile", sensitiveLimiter, requireAuth, checkDemoExports, async (req: any, res) => {
  await auditFeatureAttempt(req, "DEMO_EXPORTS", "Perfil demo GitHub solicitado.");
  res.json({
    token: "demo_token_gcv_active_session",
    profile: {
      username: "gcv-demo",
      name: "GCV Demo",
      avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
      profileUrl: "https://github.com/gcv-demo",
      email: "",
      publicRepos: 5,
      followers: 0,
      isDemo: true,
    },
  });
});

app.post("/api/demo/create-gist", sensitiveLimiter, requireAuth, checkDemoExports, async (req: any, res) => {
  await auditFeatureAttempt(req, "DEMO_EXPORTS", "Gist demo simulado gerado.");
  res.json({
    url: "https://gist.github.com/gcv-demo/demo-gist-created-for-condominium-reports",
    id: "demo-gist-created-for-condominium-reports",
  });
});

// Fallback for unmatched API routes
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "Endpoint de API não encontrado." });
});

// Vite middleware flow
async function setupVite() {
  if (!shouldServeStatic) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}).catch((err) => {
  console.error("Failed to start server", err);
  prisma.$disconnect().finally(() => {
    process.exit(1);
  });
});
