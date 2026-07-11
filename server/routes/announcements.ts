import { AnnouncementType, PlatformRole, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
const prisma = new PrismaClient();
const publishRoles = [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager];
const announcementTypeSchema = z.enum(AnnouncementType);
const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  type: announcementTypeSchema.default(AnnouncementType.announcement),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
}).refine((body) => !body.expiresAt || !body.publishedAt || body.expiresAt > body.publishedAt, { message: 'A expiração deve ser posterior à publicação.', path: ['expiresAt'] });
const updateSchema = createSchema.partial().refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo para atualização.' });

router.get('/:condoId/announcements', requireAuth, tenantGuard, async (req, res) => {
  try {
    const records = await prisma.announcement.findMany({
      where: { condominiumId: req.params.condoId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { author: { select: { id: true, email: true, person: { select: { name: true } } } } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(records);
  } catch (error) {
    console.error('Fetch Announcements Error:', error);
    res.status(500).json({ error: 'Erro ao buscar comunicados.' });
  }
});

router.post('/:condoId/announcements', requireAuth, tenantGuard, requireRole(publishRoles), validateBody(createSchema), async (req: any, res) => {
  try {
    const condo = await prisma.condominium.findUnique({ where: { id: req.params.condoId }, select: { accountId: true } });
    if (!condo) return res.status(404).json({ error: 'Condomínio não encontrado.' });
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({ data: { ...req.body, accountId: condo.accountId, condominiumId: req.params.condoId, authorId: req.user.id }, include: { author: { select: { id: true, email: true, person: { select: { name: true } } } } } });
      await tx.auditEvent.create({ data: { accountId: condo.accountId, userId: req.user.id, userEmail: req.user.email, action: 'create', entity: 'Announcement', entityId: created.id, details: `Comunicado publicado: ${created.title}.`, ipAddress: req.ip } });
      return created;
    });
    res.status(201).json(record);
  } catch (error) {
    console.error('Create Announcement Error:', error);
    res.status(500).json({ error: 'Erro ao publicar comunicado.' });
  }
});

router.patch('/:condoId/announcements/:announcementId', requireAuth, tenantGuard, requireRole(publishRoles), validateBody(updateSchema), async (req: any, res) => {
  try {
    const current = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Comunicado não encontrado.' });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.announcement.update({ where: { id: current.id }, data: req.body, include: { author: { select: { id: true, email: true, person: { select: { name: true } } } } } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'Announcement', entityId: current.id, details: `Comunicado atualizado: ${updated.title}.`, ipAddress: req.ip } });
      return updated;
    });
    res.json(record);
  } catch (error) {
    console.error('Update Announcement Error:', error);
    res.status(500).json({ error: 'Erro ao atualizar comunicado.' });
  }
});

router.delete('/:condoId/announcements/:announcementId', requireAuth, tenantGuard, requireRole(publishRoles), async (req: any, res) => {
  try {
    const current = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, condominiumId: req.params.condoId } });
    if (!current) return res.status(404).json({ error: 'Comunicado não encontrado.' });
    await prisma.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id: current.id } });
      await tx.auditEvent.create({ data: { accountId: current.accountId, userId: req.user.id, userEmail: req.user.email, action: 'delete', entity: 'Announcement', entityId: current.id, details: `Comunicado removido: ${current.title}.`, ipAddress: req.ip } });
    });
    res.status(204).send();
  } catch (error) {
    console.error('Delete Announcement Error:', error);
    res.status(500).json({ error: 'Erro ao remover comunicado.' });
  }
});

export default router;
