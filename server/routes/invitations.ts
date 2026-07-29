import { InvitationStatus, PlatformRole, RelationshipRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { isDomainError } from '../services/domain-errors';
import {
  closeInvitation,
  createInvitation,
  listInvitations,
  resendInvitation,
} from '../services/invitations';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const manageRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager];

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional(),
  unitId: z.string().uuid().optional(),
  role: z.enum(PlatformRole).default(PlatformRole.resident),
  relationshipRole: z.enum(RelationshipRole).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

function handleError(res: any, error: unknown, operation: string) {
  if (isDomainError(error)) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`${operation} Error:`, error);
  return res.status(500).json({ error: `Erro ao ${operation.toLowerCase()}.` });
}

router.get(
  '/:condoId/invitations',
  requireAuth,
  tenantGuard,
  requireRole(manageRoles),
  async (req, res) => {
    try {
      res.json(await listInvitations(prisma, req.params.condoId));
    } catch (error) {
      handleError(res, error, 'List Invitations');
    }
  }
);

router.post(
  '/:condoId/invitations',
  requireAuth,
  tenantGuard,
  requireRole(manageRoles),
  validateBody(createSchema),
  async (req: any, res) => {
    try {
      const result = await createInvitation(prisma, {
        accountId: req.authorizationContext.accountId,
        condominiumId: req.params.condoId,
        ...req.body,
        invitedById: req.user.id,
        invitedByEmail: req.user.email,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error, 'Create Invitation');
    }
  }
);

router.post(
  '/:condoId/invitations/:invitationId/resend',
  requireAuth,
  tenantGuard,
  requireRole(manageRoles),
  async (req: any, res) => {
    try {
      res.json(await resendInvitation(prisma, {
        invitationId: req.params.invitationId,
        condominiumId: req.params.condoId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        ipAddress: req.ip,
      }));
    } catch (error) {
      handleError(res, error, 'Resend Invitation');
    }
  }
);

for (const action of ['cancel', 'revoke'] as const) {
  router.post(
    `/:condoId/invitations/:invitationId/${action}`,
    requireAuth,
    tenantGuard,
    requireRole(manageRoles),
    async (req: any, res) => {
      try {
        res.json(await closeInvitation(prisma, {
          invitationId: req.params.invitationId,
          condominiumId: req.params.condoId,
          actorId: req.user.id,
          actorEmail: req.user.email,
          action,
          ipAddress: req.ip,
        }));
      } catch (error) {
        handleError(res, error, `${action} Invitation`);
      }
    }
  );
}

router.get('/:condoId/invitations/statuses', (_req, res) => {
  res.json(Object.values(InvitationStatus));
});

export default router;
