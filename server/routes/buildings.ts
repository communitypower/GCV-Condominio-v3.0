import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/condominiums/:condoId/buildings
router.get('/:condoId/buildings', requireAuth, tenantGuard, async (req, res) => {
  const { condoId } = req.params;
  try {
    const buildings = await prisma.building.findMany({
      where: { condominiumId: condoId },
    });
    res.json(buildings);
  } catch (error) {
    console.error("Fetch Buildings Error:", error);
    res.status(500).json({ error: "Erro ao buscar edifícios." });
  }
});

// POST /api/v1/condominiums/:condoId/buildings
router.post(
  '/:condoId/buildings',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  async (req, res) => {
    const { condoId } = req.params;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nome do bloco/edifício é obrigatório." });
    }

    try {
      const building = await prisma.building.create({
        data: {
          name,
          condominiumId: condoId,
        },
      });
      res.status(201).json(building);
    } catch (error) {
      console.error("Create Building Error:", error);
      res.status(500).json({ error: "Erro ao criar edifício." });
    }
  }
);

export default router;
