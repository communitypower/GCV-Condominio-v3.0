import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createAuditLogSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(5000),
  type: z.enum(['tech', 'security', 'admin']),
});

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
router.post('/:accountId/audit', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic]), validateBody(createAuditLogSchema), async (req: any, res) => {
  const { accountId } = req.params;
  const { title, content, type } = req.body;

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
