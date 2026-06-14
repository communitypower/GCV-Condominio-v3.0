import { Router } from 'express';
import { PrismaClient, PlatformRole, RelationshipRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/condominiums/:condoId/residents
router.get('/:condoId/residents', requireAuth, tenantGuard, async (req, res) => {
  const { condoId } = req.params;
  try {
    const relationships = await prisma.unitRelationship.findMany({
      where: {
        unit: { building: { condominiumId: condoId } },
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
  async (req, res) => {
    const { condoId } = req.params;
    const { name, email, phone, unitId, role } = req.body;

    if (!name || !email || !phone || !unitId || !role) {
      return res.status(400).json({ error: "Nome, e-mail, telefone, unitId e papel de relacionamento são obrigatórios." });
    }

    try {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, building: { condominiumId: condoId } },
      });

      if (!unit) {
        return res.status(400).json({ error: "Unidade não encontrada neste condomínio." });
      }

      let person = await prisma.person.findUnique({
        where: { email },
      });

      if (!person) {
        person = await prisma.person.create({
          data: { name, email, phone },
        });
      }

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: "resident123",
            personId: person.id,
          },
        });
      }

      const condo = await prisma.condominium.findUnique({
        where: { id: condoId },
      });

      if (condo) {
        await prisma.membership.upsert({
          where: {
            userId_accountId_condominiumId_role: {
              userId: user.id,
              accountId: condo.accountId,
              condominiumId: condoId,
              role: PlatformRole.resident,
            },
          },
          create: {
            userId: user.id,
            accountId: condo.accountId,
            condominiumId: condoId,
            role: PlatformRole.resident,
          },
          update: {},
        });
      }

      const relationship = await prisma.unitRelationship.create({
        data: {
          unitId,
          personId: person.id,
          role: role as RelationshipRole,
        },
        include: { person: true, unit: true },
      });

      res.status(201).json(relationship);
    } catch (error) {
      console.error("Create Resident Error:", error);
      res.status(500).json({ error: "Erro ao cadastrar morador." });
    }
  }
);

export default router;
