import { Router } from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { DocumentProcessingStatus, DocumentScanStatus, PrismaClient, PlatformRole } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { z } from 'zod';
import { deleteDocumentFile, buildDocumentStorageKey, expectedTenantStoragePrefix, resolveDocumentStoragePath, writeDocumentFile } from '../services/document-storage';
import { documentUploadLimits, inspectDocumentFile } from '../services/document-files';
import { queueDocumentProcessing } from '../services/document-processing';

const router = Router();
const prisma = new PrismaClient();
const documentStorageRoot = path.resolve(process.env.DOCUMENT_STORAGE_PATH || 'uploads');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: documentUploadLimits.maxFiles, fileSize: documentUploadLimits.maxFileSizeBytes },
});

const uploadDocuments = (req: any, res: any, next: any) => upload.array('files', documentUploadLimits.maxFiles)(req, res, (error) => {
  if (!error) return next();
  const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
  res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Arquivo acima do limite permitido.' : 'Falha ao receber os arquivos.', code: error.code || 'UPLOAD_ERROR' });
});

function requireDocumentIngestion(_req: any, res: any, next: any) {
  if (process.env.ENABLE_DOCUMENT_INGESTION !== 'true') {
    return res.status(403).json({
      error: 'Carga e processamento de documentos desabilitados neste ambiente.',
      code: 'DOCUMENT_INGESTION_DISABLED',
    });
  }
  next();
}

const uploadDocumentVersion = (req: any, res: any, next: any) => upload.single('file')(req, res, (error) => {
  if (!error) return next();
  const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
  res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Arquivo acima do limite permitido.' : 'Falha ao receber o arquivo.', code: error.code || 'UPLOAD_ERROR' });
});

async function assertDocumentUploadQuota(condominiumId: string, incomingBytes: number, incomingDocuments: number, incomingVersions = incomingDocuments) {
  const [stored, activeDocuments, pendingVersions] = await Promise.all([
    prisma.documentVersion.aggregate({ where: { condominiumId }, _sum: { sizeBytes: true } }),
    prisma.document.count({ where: { condominiumId, deletedAt: null } }),
    prisma.documentVersion.count({
      where: {
        condominiumId,
        processingStatus: { in: [DocumentProcessingStatus.queued, DocumentProcessingStatus.scanning, DocumentProcessingStatus.extracting] },
      },
    }),
  ]);
  if ((stored._sum.sizeBytes || 0) + incomingBytes > documentUploadLimits.maxTenantStorageBytes) {
    throw new Error('TENANT_STORAGE_QUOTA_EXCEEDED');
  }
  if (activeDocuments + incomingDocuments > documentUploadLimits.maxTenantDocuments) {
    throw new Error('TENANT_DOCUMENT_QUOTA_EXCEEDED');
  }
  if (pendingVersions + incomingVersions > documentUploadLimits.maxPendingVersions) {
    throw new Error('PROCESSING_QUEUE_QUOTA_EXCEEDED');
  }
}

const uploadErrorMessages: Record<string, string> = {
  UNSUPPORTED_FILE_EXTENSION: 'Formato de arquivo não suportado.',
  FILE_TYPE_MISMATCH: 'O conteúdo do arquivo não corresponde à extensão informada.',
  ARCHIVE_INVALID: 'O arquivo compactado está corrompido ou possui estrutura inválida.',
  ARCHIVE_ZIP64_UNSUPPORTED: 'Arquivos compactados ZIP64 não são aceitos.',
  ARCHIVE_TOO_MANY_ENTRIES: 'O arquivo compactado contém itens demais.',
  ARCHIVE_ENCRYPTED: 'Arquivos compactados protegidos por senha não são aceitos.',
  ARCHIVE_COMPRESSION_UNSUPPORTED: 'O arquivo usa um método de compactação não permitido.',
  ARCHIVE_ENTRY_TOO_LARGE: 'Um item interno excede o limite de expansão permitido.',
  ARCHIVE_UNSAFE_PATH: 'O arquivo compactado contém um caminho interno inseguro.',
  ARCHIVE_EXPANSION_LIMIT: 'O conteúdo expandido excede o limite permitido.',
  ARCHIVE_COMPRESSION_RATIO_EXCEEDED: 'A taxa de compactação do arquivo excede o limite de segurança.',
  TENANT_STORAGE_QUOTA_EXCEEDED: 'A cota de armazenamento documental do condomínio foi atingida.',
  TENANT_DOCUMENT_QUOTA_EXCEEDED: 'A quantidade máxima de documentos do condomínio foi atingida.',
  PROCESSING_QUEUE_QUOTA_EXCEEDED: 'Há muitos documentos aguardando processamento. Tente novamente mais tarde.',
};

const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  requiredRole: z.enum(PlatformRole).optional(),
  unitId: z.string().uuid().optional().nullable(),
  buildingId: z.string().uuid().optional().nullable(),
  equipmentId: z.string().uuid().optional().nullable(),
  maintenancePlanId: z.string().uuid().optional().nullable(),
  maintenanceTicketId: z.string().uuid().optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });

const retentionSchema = z.object({
  legalHold: z.boolean().optional(),
  retentionUntil: z.coerce.date().optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um controle de retencao.' });

const documentAssociationsSchema = z.object({
  unitId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  equipmentId: z.string().uuid().optional(),
  maintenancePlanId: z.string().uuid().optional(),
  maintenanceTicketId: z.string().uuid().optional(),
});

function serializeDocument(document: any) {
  const latestVersion = latestDocumentVersion<any>(document.versions || []);
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    requiredRole: document.requiredRole,
    unitId: document.unitId,
    buildingId: document.buildingId,
    equipmentId: document.equipmentId,
    maintenancePlanId: document.maintenancePlanId,
    maintenanceTicketId: document.maintenanceTicketId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    retentionUntil: document.retentionUntil,
    legalHold: document.legalHold,
    latestVersion: latestVersion ? {
      id: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      originalFileName: latestVersion.originalFileName,
      mimeType: latestVersion.mimeType,
      sizeBytes: latestVersion.sizeBytes,
      checksum: latestVersion.checksum,
      scanStatus: latestVersion.scanStatus,
      processingStatus: latestVersion.processingStatus,
      processingError: latestVersion.processingError,
      metadata: latestVersion.metadata,
      createdAt: latestVersion.createdAt,
      chunkCount: latestVersion._count?.chunks ?? 0,
    } : null,
  };
}

async function validateDocumentAssociations(condominiumId: string, associations: z.infer<typeof documentAssociationsSchema>) {
  const [unit, building, equipment, plan, ticket] = await Promise.all([
    associations.unitId ? prisma.unit.findFirst({ where: { id: associations.unitId, building: { condominiumId } }, select: { id: true, buildingId: true } }) : null,
    associations.buildingId ? prisma.building.findFirst({ where: { id: associations.buildingId, condominiumId }, select: { id: true } }) : null,
    associations.equipmentId ? prisma.equipment.findFirst({ where: { id: associations.equipmentId, condominiumId }, select: { id: true } }) : null,
    associations.maintenancePlanId ? prisma.maintenancePlan.findFirst({ where: { id: associations.maintenancePlanId, condominiumId }, select: { id: true } }) : null,
    associations.maintenanceTicketId ? prisma.maintenanceTicket.findFirst({ where: { id: associations.maintenanceTicketId, condominiumId }, select: { id: true } }) : null,
  ]);
  if ((associations.unitId && !unit)
    || (associations.buildingId && !building)
    || (associations.equipmentId && !equipment)
    || (associations.maintenancePlanId && !plan)
    || (associations.maintenanceTicketId && !ticket)
    || (associations.unitId && associations.buildingId && unit?.buildingId !== associations.buildingId)) {
    throw new Error('INVALID_DOCUMENT_ASSOCIATION');
  }
}

async function canAccessDocument(req: any, document: any, condominiumId: string) {
  const isStaff = req.authorizationContext.memberships.some((membership: any) =>
    [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff, PlatformRole.accountant, PlatformRole.council_member].includes(membership.role)
  );
  if (isStaff) return true;
  const scopedRoles = req.authorizationContext.memberships.map((membership: any) => membership.role);
  if (!scopedRoles.includes(document.requiredRole)) return false;
  if (!document.unitId) return true;
  const relationship = await prisma.unitRelationship.findFirst({
    where: {
      unitId: document.unitId,
      endDate: null,
      person: { user: { id: req.user.id } },
      unit: { building: { condominiumId } },
    },
    select: { id: true },
  });
  return Boolean(relationship);
}

function downloadSignature(userId: string, condominiumId: string, documentId: string, versionId: string, expires: number) {
  return createHmac('sha256', process.env.SESSION_SECRET || 'development-only-secret')
    .update(`${userId}:${condominiumId}:${documentId}:${versionId}:${expires}`)
    .digest('hex');
}

function signaturesMatch(received: string, expected: string) {
  const left = Buffer.from(received, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

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
    const isStaff = req.authorizationContext.memberships.some((m: any) =>
      [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff, PlatformRole.accountant, PlatformRole.council_member].includes(m.role)
    );

    if (isStaff) {
      // Staff see all documents in the condominium
      const documents = await prisma.document.findMany({
        where: { condominiumId: condoId, deletedAt: null },
        include: { versions: { include: { _count: { select: { chunks: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(documents.map(serializeDocument));
    }

    // Residents see documents matching their role permission level and unitId scoping
    const userRelationships = await prisma.unitRelationship.findMany({
      where: {
        endDate: null,
        person: { user: { id: req.user.id } },
        unit: { building: { condominiumId: condoId } },
      },
      select: { unitId: true },
    });
    const unitIds = userRelationships.map((r) => r.unitId);

    const allowedRoles = req.authorizationContext.memberships.map((membership: any) => membership.role);
    const documents = await prisma.document.findMany({
      where: {
        condominiumId: condoId,
        deletedAt: null,
        requiredRole: { in: allowedRoles },
        OR: [
          { unitId: null }, // Public condo docs (regulations, minutes)
          { unitId: { in: unitIds } }, // Resident unit specific docs
        ],
      },
      include: { versions: { include: { _count: { select: { chunks: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents.map(serializeDocument));
  } catch (error) {
    console.error("Fetch Documents Error:", error);
    res.status(500).json({ error: "Erro ao buscar documentos." });
  }
});

// GET /api/v1/condominiums/:condoId/documents/:docId/download-url
router.get('/:condoId/documents/:docId/download-url', requireAuth, tenantGuard, async (req: any, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  const version = document?.versions[0];
  if (!document || !version) return res.status(404).json({ error: 'Documento não encontrado.' });
  if (!await canAccessDocument(req, document, req.params.condoId)) return res.status(403).json({ error: 'Acesso negado a este documento.' });
  if (version.scanStatus !== DocumentScanStatus.clean) return res.status(423).json({ error: 'Documento em quarentena ou ainda não liberado pelo antivírus.' });
  const expires = Date.now() + 5 * 60 * 1000;
  const signature = downloadSignature(req.user.id, req.params.condoId, document.id, version.id, expires);
  res.json({
    expiresAt: new Date(expires).toISOString(),
    url: `/api/v1/condominiums/${req.params.condoId}/documents/${document.id}/download?version=${version.id}&expires=${expires}&signature=${signature}`,
  });
});

// GET /api/v1/condominiums/:condoId/documents/:docId/download
router.get('/:condoId/documents/:docId/download', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId, docId } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id: docId },
      include: { versions: true },
    });

    if (!document || document.condominiumId !== condoId || document.deletedAt) {
      return res.status(404).json({ error: "Documento não encontrado neste condomínio." });
    }

    if (!await canAccessDocument(req, document, condoId)) {
      return res.status(403).json({ error: 'Acesso negado a este documento.' });
    }

    // Resolve version file path
    const latestVersion = latestDocumentVersion(document.versions);
    if (!latestVersion) {
      return res.status(410).json({ error: 'Documento indisponível: nenhuma versão foi registrada.' });
    }
    if (latestVersion.scanStatus !== DocumentScanStatus.clean) {
      return res.status(423).json({ error: 'Documento em quarentena ou ainda não liberado pelo antivírus.' });
    }
    const expires = Number(req.query.expires);
    const signature = typeof req.query.signature === 'string' ? req.query.signature : '';
    const versionId = typeof req.query.version === 'string' ? req.query.version : '';
    const expected = downloadSignature(req.user.id, condoId, document.id, latestVersion.id, expires);
    if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + 10 * 60 * 1000
      || versionId !== latestVersion.id || !signaturesMatch(signature, expected)) {
      return res.status(403).json({ error: 'Link de download inválido ou expirado.' });
    }

    if (latestVersion.accountId && latestVersion.condominiumId) {
      const expectedPrefix = expectedTenantStoragePrefix(latestVersion.accountId, latestVersion.condominiumId);
      if (!latestVersion.filePath.startsWith(expectedPrefix)) {
        return res.status(410).json({ error: 'Documento indisponível: chave de armazenamento inválida.' });
      }
    }
    const absolutePath = latestVersion.accountId
      ? resolveDocumentStoragePath(latestVersion.filePath)
      : resolveStoredDocumentPath(latestVersion.filePath);
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

// GET /api/v1/condominiums/:condoId/documents/catalog
router.get('/:condoId/documents/catalog', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff,
]), async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { condominiumId: req.params.condoId, deletedAt: null },
    include: { versions: { include: { _count: { select: { chunks: true } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(documents.map(serializeDocument));
});

// POST /api/v1/condominiums/:condoId/documents/upload
router.post(
  '/:condoId/documents/upload',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff]),
  requireDocumentIngestion,
  uploadDocuments,
  async (req: any, res) => {
    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    if (files.length === 0) return res.status(400).json({ error: 'Selecione ao menos um arquivo.' });
    const condominiumIdResult = z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/).safeParse(
      typeof req.params.condoId === 'string' ? req.params.condoId : undefined
    );
    if (!condominiumIdResult.success) return res.status(400).json({ error: 'Identificador de condomínio inválido.' });
    const condominiumId = condominiumIdResult.data;
    const totalRequestBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalRequestBytes > documentUploadLimits.maxRequestSizeBytes) {
      return res.status(413).json({ error: 'O conjunto de arquivos excede o limite total por envio.', code: 'REQUEST_TOO_LARGE' });
    }
    const categoryResult = z.string().trim().min(1).max(80).safeParse(req.body.category || 'other');
    const roleResult = z.enum(PlatformRole).safeParse(req.body.requiredRole || PlatformRole.staff);
    const associationResult = documentAssociationsSchema.safeParse(req.body);
    if (!categoryResult.success || !roleResult.success || !associationResult.success) return res.status(400).json({ error: 'Categoria, perfil de acesso ou associação inválida.' });
    try {
      await validateDocumentAssociations(condominiumId, associationResult.data);
    } catch {
      return res.status(400).json({ error: 'A associação informada não pertence ao condomínio ativo.' });
    }

    const condominium = await prisma.condominium.findUnique({
      where: { id: condominiumId },
      select: { accountId: true },
    });
    if (!condominium) return res.status(404).json({ error: 'Condomínio não encontrado.' });

    try {
      await assertDocumentUploadQuota(condominiumId, totalRequestBytes, files.length);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UPLOAD_QUOTA_EXCEEDED';
      return res.status(429).json({ error: uploadErrorMessages[code] || 'Cota documental excedida.', code });
    }

    const uploads: any[] = [];
    const errors: any[] = [];
    for (const file of files) {
      let storageKey: string | null = null;
      try {
        const inspected = await inspectDocumentFile(file);
        const checksum = createHash('sha256').update(file.buffer).digest('hex');
        const duplicate = await prisma.documentVersion.findFirst({
          where: { condominiumId, checksum },
          include: { document: true },
        });
        if (duplicate) {
          errors.push({ fileName: file.originalname, code: 'DUPLICATE', message: `Arquivo já cadastrado como “${duplicate.document.title}”.`, documentId: duplicate.documentId });
          continue;
        }

        const documentId = randomUUID();
        const versionId = randomUUID();
        storageKey = buildDocumentStorageKey({
          accountId: condominium.accountId,
          condominiumId,
          documentId,
          versionId,
          extension: inspected.extension,
        });
        await writeDocumentFile(storageKey, file.buffer);
        const title = path.basename(file.originalname, path.extname(file.originalname)).slice(0, 180) || 'Documento sem título';
        const document = await prisma.$transaction(async (tx) => {
          const created = await tx.document.create({
            data: {
              id: documentId,
              condominiumId,
              title,
              category: categoryResult.data,
              requiredRole: roleResult.data,
              ...associationResult.data,
              filePath: storageKey!,
              versions: {
                create: {
                  id: versionId,
                  accountId: condominium.accountId,
                  condominiumId,
                  versionNumber: 1,
                  filePath: storageKey!,
                  originalFileName: file.originalname.slice(0, 255),
                  mimeType: inspected.mimeType,
                  sizeBytes: file.size,
                  checksum,
                  uploadedBy: req.user.email,
                },
              },
            },
            include: { versions: { include: { _count: { select: { chunks: true } } } } },
          });
          await tx.auditEvent.create({
            data: {
              accountId: condominium.accountId,
              condominiumId,
              userId: req.user.id,
              userEmail: req.user.email,
              action: 'create',
              entity: 'DocumentVersion',
              entityId: versionId,
              details: `Upload recebido: ${file.originalname}, ${file.size} bytes, checksum ${checksum}.`,
              ipAddress: req.ip,
            },
          });
          return created;
        });
        uploads.push(serializeDocument(document));
        queueDocumentProcessing(versionId);
      } catch (error) {
        if (storageKey) await deleteDocumentFile(storageKey).catch(() => undefined);
        const message = error instanceof Error ? error.message : 'Falha no upload.';
        const code = message.split(':')[0];
        errors.push({ fileName: file.originalname, code, message: uploadErrorMessages[code] || (message.startsWith('FILE_TOO_LARGE') ? 'Arquivo acima do limite permitido.' : message) });
      }
    }
    res.status(uploads.length ? 201 : 422).json({ uploads, errors, limits: documentUploadLimits });
  },
);

// POST /api/v1/condominiums/:condoId/documents/:docId/versions
router.post(
  '/:condoId/documents/:docId/versions',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff]),
  requireDocumentIngestion,
  uploadDocumentVersion,
  async (req: any, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'Selecione o arquivo da nova versão.' });
    const document = await prisma.document.findFirst({
      where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!document) return res.status(404).json({ error: 'Documento não encontrado.' });
    const condominium = await prisma.condominium.findUnique({ where: { id: req.params.condoId }, select: { accountId: true } });
    if (!condominium) return res.status(404).json({ error: 'Condomínio não encontrado.' });

    let storageKey: string | null = null;
    try {
      const inspected = await inspectDocumentFile(file);
      await assertDocumentUploadQuota(req.params.condoId, file.size, 0, 1);
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      const duplicate = await prisma.documentVersion.findFirst({ where: { condominiumId: req.params.condoId, checksum } });
      if (duplicate) return res.status(409).json({ error: 'Este conteúdo já está cadastrado no condomínio.', code: 'DUPLICATE', documentId: duplicate.documentId });
      const versionId = randomUUID();
      const versionNumber = (document.versions[0]?.versionNumber || 0) + 1;
      storageKey = buildDocumentStorageKey({
        accountId: condominium.accountId,
        condominiumId: req.params.condoId,
        documentId: document.id,
        versionId,
        extension: inspected.extension,
      });
      await writeDocumentFile(storageKey, file.buffer);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.documentVersion.create({
          data: {
            id: versionId,
            documentId: document.id,
            accountId: condominium.accountId,
            condominiumId: req.params.condoId,
            versionNumber,
            filePath: storageKey!,
            originalFileName: file.originalname.slice(0, 255),
            mimeType: inspected.mimeType,
            sizeBytes: file.size,
            checksum,
            uploadedBy: req.user.email,
          },
        });
        const result = await tx.document.update({
          where: { id: document.id },
          data: { filePath: storageKey! },
          include: { versions: { include: { _count: { select: { chunks: true } } } } },
        });
        await tx.auditEvent.create({
          data: {
            accountId: condominium.accountId,
            condominiumId: req.params.condoId,
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'create',
            entity: 'DocumentVersion',
            entityId: versionId,
            details: `Versão ${versionNumber} recebida para o documento ${document.id}; checksum ${checksum}.`,
            ipAddress: req.ip,
          },
        });
        return result;
      });
      queueDocumentProcessing(versionId);
      res.status(201).json(serializeDocument(updated));
    } catch (error) {
      if (storageKey) await deleteDocumentFile(storageKey).catch(() => undefined);
      const code = error instanceof Error ? error.message.split(':')[0] : 'VERSION_UPLOAD_FAILED';
      console.error('Create Document Version Error:', error);
      res.status(code.endsWith('QUOTA_EXCEEDED') ? 429 : 422).json({ error: uploadErrorMessages[code] || 'Não foi possível registrar a nova versão.', code });
    }
  },
);

router.post('/:condoId/documents/:docId/retry', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff,
]), requireDocumentIngestion, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  const version = document?.versions[0];
  if (!version) return res.status(404).json({ error: 'Documento não encontrado.' });
  if (version.processingStatus !== DocumentProcessingStatus.failed
    && version.processingStatus !== DocumentProcessingStatus.partial
    && version.processingStatus !== DocumentProcessingStatus.cancelled) {
    return res.status(409).json({ error: 'Este documento não está disponível para reprocessamento.' });
  }
  await prisma.documentVersion.update({ where: { id: version.id }, data: { processingStatus: DocumentProcessingStatus.queued, processingError: null } });
  queueDocumentProcessing(version.id);
  res.status(202).json({ id: document!.id, versionId: version.id, status: DocumentProcessingStatus.queued });
});

router.post('/:condoId/documents/:docId/cancel', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff,
]), async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  const version = document?.versions[0];
  if (!version) return res.status(404).json({ error: 'Documento não encontrado.' });
  await prisma.documentVersion.update({ where: { id: version.id }, data: { processingStatus: DocumentProcessingStatus.cancelled, processingError: 'Processamento cancelado pelo usuário.' } });
  res.json({ id: document!.id, status: DocumentProcessingStatus.cancelled });
});

router.patch('/:condoId/documents/:docId', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager,
]), validateBody(updateDocumentSchema), async (req: any, res) => {
  const existing = await prisma.document.findFirst({ where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'Documento não encontrado.' });
  try {
    await validateDocumentAssociations(req.params.condoId, {
      unitId: Object.hasOwn(req.body, 'unitId') ? req.body.unitId || undefined : existing.unitId || undefined,
      buildingId: Object.hasOwn(req.body, 'buildingId') ? req.body.buildingId || undefined : existing.buildingId || undefined,
      equipmentId: Object.hasOwn(req.body, 'equipmentId') ? req.body.equipmentId || undefined : existing.equipmentId || undefined,
      maintenancePlanId: Object.hasOwn(req.body, 'maintenancePlanId') ? req.body.maintenancePlanId || undefined : existing.maintenancePlanId || undefined,
      maintenanceTicketId: Object.hasOwn(req.body, 'maintenanceTicketId') ? req.body.maintenanceTicketId || undefined : existing.maintenanceTicketId || undefined,
    });
  } catch {
    return res.status(400).json({ error: 'A associação informada não pertence ao condomínio ativo.' });
  }
  const condominium = await prisma.condominium.findUnique({ where: { id: req.params.condoId }, select: { accountId: true } });
  const document = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: existing.id },
      data: req.body,
      include: { versions: { include: { _count: { select: { chunks: true } } } } },
    });
    if (condominium) await tx.auditEvent.create({
      data: {
        accountId: condominium.accountId,
        condominiumId: req.params.condoId,
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'update',
        entity: 'Document',
        entityId: existing.id,
        details: `Metadados documentais alterados: ${Object.keys(req.body).join(', ')}.`,
        ipAddress: req.ip,
      },
    });
    return updated;
  });
  res.json(serializeDocument(document));
});

router.patch('/:condoId/documents/:docId/retention', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager,
]), validateBody(retentionSchema), async (req: any, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.docId, condominiumId: req.params.condoId },
    include: { condominium: { select: { accountId: true } } },
  });
  if (!document) return res.status(404).json({ error: 'Documento nao encontrado.' });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.document.update({ where: { id: document.id }, data: req.body });
    await tx.auditEvent.create({
      data: {
        accountId: document.condominium.accountId,
        condominiumId: req.params.condoId,
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'update',
        entity: 'Document',
        entityId: document.id,
        details: `Controles de retencao alterados: ${Object.keys(req.body).join(', ')}.`,
        ipAddress: req.ip,
      },
    });
    return result;
  });
  res.json({ id: updated.id, retentionUntil: updated.retentionUntil, legalHold: updated.legalHold });
});

router.delete('/:condoId/documents/:docId', requireAuth, tenantGuard, requireRole([
  PlatformRole.syndic, PlatformRole.manager,
]), async (req: any, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.docId, condominiumId: req.params.condoId, deletedAt: null },
    include: { condominium: { select: { accountId: true } } },
  });
  if (!document) return res.status(404).json({ error: 'Documento não encontrado.' });
  const retentionDays = Math.min(Math.max(Number(process.env.DOCUMENT_RETENTION_DAYS || 30), 1), 3650);
  const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.document.update({ where: { id: document.id }, data: { deletedAt: new Date(), retentionUntil } }),
    prisma.auditEvent.create({
      data: {
        accountId: document.condominium.accountId,
        condominiumId: req.params.condoId,
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'delete',
        entity: 'Document',
        entityId: document.id,
        details: `Documento "${document.title}" removido logicamente; retencao ate ${retentionUntil.toISOString()}.`,
        ipAddress: req.ip,
      },
    }),
  ]);
  res.status(204).end();
});

// Metadata-only registration is intentionally disabled. Documents must pass
// through the upload lifecycle so storage keys and checksums remain server-owned.
router.post(
  '/:condoId/documents',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  (_req, res) => {
    res.status(410).json({
      error: 'O cadastro por caminho foi descontinuado. Envie o arquivo pelo endpoint /documents/upload.',
      code: 'DOCUMENT_UPLOAD_REQUIRED',
    });
  }
);

export default router;
