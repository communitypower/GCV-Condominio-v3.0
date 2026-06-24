import { Router } from 'express';
import { PrismaClient, PlatformRole, EquipmentStatus, PlanFrequency, PlanStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const equipmentStatusSchema = z.enum(EquipmentStatus);
const planFrequencySchema = z.enum(PlanFrequency);
const planStatusSchema = z.enum(PlanStatus);

const createEquipmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  status: equipmentStatusSchema,
  lastInspection: z.coerce.date().optional().nullable(),
  nextInspection: z.coerce.date().optional().nullable(),
  installDate: z.coerce.date().optional().nullable(),
});

const updateEquipmentSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  status: equipmentStatusSchema.optional(),
  lastInspection: z.coerce.date().optional().nullable(),
  nextInspection: z.coerce.date().optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Ao menos um campo deve ser informado.',
});

const createPlanSchema = z.object({
  equipmentId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  frequency: planFrequencySchema,
  nextOccurrence: z.coerce.date(),
  status: planStatusSchema,
});

const updatePlanSchema = z.object({
  status: planStatusSchema.optional(),
  nextOccurrence: z.coerce.date().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Ao menos um campo deve ser informado.',
});

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
  validateBody(createEquipmentSchema),
  async (req, res) => {
    const { condoId } = req.params;
    const { name, location, category, status, lastInspection, nextInspection, installDate } = req.body;

    try {
      const equipment = await prisma.equipment.create({
        data: {
          condominiumId: condoId,
          name,
          location,
          category,
          status: status as EquipmentStatus,
          lastInspection: lastInspection || new Date(),
          nextInspection: nextInspection || new Date(),
          installDate: installDate || new Date(),
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
  validateBody(createPlanSchema),
  async (req, res) => {
    const { condoId } = req.params;
    const { equipmentId, title, description, frequency, nextOccurrence, status } = req.body;

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
          nextOccurrence,
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
  validateBody(updatePlanSchema),
  async (req, res) => {
    const { planId } = req.params;
    const { status, nextOccurrence } = req.body;
    try {
      const updateData: any = {};
      if (status) updateData.status = status as PlanStatus;
      if (nextOccurrence) updateData.nextOccurrence = nextOccurrence;

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
  validateBody(updateEquipmentSchema),
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
      if (lastInspection) updateData.lastInspection = lastInspection;
      if (nextInspection) updateData.nextInspection = nextInspection;

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
