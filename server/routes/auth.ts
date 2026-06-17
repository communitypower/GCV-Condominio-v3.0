import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
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
    res.cookie('gcv_session', user.id, {
      httpOnly: true,
      signed: true,
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

export default router;
