import { Router } from 'express';
import { PrismaClient, PlatformRole, RelationshipRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';
import { createInvitation } from '../services/invitations';
import { isDomainError } from '../services/domain-errors';

const router = Router();
const prisma = new PrismaClient();

const createResidentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(3).max(40),
  unitId: z.string().uuid(),
  role: z.enum(RelationshipRole),
});

const staffRoles = [
  PlatformRole.admin,
  PlatformRole.syndic,
  PlatformRole.manager,
  PlatformRole.council_member,
  PlatformRole.accountant,
  PlatformRole.doorman,
  PlatformRole.vendor,
];

router.get('/:condoId/team', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]), async (req: any, res) => {
  try {
    const accountId = req.authorizationContext?.accountId;
    const memberships = await prisma.membership.findMany({
      where: {
        accountId,
        status: 'active',
        role: { in: staffRoles },
        OR: [{ condominiumId: req.params.condoId }, { condominiumId: null }],
      },
      include: { user: { include: { person: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      email: membership.user.email,
      name: membership.user.person?.name || membership.user.email,
      phone: membership.user.person?.phone || null,
    })));
  } catch (error) {
    console.error('Fetch Team Error:', error);
    res.status(500).json({ error: 'Erro ao buscar equipe do condomínio.' });
  }
});

// GET /api/v1/condominiums/:condoId/residents
router.get('/:condoId/residents', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId } = req.params;
  try {
    const staffRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager];
    const isStaff = req.authorizationContext.memberships.some((membership: any) =>
      staffRoles.includes(membership.role)
    );
    const relationships = await prisma.unitRelationship.findMany({
      where: {
        unit: { building: { condominiumId: condoId } },
        endDate: null,
        ...(isStaff ? {} : { person: { user: { id: req.user.id } } }),
      },
      include: {
        person: true,
        unit: { include: { building: true } },
      },
    });
    res.json(relationships);
  } catch (error) {
    console.error("Fetch Residents Error:", error);
    res.status(500).json({ error: "Erro ao buscar moradores." });
  }
});

// POST /api/v1/condominiums/:condoId/residents
router.post(
  '/:condoId/residents',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  validateBody(createResidentSchema),
  async (req: any, res) => {
    const { condoId } = req.params;
    const { name, email, phone, unitId, role } = req.body;

    try {
      const result = await createInvitation(prisma, {
        accountId: req.authorizationContext.accountId,
        condominiumId: condoId,
        unitId,
        email,
        name,
        phone,
        role: PlatformRole.resident,
        relationshipRole: role as RelationshipRole,
        invitedById: req.user.id,
        invitedByEmail: req.user.email,
        ipAddress: req.ip,
      });
      res.status(202).json(result);
    } catch (error) {
      if (isDomainError(error)) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      console.error("Create Resident Error:", error);
      res.status(500).json({ error: "Erro ao convidar morador." });
    }
  }
);

export default router;
