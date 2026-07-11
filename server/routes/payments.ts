import { PaymentOrderStatus, PlatformRole, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
const prisma = new PrismaClient();
const financeRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.accountant];

const createSchema = z.object({
  recipient: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive().max(999999999999.99),
  dueDate: z.coerce.date(),
});
const updateSchema = createSchema.partial().refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo para atualização.' });
const paySchema = z.object({ paymentReference: z.string().trim().min(1).max(200).optional() });
const emptySchema = z.object({});
const serialize = (record: any) => ({ ...record, amount: Number(record.amount) });

router.get('/:condoId/payment-orders', requireAuth, tenantGuard, requireRole(financeRoles), async (req, res) => {
  try {
    const records = await prisma.paymentOrder.findMany({ where: { condominiumId: req.params.condoId }, include: { createdBy: { select: { id: true, email: true } }, paidBy: { select: { id: true, email: true } } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] });
    res.json(records.map(serialize));
  } catch (error) {
    console.error('Fetch Payment Orders Error:', error);
    res.status(500).json({ error: 'Erro ao buscar contas a pagar.' });
  }
});

router.post('/:condoId/payment-orders', requireAuth, tenantGuard, requireRole(financeRoles), validateBody(createSchema), async (req: any, res) => {
  try {
    const condo = await prisma.condominium.findUnique({ where: { id: req.params.condoId }, select: { accountId: true } });
    if (!condo) return res.status(404).json({ error: 'Condomínio não encontrado.' });
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentOrder.create({ data: { ...req.body, accountId: condo.accountId, condominiumId: req.params.condoId, createdById: req.user.id }, include: { createdBy: { select: { id: true, email: true } }, paidBy: true } });
      await tx.auditEvent.create({ data: { accountId: condo.accountId, userId: req.user.id, userEmail: req.user.email, action: 'create', entity: 'PaymentOrder', entityId: created.id, details: `Conta a pagar criada no valor de ${created.amount.toString()}, vencimento ${created.dueDate.toISOString()}.`, ipAddress: req.ip } });
      return created;
    });
    res.status(201).json(serialize(record));
  } catch (error) {
    console.error('Create Payment Order Error:', error);
    res.status(500).json({ error: 'Erro ao criar conta a pagar.' });
  }
});

router.patch('/:condoId/payment-orders/:paymentId', requireAuth, tenantGuard, requireRole(financeRoles), validateBody(updateSchema), async (req: any, res) => {
  try {
    const current = await prisma.paymentOrder.findFirst({ where: { id: req.params.paymentId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
    if (current.status !== PaymentOrderStatus.pending && current.status !== PaymentOrderStatus.overdue) return res.status(409).json({ error: 'Somente contas pendentes ou vencidas podem ser editadas.' });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentOrder.update({ where: { id: current.id }, data: req.body, include: { createdBy: { select: { id: true, email: true } }, paidBy: { select: { id: true, email: true } } } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'PaymentOrder', entityId: current.id, details: 'Conta a pagar atualizada.', ipAddress: req.ip } });
      return updated;
    });
    res.json(serialize(record));
  } catch (error) {
    console.error('Update Payment Order Error:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta a pagar.' });
  }
});

router.post('/:condoId/payment-orders/:paymentId/pay', requireAuth, tenantGuard, requireRole(financeRoles), validateBody(paySchema), async (req: any, res) => {
  try {
    const current = await prisma.paymentOrder.findFirst({ where: { id: req.params.paymentId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
    if (current.status !== PaymentOrderStatus.pending && current.status !== PaymentOrderStatus.overdue) return res.status(409).json({ error: 'Esta conta não pode ser liquidada no estado atual.' });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentOrder.update({ where: { id: current.id }, data: { status: PaymentOrderStatus.paid, paidAt: new Date(), paidById: req.user.id, paymentReference: req.body.paymentReference }, include: { createdBy: { select: { id: true, email: true } }, paidBy: { select: { id: true, email: true } } } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'PaymentOrder', entityId: current.id, details: `Conta liquidada no valor de ${current.amount.toString()}.`, ipAddress: req.ip } });
      return updated;
    });
    res.json(serialize(record));
  } catch (error) {
    console.error('Pay Payment Order Error:', error);
    res.status(500).json({ error: 'Erro ao liquidar conta a pagar.' });
  }
});

router.post('/:condoId/payment-orders/:paymentId/cancel', requireAuth, tenantGuard, requireRole(financeRoles), validateBody(emptySchema), async (req: any, res) => {
  try {
    const current = await prisma.paymentOrder.findFirst({ where: { id: req.params.paymentId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
    if (current.status === PaymentOrderStatus.paid || current.status === PaymentOrderStatus.cancelled) return res.status(409).json({ error: 'Esta conta não pode ser cancelada no estado atual.' });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentOrder.update({ where: { id: current.id }, data: { status: PaymentOrderStatus.cancelled, cancelledAt: new Date() }, include: { createdBy: { select: { id: true, email: true } }, paidBy: true } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'PaymentOrder', entityId: current.id, details: 'Conta a pagar cancelada.', ipAddress: req.ip } });
      return updated;
    });
    res.json(serialize(record));
  } catch (error) {
    console.error('Cancel Payment Order Error:', error);
    res.status(500).json({ error: 'Erro ao cancelar conta a pagar.' });
  }
});

export default router;
