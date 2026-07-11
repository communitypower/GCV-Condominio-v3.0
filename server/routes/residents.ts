import { Router } from 'express';
import { PrismaClient, PlatformRole, RelationshipRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

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
  async (req, res) => {
    const { condoId } = req.params;
    const { name, email, phone, unitId, role } = req.body;

    try {
      const normalizedEmail = email.toLowerCase();
      const relationship = await prisma.$transaction(async (tx) => {
        const unit = await tx.unit.findFirst({
          where: { id: unitId, building: { condominiumId: condoId } },
          include: { building: { select: { condominium: { select: { accountId: true } } } } },
        });
        if (!unit) throw new Error('UNIT_NOT_IN_CONDOMINIUM');

        const existingPerson = await tx.person.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        const person = existingPerson
          ? await tx.person.update({ where: { id: existingPerson.id }, data: { name, phone } })
          : await tx.person.create({ data: { name, email: normalizedEmail, phone } });
        const existingUser = await tx.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existingUser?.personId && existingUser.personId !== person.id) {
          throw new Error('USER_PERSON_CONFLICT');
        }
        const user = existingUser
          ? await tx.user.update({ where: { id: existingUser.id }, data: { personId: person.id } })
          : await tx.user.create({
              data: { email: normalizedEmail, passwordHash: null, personId: person.id },
            });

        await tx.membership.upsert({
          where: {
            userId_accountId_condominiumId_role: {
              userId: user.id,
              accountId: unit.building.condominium.accountId,
              condominiumId: condoId,
              role: PlatformRole.resident,
            },
          },
          create: {
            userId: user.id,
            accountId: unit.building.condominium.accountId,
            condominiumId: condoId,
            role: PlatformRole.resident,
          },
          update: {},
        });

        const existingRelationship = await tx.unitRelationship.findFirst({
          where: { unitId, personId: person.id, role: role as RelationshipRole },
        });
        if (existingRelationship) {
          return tx.unitRelationship.update({
            where: { id: existingRelationship.id },
            data: { endDate: null },
            include: { person: true, unit: true },
          });
        }
        return tx.unitRelationship.create({
          data: { unitId, personId: person.id, role: role as RelationshipRole },
          include: { person: true, unit: true },
        });
      });

      res.status(201).json(relationship);
    } catch (error) {
      if (error instanceof Error && error.message === 'UNIT_NOT_IN_CONDOMINIUM') {
        return res.status(400).json({ error: "Unidade não encontrada neste condomínio." });
      }
      if (error instanceof Error && error.message === 'USER_PERSON_CONFLICT') {
        return res.status(409).json({ error: "E-mail já vinculado a outra pessoa." });
      }
      console.error("Create Resident Error:", error);
      res.status(500).json({ error: "Erro ao cadastrar morador." });
    }
  }
);

export default router;
