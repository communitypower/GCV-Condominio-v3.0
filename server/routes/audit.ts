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
  condominiumId: z.string().trim().min(1).max(120),
});

// GET /api/v1/accounts/:accountId/audit
router.get('/:accountId/audit', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic]), async (req: any, res) => {
  const { accountId } = req.params;
  try {
    const condominiumId = z.string().trim().min(1).max(120).safeParse(req.query.condominiumId);
    if (!condominiumId.success) return res.status(400).json({ error: "Condomínio é obrigatório para consultar logs operacionais." });
    const hasAccess = req.user.memberships.some((membership: any) => membership.accountId === accountId && (membership.condominiumId === condominiumId.data || membership.condominiumId === null));
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao condomínio informado." });
    const auditLogs = await prisma.auditEvent.findMany({
      where: { accountId, condominiumId: condominiumId.data },
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
    const { title, content, type, condominiumId } = req.body;

    try {
      const condominium = await prisma.condominium.findFirst({ where: { id: condominiumId, accountId } });
      if (!condominium) return res.status(400).json({ error: "Condomínio inválido para esta conta." });
    const auditEvent = await prisma.auditEvent.create({
      data: {
        accountId,
        condominiumId,
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
