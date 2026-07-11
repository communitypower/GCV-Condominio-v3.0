import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const documentStorageRoot = path.resolve(process.env.DOCUMENT_STORAGE_PATH || 'uploads');

const safeDocumentPath = z.string().trim().min(1).max(500).refine(
  (value) => !path.isAbsolute(value) && !value.split(/[\\/]+/).includes('..'),
  'O caminho do documento deve ser relativo e não pode sair do diretório de armazenamento.'
);

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(80),
  requiredRole: z.enum(PlatformRole).optional(),
  unitId: z.string().uuid().optional().nullable(),
  filePath: safeDocumentPath,
});

export function latestDocumentVersion<T extends { versionNumber: number }>(versions: T[]) {
  return versions.reduce<T | null>((latest, version) =>
    !latest || version.versionNumber > latest.versionNumber ? version : latest, null);
}

export function resolveStoredDocumentPath(filePath: string) {
  const relativePath = filePath.replace(/^uploads[\\/]/, '');
  const absolutePath = path.resolve(documentStorageRoot, relativePath);
  return absolutePath.startsWith(`${documentStorageRoot}${path.sep}`) ? absolutePath : null;
}

// GET /api/v1/condominiums/:condoId/documents
router.get('/:condoId/documents', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId } = req.params;
  try {
    const isStaff = req.user.memberships.some((m: any) =>
      [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.accountant, PlatformRole.council_member].includes(m.role)
    );

    if (isStaff) {
      // Staff see all documents in the condominium
      const documents = await prisma.document.findMany({
        where: { condominiumId: condoId },
        include: { versions: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(documents);
    }

    // Residents see documents matching their role permission level and unitId scoping
    const userRelationships = await prisma.unitRelationship.findMany({
      where: {
        person: { email: req.user.email },
        unit: { building: { condominiumId: condoId } },
      },
      select: { unitId: true },
    });
    const unitIds = userRelationships.map((r) => r.unitId);

    const documents = await prisma.document.findMany({
      where: {
        condominiumId: condoId,
        requiredRole: PlatformRole.resident,
        OR: [
          { unitId: null }, // Public condo docs (regulations, minutes)
          { unitId: { in: unitIds } }, // Resident unit specific docs
        ],
      },
      include: { versions: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error("Fetch Documents Error:", error);
    res.status(500).json({ error: "Erro ao buscar documentos." });
  }
});

// GET /api/v1/condominiums/:condoId/documents/:docId/download
router.get('/:condoId/documents/:docId/download', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId, docId } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id: docId },
      include: { versions: true },
    });

    if (!document || document.condominiumId !== condoId) {
      return res.status(404).json({ error: "Documento não encontrado neste condomínio." });
    }

    // Verify ACL access
    const isStaff = req.user.memberships.some((m: any) =>
      [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.accountant, PlatformRole.council_member].includes(m.role)
    );

    if (!isStaff) {
      // 1. Check Role Permission Level
      if (document.requiredRole !== PlatformRole.resident) {
        return res.status(403).json({ error: "Acesso negado: permissões insuficientes para este documento." });
      }

      // 2. Check Unit Scoping
      if (document.unitId) {
        const belongsToUnit = await prisma.unitRelationship.findFirst({
          where: {
            unitId: document.unitId,
            person: { email: req.user.email },
          },
        });
        if (!belongsToUnit) {
          return res.status(403).json({ error: "Acesso negado: este documento é restrito a outra unidade." });
        }
      }
    }

    // Resolve version file path
    const latestVersion = latestDocumentVersion(document.versions);
    if (!latestVersion) {
      return res.status(410).json({ error: 'Documento indisponível: nenhuma versão foi registrada.' });
    }

    const absolutePath = resolveStoredDocumentPath(latestVersion.filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(410).json({ error: 'Documento indisponível no armazenamento.' });
    }

    res.download(absolutePath, `${document.title}${path.extname(absolutePath)}`, async (downloadError) => {
      if (downloadError) {
        console.error('Download Document Transfer Error:', downloadError);
        if (!res.headersSent) res.status(404).json({ error: 'Documento não pôde ser transferido.' });
        return;
      }
      try {
        const condo = await prisma.condominium.findUnique({ where: { id: condoId }, select: { accountId: true } });
        if (condo) {
          await prisma.auditEvent.create({
            data: {
              accountId: condo.accountId,
              userId: req.user.id,
              userEmail: req.user.email,
              action: 'document_access',
              entity: 'Document',
              entityId: document.id,
              details: `Download do documento "${document.title}" realizado com sucesso.`,
            },
          });
        }
      } catch (auditError) {
        console.error('Document Download Audit Error:', auditError);
      }
    });
  } catch (error) {
    console.error("Download Document Error:", error);
    res.status(500).json({ error: "Erro ao baixar documento." });
  }
});

// POST /api/v1/condominiums/:condoId/documents
router.post(
  '/:condoId/documents',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  validateBody(createDocumentSchema),
  async (req: any, res) => {
    const { condoId } = req.params;
    const { title, category, requiredRole, unitId, filePath } = req.body;

    try {
      const document = await prisma.$transaction(async (tx) => {
        if (unitId) {
          const unit = await tx.unit.findFirst({
            where: { id: unitId, building: { condominiumId: condoId } },
            select: { id: true },
          });
          if (!unit) throw new Error('INVALID_DOCUMENT_UNIT');
        }

        return tx.document.create({
          data: {
            condominiumId: condoId,
            unitId: unitId || null,
            title,
            category,
            requiredRole: (requiredRole as PlatformRole) || PlatformRole.resident,
            filePath,
            versions: { create: { versionNumber: 1, filePath, uploadedBy: req.user.email } },
          },
          include: { versions: true },
        });
      });

      res.status(201).json(document);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_DOCUMENT_UNIT') {
        return res.status(400).json({ error: 'Unidade inválida para este condomínio.' });
      }
      console.error("Create Document Error:", error);
      res.status(500).json({ error: "Erro ao registrar documento." });
    }
  }
);

export default router;
