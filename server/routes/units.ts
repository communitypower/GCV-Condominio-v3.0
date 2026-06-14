import { Router } from 'express';
import { PrismaClient, PlatformRole, UnitType, UnitStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
  async (req, res) => {
    const { condoId } = req.params;
    const { number, type, status, fractionalShare, buildingId } = req.body;

    if (!number || !type || !status || fractionalShare === undefined || !buildingId) {
      return res.status(400).json({ error: "Número, tipo, status, fração ideal e buildingId são obrigatórios." });
    }

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
          fractionalShare: parseFloat(fractionalShare),
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
  async (req, res) => {
    const { unitId } = req.params;
    const { status, type, fractionalShare, ownerName, ownerEmail, ownerPhone } = req.body;

    try {
      const existingUnit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { relationships: { include: { person: true } } },
      });

      if (!existingUnit) {
        return res.status(404).json({ error: "Unidade não encontrada." });
      }

      const updateData: any = {};
      if (status) updateData.status = status as UnitStatus;
      if (type) updateData.type = type as UnitType;
      if (fractionalShare !== undefined) updateData.fractionalShare = parseFloat(fractionalShare);

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
