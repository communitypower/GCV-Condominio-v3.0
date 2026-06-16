import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

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

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || "gcv_local_secret"));

// API Router Mounts
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/condominiums", condosRouter);
app.use("/api/v1/condominiums", buildingsRouter);
app.use("/api/v1/condominiums", unitsRouter);
app.use("/api/v1/condominiums", residentsRouter);
app.use("/api/v1/condominiums", maintenanceRouter);
app.use("/api/v1/condominiums", billingRouter);
app.use("/api/v1/condominiums", equipmentRouter);
app.use("/api/v1/condominiums", documentsRouter);
app.use("/api/v1/accounts", auditRouter);

const PORT = 3000;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Middleware to restrict GitHub integration
const checkGithubIntegration = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.ENABLE_GITHUB_INTEGRATION !== "true") {
    return res.status(403).json({ error: "Integração com GitHub desabilitada neste ambiente." });
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
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { prompt, contextData } = req.body;
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
app.get("/api/auth/github/url", checkGithubIntegration, (req, res) => {
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
app.post("/api/github/create-gist", checkGithubIntegration, async (req, res) => {
  const { token, filename, content, description } = req.body;
  if (!token) {
    return res.status(401).json({ error: "Não autorizado: token ausente." });
  }
  try {
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
app.get("/api/github/repos", checkGithubIntegration, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token ausente" });
  }
  try {
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

// Vite middleware flow
async function setupVite() {
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "staging") {
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to start server", err);
});
