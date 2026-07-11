import { PlatformRole, PrismaClient, ProcurementStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
const prisma = new PrismaClient();
const manageRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager];
const decideRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.council_member];

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  supplier: z.string().trim().min(1).max(200),
  items: z.string().trim().min(1).max(5000),
  amount: z.coerce.number().positive().max(999999999999.99),
});

const updateSchema = createSchema.partial().refine((body) => Object.keys(body).length > 0, {
  message: 'Informe ao menos um campo para atualização.',
});

const decisionSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});

const serialize = (record: any) => ({
  ...record,
  amount: Number(record.amount),
  requester: record.requestedBy?.person?.name || record.requestedBy?.email,
});

async function getCondominium(condominiumId: string) {
  return prisma.condominium.findUnique({ where: { id: condominiumId }, select: { accountId: true } });
}

router.get('/:condoId/purchase-requests', requireAuth, tenantGuard, async (req, res) => {
  try {
    const records = await prisma.purchaseRequest.findMany({
      where: { condominiumId: req.params.condoId },
      include: { requestedBy: { include: { person: true } }, decisionBy: { select: { id: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(records.map(serialize));
  } catch (error) {
    console.error('Fetch Purchase Requests Error:', error);
    res.status(500).json({ error: 'Erro ao buscar requisições de compra.' });
  }
});

router.post('/:condoId/purchase-requests', requireAuth, tenantGuard, requireRole(manageRoles), validateBody(createSchema), async (req: any, res) => {
  try {
    const condo = await getCondominium(req.params.condoId);
    if (!condo) return res.status(404).json({ error: 'Condomínio não encontrado.' });

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseRequest.create({
        data: { ...req.body, accountId: condo.accountId, condominiumId: req.params.condoId, requestedById: req.user.id },
        include: { requestedBy: { include: { person: true } }, decisionBy: true },
      });
      await tx.auditEvent.create({ data: {
        accountId: condo.accountId, userId: req.user.id, userEmail: req.user.email,
        action: 'create', entity: 'PurchaseRequest', entityId: created.id,
        details: `Requisição de compra criada no valor de ${created.amount.toString()}.`, ipAddress: req.ip,
      } });
      return created;
    });
    res.status(201).json(serialize(record));
  } catch (error) {
    console.error('Create Purchase Request Error:', error);
    res.status(500).json({ error: 'Erro ao criar requisição de compra.' });
  }
});

router.patch('/:condoId/purchase-requests/:requestId', requireAuth, tenantGuard, requireRole(manageRoles), validateBody(updateSchema), async (req: any, res) => {
  try {
    const current = await prisma.purchaseRequest.findFirst({ where: { id: req.params.requestId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Requisição de compra não encontrada.' });
    if (current.status !== ProcurementStatus.pending) return res.status(409).json({ error: 'Somente requisições pendentes podem ser editadas.' });

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseRequest.update({ where: { id: current.id }, data: req.body, include: { requestedBy: { include: { person: true } }, decisionBy: true } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'PurchaseRequest', entityId: current.id, details: 'Requisição de compra pendente atualizada.', ipAddress: req.ip } });
      return updated;
    });
    res.json(serialize(record));
  } catch (error) {
    console.error('Update Purchase Request Error:', error);
    res.status(500).json({ error: 'Erro ao atualizar requisição de compra.' });
  }
});

async function decide(req: any, res: any, status: ProcurementStatus) {
  try {
    const current = await prisma.purchaseRequest.findFirst({ where: { id: req.params.requestId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Requisição de compra não encontrada.' });
    if (current.status !== ProcurementStatus.pending) return res.status(409).json({ error: 'A requisição já possui uma decisão.' });

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseRequest.update({ where: { id: current.id }, data: { status, decisionById: req.user.id, decisionAt: new Date(), decisionReason: req.body.reason }, include: { requestedBy: { include: { person: true } }, decisionBy: true } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'PurchaseRequest', entityId: current.id, details: `Requisição de compra alterada de ${current.status} para ${status}.`, ipAddress: req.ip } });
      return updated;
    });
    res.json(serialize(record));
  } catch (error) {
    console.error('Decide Purchase Request Error:', error);
    res.status(500).json({ error: 'Erro ao registrar decisão da requisição.' });
  }
}

router.post('/:condoId/purchase-requests/:requestId/approve', requireAuth, tenantGuard, requireRole(decideRoles), validateBody(decisionSchema), (req, res) => decide(req, res, ProcurementStatus.approved));
router.post('/:condoId/purchase-requests/:requestId/reject', requireAuth, tenantGuard, requireRole(decideRoles), validateBody(decisionSchema), (req, res) => decide(req, res, ProcurementStatus.rejected));
router.post('/:condoId/purchase-requests/:requestId/cancel', requireAuth, tenantGuard, requireRole(manageRoles), validateBody(decisionSchema), (req, res) => decide(req, res, ProcurementStatus.cancelled));

export default router;
