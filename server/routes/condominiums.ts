import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireSystemAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createCondominiumSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(240),
  accountId: z.string().uuid(),
});

// GET /api/v1/condominiums
router.get('/', requireAuth, async (req: any, res) => {
  try {
    if (req.user.isSystemAdmin) {
      const condominiums = await prisma.condominium.findMany({ orderBy: { name: 'asc' } });
      return res.json(condominiums);
    }
    const condoIds = req.user.memberships
      .map((m: any) => m.condominiumId)
      .filter(Boolean) as string[];
    const accountIds = req.user.memberships
      .filter((m: any) => m.condominiumId === null)
      .map((m: any) => m.accountId) as string[];

    const condominiums = await prisma.condominium.findMany({
      where: {
        OR: [
          { id: { in: condoIds } },
          { accountId: { in: accountIds } },
        ],
      },
    });

    res.json(condominiums);
  } catch (error) {
    console.error("Fetch Condominiums Error:", error);
    res.status(500).json({ error: "Erro ao buscar condomínios." });
  }
});

// POST /api/v1/condominiums
router.post('/', requireAuth, requireSystemAdmin, validateBody(createCondominiumSchema), async (req: any, res) => {
  const { name, address, accountId } = req.body;

  try {
    const condominium = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: accountId }, select: { id: true } });
      if (!account) throw new Error('ACCOUNT_NOT_FOUND');
      const created = await tx.condominium.create({
        data: { name, address, accountId },
      });
      await tx.auditEvent.create({
        data: {
          accountId,
          condominiumId: created.id,
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'create',
          entity: 'Condominium',
          entityId: created.id,
          details: `Condomínio ${created.name} criado.`,
          ipAddress: req.ip,
        },
      });
      return created;
    });
    res.status(201).json(condominium);
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }
    console.error("Create Condominium Error:", error);
    res.status(500).json({ error: "Erro ao criar condomínio." });
  }
});

export default router;
