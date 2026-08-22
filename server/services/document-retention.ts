import { AuditAction, PrismaClient } from '@prisma/client';
import { deleteDocumentFile } from './document-storage';

const prisma = new PrismaClient();

export interface DocumentPurgeResult {
  eligible: number;
  purged: string[];
  failed: Array<{ documentId: string; error: string }>;
}

export async function purgeExpiredDocuments(input: {
  execute: boolean;
  limit?: number;
  now?: Date;
}): Promise<DocumentPurgeResult> {
  const now = input.now || new Date();
  const documents = await prisma.document.findMany({
    where: {
      deletedAt: { not: null },
      retentionUntil: { lte: now },
      legalHold: false,
      purgedAt: null,
    },
    include: {
      condominium: { select: { accountId: true } },
      versions: { select: { id: true, filePath: true } },
    },
    orderBy: { retentionUntil: 'asc' },
    take: Math.min(Math.max(input.limit || 100, 1), 500),
  });

  const result: DocumentPurgeResult = { eligible: documents.length, purged: [], failed: [] };
  if (!input.execute) return result;

  for (const document of documents) {
    try {
      const claimed = await prisma.document.updateMany({
        where: {
          id: document.id,
          deletedAt: { not: null },
          retentionUntil: { lte: now },
          legalHold: false,
          purgedAt: null,
        },
        data: { purgeRequestedAt: now },
      });
      if (claimed.count !== 1) continue;

      for (const version of document.versions) {
        await deleteDocumentFile(version.filePath);
      }

      const versionIds = document.versions.map((version) => version.id);
      await prisma.$transaction(async (tx) => {
        if (versionIds.length) {
          await tx.aiProposal.deleteMany({ where: { sourceVersionId: { in: versionIds } } });
          await tx.documentVersion.deleteMany({ where: { id: { in: versionIds } } });
        }
        await tx.document.update({
          where: { id: document.id },
          data: { filePath: '', purgedAt: now },
        });
        await tx.auditEvent.create({
          data: {
            accountId: document.condominium.accountId,
            condominiumId: document.condominiumId,
            action: AuditAction.delete,
            entity: 'Document',
            entityId: document.id,
            details: `Expurgo fisico concluido apos retencao; ${document.versions.length} versao(oes) removida(s).`,
          },
        });
      });
      result.purged.push(document.id);
    } catch (error) {
      result.failed.push({
        documentId: document.id,
        error: error instanceof Error ? error.message : 'Falha desconhecida no expurgo.',
      });
    }
  }

  return result;
}
