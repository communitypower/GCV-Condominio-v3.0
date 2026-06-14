import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/condominiums
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user.memberships.some((m: any) => m.role === PlatformRole.admin);

    if (isAdmin) {
      const condominiums = await prisma.condominium.findMany();
      return res.json(condominiums);
    }

    const condoIds = req.user.memberships
      .map((m: any) => m.condominiumId)
      .filter(Boolean) as string[];

    const condominiums = await prisma.condominium.findMany({
      where: {
        id: { in: condoIds },
      },
    });

    res.json(condominiums);
  } catch (error) {
    console.error("Fetch Condominiums Error:", error);
    res.status(500).json({ error: "Erro ao buscar condomínios." });
  }
});

// POST /api/v1/condominiums
router.post('/', requireAuth, requireRole([PlatformRole.admin, PlatformRole.syndic]), async (req: any, res) => {
  const { name, address, accountId } = req.body;
  if (!name || !address || !accountId) {
    return res.status(400).json({ error: "Nome, endereço e accountId são obrigatórios." });
  }

  const isAccountMember = req.user.memberships.some((m: any) => m.accountId === accountId);
  if (!isAccountMember) {
    return res.status(403).json({ error: "Acesso negado: você não pertence a esta conta." });
  }

  try {
    const condominium = await prisma.condominium.create({
      data: {
        name,
        address,
        accountId,
      },
    });
    res.status(201).json(condominium);
  } catch (error) {
    console.error("Create Condominium Error:", error);
    res.status(500).json({ error: "Erro ao criar condomínio." });
  }
});

export default router;
