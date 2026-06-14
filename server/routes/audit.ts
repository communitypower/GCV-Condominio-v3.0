import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/accounts/:accountId/audit
router.get('/:accountId/audit', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic]), async (req: any, res) => {
  const { accountId } = req.params;
  try {
    const auditLogs = await prisma.auditEvent.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 events
    });
    res.json(auditLogs);
  } catch (error) {
    console.error("Fetch Audit Logs Error:", error);
    res.status(500).json({ error: "Erro ao buscar logs de auditoria." });
  }
});

// POST /api/v1/accounts/:accountId/audit
router.post('/:accountId/audit', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic]), async (req: any, res) => {
  const { accountId } = req.params;
  const { title, content, type } = req.body;

  if (!title || !content || !type) {
    return res.status(400).json({ error: "Título, descrição e subtipo são obrigatórios." });
  }

  try {
    const auditEvent = await prisma.auditEvent.create({
      data: {
        accountId,
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'create',
        entity: type === 'tech' ? 'MaintenanceTicket' : type === 'security' ? 'SecurityRonda' : 'AdminLog',
        details: `${title}: ${content}`,
      },
    });
    res.status(201).json(auditEvent);
  } catch (error) {
    console.error("Create Audit Log Error:", error);
    res.status(500).json({ error: "Erro ao criar log de auditoria." });
  }
});

export default router;

