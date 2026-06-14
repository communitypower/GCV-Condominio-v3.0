import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    memberships: {
      accountId: string;
      condominiumId: string | null;
      role: PlatformRole;
    }[];
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Read signed cookie
  const sessionUserId = req.signedCookies?.gcv_session;

  if (!sessionUserId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado ou sessão inválida." });
    }

    req.user = {
      id: user.id,
      email: user.email,
      memberships: user.memberships.map((m) => ({
        accountId: m.accountId,
        condominiumId: m.condominiumId,
        role: m.role,
      })),
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ error: "Erro de autenticação interna." });
  }
};

export const requireRole = (roles: PlatformRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    // Admins bypass all role checks
    const isAdmin = req.user.memberships.some((m) => m.role === PlatformRole.admin);
    if (isAdmin) {
      return next();
    }

    const hasRole = req.user.memberships.some((m) => roles.includes(m.role));
    if (!hasRole) {
      return res.status(403).json({ error: "Acesso negado: permissões insuficientes." });
    }

    next();
  };
};

export const tenantGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const condoId = req.params.condoId;
  const accountId = req.params.accountId || (req.query.accountId as string);

  // Platform admin bypass
  const isAdmin = req.user.memberships.some((m) => m.role === PlatformRole.admin);
  if (isAdmin) {
    return next();
  }

  // Scoped check for condominium access
  if (condoId) {
    const hasCondoAccess = req.user.memberships.some((m) => m.condominiumId === condoId);
    if (!hasCondoAccess) {
      return res.status(403).json({ error: "Acesso negado: você não pertence a este condomínio." });
    }
  }

  // Scoped check for account access
  if (accountId) {
    const hasAccountAccess = req.user.memberships.some((m) => m.accountId === accountId);
    if (!hasAccountAccess) {
      return res.status(403).json({ error: "Acesso negado: você não pertence a esta conta." });
    }
  }

  next();
};
