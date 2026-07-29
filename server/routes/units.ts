import { Router } from 'express';
import { Prisma, PrismaClient, PlatformRole, UnitType, UnitStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const unitManagementRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager];

const createUnitSchema = z.object({
  number: z.string().trim().min(1).max(40),
  type: z.enum(UnitType),
  status: z.enum(UnitStatus),
  fractionalShare: z.coerce.number().positive(),
  buildingId: z.string().uuid(),
});

const updateUnitSchema = z.object({
  status: z.enum(UnitStatus).optional(),
  type: z.enum(UnitType).optional(),
  fractionalShare: z.coerce.number().positive().optional(),
  ownerName: z.string().trim().min(1).max(160).optional(),
  ownerEmail: z.string().trim().email().max(254).optional(),
  ownerPhone: z.string().trim().min(3).max(40).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Ao menos um campo deve ser informado.',
});

// GET /api/v1/condominiums/:condoId/units
router.get('/:condoId/units', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId } = req.params;
  try {
    const isManagement = req.authorizationContext.memberships.some((membership: any) =>
      unitManagementRoles.includes(membership.role)
    );
    const relationshipWhere = isManagement
      ? { endDate: null }
      : { endDate: null, person: { user: { id: req.user.id } } };

    const units = await prisma.unit.findMany({
      where: {
        building: { condominiumId: condoId },
        ...(!isManagement ? { relationships: { some: relationshipWhere } } : {}),
      },
      include: {
        building: true,
        relationships: {
          where: relationshipWhere,
          include: {
            person: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
      orderBy: [{ building: { name: 'asc' } }, { number: 'asc' }],
    });
    res.json(units);
  } catch (error) {
    console.error("Fetch Units Error:", error);
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});

// POST /api/v1/condominiums/:condoId/units
router.post(
  '/:condoId/units',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  validateBody(createUnitSchema),
  async (req: any, res) => {
    const { condoId } = req.params;
    const { number, type, status, fractionalShare, buildingId } = req.body;

    try {
      const building = await prisma.building.findFirst({
        where: { id: buildingId, condominiumId: condoId },
      });

      if (!building) {
        return res.status(400).json({ error: "Edifício não encontrado neste condomínio." });
      }

      const unit = await prisma.$transaction(async (tx) => {
        const created = await tx.unit.create({
          data: {
            number,
            type: type as UnitType,
            status: status as UnitStatus,
            fractionalShare,
            buildingId,
          },
        });
        await tx.auditEvent.create({
          data: {
            accountId: req.authorizationContext.accountId,
            condominiumId: condoId,
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'create',
            entity: 'Unit',
            entityId: created.id,
            details: `Unidade ${number} criada no bloco ${building.name}.`,
            ipAddress: req.ip,
          },
        });
        return created;
      });
      res.status(201).json(unit);
    } catch (error) {
      console.error("Create Unit Error:", error);
      res.status(500).json({ error: "Erro ao criar unidade." });
    }
  }
);

// PATCH /api/v1/condominiums/:condoId/units/:unitId
router.patch(
  '/:condoId/units/:unitId',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  validateBody(updateUnitSchema),
  async (req, res) => {
    const { unitId } = req.params;
    const { status, type, fractionalShare, ownerName, ownerEmail, ownerPhone } = req.body;

    try {
      const unit = await prisma.$transaction(async (tx) => {
        const existingUnit = await tx.unit.findFirst({
          where: {
            id: unitId,
            building: { condominiumId: req.params.condoId },
          },
          include: {
            relationships: {
              where: { role: 'owner', endDate: null },
              include: {
                person: {
                  include: {
                    user: { select: { id: true } },
                    relationships: { select: { id: true } },
                  },
                },
              },
            },
          },
        });

        if (!existingUnit) throw new Error('UNIT_NOT_FOUND');

        const updateData: any = {};
        if (status) updateData.status = status as UnitStatus;
        if (type) updateData.type = type as UnitType;
        if (fractionalShare !== undefined) updateData.fractionalShare = fractionalShare;

        const updatedUnit = await tx.unit.update({
          where: { id: unitId },
          data: updateData,
        });

        if (ownerName || ownerEmail || ownerPhone) {
          const ownerRel = existingUnit.relationships[0];
          if (!ownerRel) throw new Error('ACTIVE_OWNER_NOT_FOUND');

          const identityIsShared =
            Boolean(ownerRel.person.user) ||
            ownerRel.person.relationships.some((relationship) => relationship.id !== ownerRel.id);
          if (identityIsShared) throw new Error('SHARED_OWNER_IDENTITY');

          await tx.person.update({
            where: { id: ownerRel.person.id },
            data: {
              ...(ownerName ? { name: ownerName } : {}),
              ...(ownerEmail ? { email: ownerEmail.trim().toLowerCase() } : {}),
              ...(ownerPhone ? { phone: ownerPhone } : {}),
            },
          });
        }

        return updatedUnit;
      });
      res.json(unit);
    } catch (error) {
      if (error instanceof Error && error.message === 'UNIT_NOT_FOUND') {
        return res.status(404).json({ error: "Unidade não encontrada." });
      }
      if (error instanceof Error && error.message === 'ACTIVE_OWNER_NOT_FOUND') {
        return res.status(409).json({ error: "A unidade não possui proprietário ativo para atualização." });
      }
      if (error instanceof Error && error.message === 'SHARED_OWNER_IDENTITY') {
        return res.status(409).json({
          error: "A identidade do proprietário possui conta ou vínculos compartilhados e deve ser atualizada pelo cadastro de moradores.",
        });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ error: "O e-mail informado já pertence a outra pessoa." });
      }
      console.error("Update Unit Error:", error);
      res.status(500).json({ error: "Erro ao atualizar unidade." });
    }
  }
);

export default router;
