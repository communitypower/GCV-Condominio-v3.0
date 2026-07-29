import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireSystemAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { isDomainError } from '../services/domain-errors';
import { acceptInvitation, inspectInvitation } from '../services/invitations';
import { onboardCondominium } from '../services/onboarding';

const router = Router();
const prisma = new PrismaClient();
const isProductionLike = () => process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

function setSessionCookie(res: any, userId: string) {
  res.cookie('gcv_session', userId, {
    httpOnly: true,
    signed: true,
    secure: isProductionLike(),
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });
}

const publicAcceptSchema = z.object({
  password: z.string().min(10).max(128),
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});
const authenticatedAcceptSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});
const onboardingSchema = z.object({
  accountName: z.string().trim().min(1).max(160),
  condominiumName: z.string().trim().min(1).max(160),
  condominiumAddress: z.string().trim().min(1).max(300),
  syndicName: z.string().trim().min(1).max(160),
  syndicEmail: z.string().trim().email().max(254),
  syndicPhone: z.string().trim().max(40).optional(),
});

function handleError(res: any, error: unknown, operation: string) {
  if (isDomainError(error)) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`${operation} Error:`, error);
  return res.status(500).json({ error: `Erro ao ${operation.toLowerCase()}.` });
}

router.get('/invitations/:token', async (req, res) => {
  try {
    res.json(await inspectInvitation(prisma, req.params.token));
  } catch (error) {
    handleError(res, error, 'Inspect Invitation');
  }
});

router.post(
  '/invitations/:token/accept',
  validateBody(publicAcceptSchema),
  async (req, res) => {
    try {
      const accepted = await acceptInvitation(prisma, {
        token: req.params.token,
        ...req.body,
        ipAddress: req.ip,
      });
      if (accepted.acceptedById) setSessionCookie(res, accepted.acceptedById);
      res.json(accepted);
    } catch (error) {
      handleError(res, error, 'Accept Invitation');
    }
  }
);

router.post(
  '/invitations/:token/accept-existing',
  requireAuth,
  validateBody(authenticatedAcceptSchema),
  async (req: any, res) => {
    try {
      res.json(await acceptInvitation(prisma, {
        token: req.params.token,
        authenticatedUserId: req.user.id,
        ...req.body,
        ipAddress: req.ip,
      }));
    } catch (error) {
      handleError(res, error, 'Accept Existing Account Invitation');
    }
  }
);

router.post(
  '/system/condominiums',
  requireAuth,
  requireSystemAdmin,
  validateBody(onboardingSchema),
  async (req: any, res) => {
    try {
      const result = await onboardCondominium(prisma, {
        ...req.body,
        actorId: req.user.id,
        actorEmail: req.user.email,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error, 'Onboard Condominium');
    }
  }
);

export default router;
