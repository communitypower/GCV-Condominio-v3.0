import { Router } from 'express';
import { PrismaClient, PlatformRole, UnitType, UnitStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

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
router.get('/:condoId/units', requireAuth, tenantGuard, async (req, res) => {
  const { condoId } = req.params;
  try {
    const units = await prisma.unit.findMany({
      where: {
        building: { condominiumId: condoId },
      },
      include: {
        building: true,
        relationships: {
          include: { person: true },
        },
      },
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
  async (req, res) => {
    const { condoId } = req.params;
    const { number, type, status, fractionalShare, buildingId } = req.body;

    try {
      const building = await prisma.building.findFirst({
        where: { id: buildingId, condominiumId: condoId },
      });

      if (!building) {
        return res.status(400).json({ error: "Edifício não encontrado neste condomínio." });
      }

      const unit = await prisma.unit.create({
        data: {
          number,
          type: type as UnitType,
          status: status as UnitStatus,
          fractionalShare,
          buildingId,
        },
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
      const existingUnit = await prisma.unit.findFirst({
        where: {
          id: unitId,
          building: { condominiumId: req.params.condoId },
        },
        include: { relationships: { include: { person: true } } },
      });

      if (!existingUnit) {
        return res.status(404).json({ error: "Unidade não encontrada." });
      }

      const updateData: any = {};
      if (status) updateData.status = status as UnitStatus;
      if (type) updateData.type = type as UnitType;
      if (fractionalShare !== undefined) updateData.fractionalShare = fractionalShare;

      const unit = await prisma.unit.update({
        where: { id: unitId },
        data: updateData,
      });

      // If owner details are provided, update/upsert the owner person record
      if (ownerName || ownerEmail || ownerPhone) {
        const ownerRel = existingUnit.relationships?.find(r => r.role === 'owner');
        if (ownerRel?.person) {
          await prisma.person.update({
            where: { id: ownerRel.person.id },
            data: {
              name: ownerName || ownerRel.person.name,
              email: ownerEmail || ownerRel.person.email,
              phone: ownerPhone || ownerRel.person.phone,
            },
          });
        }
      }

      res.json(unit);
    } catch (error) {
      console.error("Update Unit Error:", error);
      res.status(500).json({ error: "Erro ao atualizar unidade." });
    }
  }
);

export default router;
