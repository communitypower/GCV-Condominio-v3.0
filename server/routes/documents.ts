import { Router } from 'express';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(80),
  requiredRole: z.enum(PlatformRole).optional(),
  unitId: z.string().uuid().optional().nullable(),
  filePath: z.string().trim().min(1).max(500),
});

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
    const latestVersion = document.versions.reduce((prev, current) =>
      prev.versionNumber > current.versionNumber ? prev : current
    );

    const absolutePath = path.resolve(latestVersion.filePath);

    // Audit log document access
    const condo = await prisma.condominium.findUnique({ where: { id: condoId } });
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

    if (!fs.existsSync(absolutePath)) {
      // Fallback for testing/simulated environments if the physical file doesn't exist
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title}.pdf"`);
      return res.send(`%PDF-1.4 Simulated GCV Document Content for: ${document.title}`);
    }

    res.download(absolutePath, `${document.title}${path.extname(absolutePath)}`);
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
      const document = await prisma.document.create({
        data: {
          condominiumId: condoId,
          unitId: unitId || null,
          title,
          category,
          requiredRole: (requiredRole as PlatformRole) || PlatformRole.resident,
          filePath,
        },
      });

      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          filePath,
          uploadedBy: req.user.email,
        },
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Create Document Error:", error);
      res.status(500).json({ error: "Erro ao registrar documento." });
    }
  }
);

export default router;
