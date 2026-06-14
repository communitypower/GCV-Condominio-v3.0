import { Router } from 'express';
import { PrismaClient, PlatformRole, EquipmentStatus, PlanFrequency, PlanStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/condominiums/:condoId/equipment
router.get('/:condoId/equipment', requireAuth, tenantGuard, async (req, res) => {
  const { condoId } = req.params;
  try {
    const equipment = await prisma.equipment.findMany({
      where: { condominiumId: condoId },
      orderBy: { name: 'asc' },
    });
    res.json(equipment);
  } catch (error) {
    console.error("Fetch Equipment Error:", error);
    res.status(500).json({ error: "Erro ao buscar equipamentos." });
  }
});

// POST /api/v1/condominiums/:condoId/equipment
router.post(
  '/:condoId/equipment',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { condoId } = req.params;
    const { name, location, category, status, lastInspection, nextInspection, installDate } = req.body;

    if (!name || !location || !category || !status) {
      return res.status(400).json({ error: "Nome, localização, categoria e status são obrigatórios." });
    }

    try {
      const equipment = await prisma.equipment.create({
        data: {
          condominiumId: condoId,
          name,
          location,
          category,
          status: status as EquipmentStatus,
          lastInspection: lastInspection ? new Date(lastInspection) : new Date(),
          nextInspection: nextInspection ? new Date(nextInspection) : new Date(),
          installDate: installDate ? new Date(installDate) : new Date(),
        },
      });
      res.status(201).json(equipment);
    } catch (error) {
      console.error("Create Equipment Error:", error);
      res.status(500).json({ error: "Erro ao cadastrar equipamento." });
    }
  }
);

// GET /api/v1/condominiums/:condoId/plans
router.get('/:condoId/plans', requireAuth, tenantGuard, async (req, res) => {
  const { condoId } = req.params;
  try {
    const plans = await prisma.maintenancePlan.findMany({
      where: { condominiumId: condoId },
      include: { equipment: true },
      orderBy: { nextOccurrence: 'asc' },
    });
    res.json(plans);
  } catch (error) {
    console.error("Fetch Plans Error:", error);
    res.status(500).json({ error: "Erro ao buscar planos de manutenção." });
  }
});

// POST /api/v1/condominiums/:condoId/plans
router.post(
  '/:condoId/plans',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { condoId } = req.params;
    const { equipmentId, title, description, frequency, nextOccurrence, status } = req.body;

    if (!title || !description || !frequency || !nextOccurrence || !status) {
      return res.status(400).json({ error: "Título, descrição, frequência, próxima ocorrência e status são obrigatórios." });
    }

    try {
      if (equipmentId) {
        const eqExists = await prisma.equipment.findFirst({
          where: { id: equipmentId, condominiumId: condoId },
        });
        if (!eqExists) {
          return res.status(400).json({ error: "Equipamento inválido para este condomínio." });
        }
      }

      const plan = await prisma.maintenancePlan.create({
        data: {
          condominiumId: condoId,
          equipmentId: equipmentId || null,
          title,
          description,
          frequency: frequency as PlanFrequency,
          nextOccurrence: new Date(nextOccurrence),
          status: status as PlanStatus,
        },
      });
      res.status(201).json(plan);
    } catch (error) {
      console.error("Create Plan Error:", error);
      res.status(500).json({ error: "Erro ao cadastrar plano de manutenção." });
    }
  }
);

// PATCH /api/v1/condominiums/:condoId/plans/:planId
router.patch(
  '/:condoId/plans/:planId',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { planId } = req.params;
    const { status, nextOccurrence } = req.body;
    try {
      const updateData: any = {};
      if (status) updateData.status = status as PlanStatus;
      if (nextOccurrence) updateData.nextOccurrence = new Date(nextOccurrence);

      const plan = await prisma.maintenancePlan.update({
        where: { id: planId },
        data: updateData,
      });
      res.json(plan);
    } catch (error) {
      console.error("Update Plan Error:", error);
      res.status(500).json({ error: "Erro ao atualizar plano." });
    }
  }
);

// DELETE /api/v1/condominiums/:condoId/plans/:planId
router.delete(
  '/:condoId/plans/:planId',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { planId } = req.params;
    try {
      await prisma.maintenancePlan.delete({
        where: { id: planId },
      });
      res.json({ message: "Plano removido com sucesso." });
    } catch (error) {
      console.error("Delete Plan Error:", error);
      res.status(500).json({ error: "Erro ao deletar plano." });
    }
  }
);

// PATCH /api/v1/condominiums/:condoId/equipment/:eqId
router.patch(
  '/:condoId/equipment/:eqId',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { eqId } = req.params;
    const { name, location, category, status, lastInspection, nextInspection } = req.body;
    try {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (location) updateData.location = location;
      if (category) updateData.category = category;
      if (status) updateData.status = status as EquipmentStatus;
      if (lastInspection) updateData.lastInspection = new Date(lastInspection);
      if (nextInspection) updateData.nextInspection = new Date(nextInspection);

      const equipment = await prisma.equipment.update({
        where: { id: eqId },
        data: updateData,
      });
      res.json(equipment);
    } catch (error) {
      console.error("Update Equipment Error:", error);
      res.status(500).json({ error: "Erro ao atualizar equipamento." });
    }
  }
);

export default router;

