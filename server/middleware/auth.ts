import { Request, Response, NextFunction } from 'express';
import { MembershipStatus, PrismaClient, PlatformRole } from '@prisma/client';
import { hasPlatformAdminAccess } from '../services/system-admin';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isSystemAdmin: boolean;
    memberships: {
      accountId: string;
      condominiumId: string | null;
      role: PlatformRole;
      status: MembershipStatus;
    }[];
    pendingMemberships: {
      accountId: string;
      condominiumId: string | null;
      role: PlatformRole;
      status: MembershipStatus;
    }[];
  };
  authorizationContext?: {
    accountId?: string;
    condominiumId?: string;
    memberships: NonNullable<AuthenticatedRequest['user']>['memberships'];
  };
}

function membershipsForScope(
  memberships: NonNullable<AuthenticatedRequest['user']>['memberships'],
  accountId?: string,
  condominiumId?: string
) {
  return memberships.filter((membership) => {
    if (accountId && membership.accountId !== accountId) return false;
    if (!condominiumId) return true;
    return membership.condominiumId === condominiumId || membership.condominiumId === null;
  });
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
      isSystemAdmin: hasPlatformAdminAccess(user),
      memberships: user.memberships
        .filter((m) => m.status === MembershipStatus.active)
        .map((m) => ({
          accountId: m.accountId,
          condominiumId: m.condominiumId,
          role: m.role,
          status: m.status,
        })),
      pendingMemberships: user.memberships
        .filter((m) => m.status === MembershipStatus.pending)
        .map((m) => ({
        accountId: m.accountId,
        condominiumId: m.condominiumId,
        role: m.role,
          status: m.status,
        })),
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ error: "Erro de autenticação interna." });
  }
};

export const requireSystemAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (!req.user.isSystemAdmin) {
    return res.status(403).json({ error: 'Acesso restrito à administração do sistema.' });
  }
  next();
};

export const requireRole = (roles: PlatformRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (req.user.isSystemAdmin) {
      return next();
    }

    const scopedMemberships = req.authorizationContext?.memberships ?? req.user.memberships;
    const hasRole = scopedMemberships.some((membership) => roles.includes(membership.role));
    if (!hasRole) {
      return res.status(403).json({ error: "Acesso negado: permissões insuficientes." });
    }

    next();
  };
};

export const tenantGuard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const condoId = req.params.condoId;
  let accountId = req.params.accountId || (req.query.accountId as string | undefined);

  try {
    if (condoId) {
      const condominium = await prisma.condominium.findUnique({
        where: { id: condoId },
        select: { accountId: true },
      });
      if (!condominium) {
        return res.status(404).json({ error: "Condomínio não encontrado." });
      }
      if (accountId && accountId !== condominium.accountId) {
        return res.status(403).json({ error: "Acesso negado: escopo de conta inconsistente." });
      }
      accountId = condominium.accountId;
    }

    if (req.user.isSystemAdmin) {
      req.authorizationContext = {
        accountId,
        condominiumId: condoId,
        memberships: [{
          accountId: accountId || '',
          condominiumId: condoId || null,
          role: PlatformRole.syndic,
          status: MembershipStatus.active,
        }],
      };
      return next();
    }

    const scopedMemberships = membershipsForScope(req.user.memberships, accountId, condoId);
    if (scopedMemberships.length === 0) {
      const resource = condoId ? 'condomínio' : 'conta';
      return res.status(403).json({ error: `Acesso negado: você não pertence a este ${resource}.` });
    }

    req.authorizationContext = {
      accountId,
      condominiumId: condoId,
      memberships: scopedMemberships,
    };
    next();
  } catch (error) {
    console.error("Tenant Guard Error:", error);
    res.status(500).json({ error: "Erro ao validar o escopo de acesso." });
  }
};
