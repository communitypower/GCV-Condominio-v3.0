import { DocumentProcessingStatus, DocumentScanStatus, PlatformRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stopWords = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'por', 'com', 'um', 'uma', 'que']);

export type RetrievalAccessContext = {
  userId: string;
  isSystemAdmin: boolean;
  roles: PlatformRole[];
};

const privilegedDocumentRoles = new Set<PlatformRole>([
  PlatformRole.admin,
  PlatformRole.syndic,
  PlatformRole.manager,
]);

function queryTerms(query: string) {
  return [...new Set(query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stopWords.has(term)))];
}

export async function retrieveKnowledge(input: {
  accountId: string;
  condominiumId: string;
  query: string;
  access: RetrievalAccessContext;
  versionIds?: string[];
  limit?: number;
}) {
  if (!input.accountId?.trim() || !input.condominiumId?.trim()) throw new Error('TENANT_SCOPE_REQUIRED');
  if (!input.access.userId?.trim() || (!input.access.isSystemAdmin && input.access.roles.length === 0)) {
    throw new Error('RETRIEVAL_ACCESS_CONTEXT_REQUIRED');
  }

  const privileged = input.access.isSystemAdmin || input.access.roles.some((role) => privilegedDocumentRoles.has(role));
  const requiredRoles = privileged
    ? Object.values(PlatformRole)
    : [...new Set([...input.access.roles, PlatformRole.resident])];
  const unitIds = privileged ? [] : (await prisma.unitRelationship.findMany({
    where: {
      endDate: null,
      person: { user: { id: input.access.userId } },
      unit: { building: { condominiumId: input.condominiumId } },
    },
    select: { unitId: true },
  })).map((relationship) => relationship.unitId);

  // Resolve current versions before chunks. A clean older version must not be
  // used as fallback while the latest version is quarantined or incomplete.
  const documents = await prisma.document.findMany({
    where: {
      condominiumId: input.condominiumId,
      condominium: { accountId: input.accountId },
      deletedAt: null,
      requiredRole: { in: requiredRoles },
      ...(!privileged ? { OR: [{ unitId: null }, { unitId: { in: unitIds } }] } : {}),
    },
    select: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: {
          id: true,
          accountId: true,
          condominiumId: true,
          scanStatus: true,
          processingStatus: true,
        },
      },
    },
    take: 2000,
  });
  const requestedVersions = input.versionIds?.length ? new Set(input.versionIds) : null;
  const eligibleVersionIds = documents.flatMap((document) => {
    const version = document.versions[0];
    if (!version
      || version.accountId !== input.accountId
      || version.condominiumId !== input.condominiumId
      || version.scanStatus !== DocumentScanStatus.clean
      || version.processingStatus !== DocumentProcessingStatus.indexed
      || (requestedVersions && !requestedVersions.has(version.id))) return [];
    return [version.id];
  });
  if (eligibleVersionIds.length === 0) return [];

  const chunks = await prisma.documentChunk.findMany({
    where: {
      accountId: input.accountId,
      condominiumId: input.condominiumId,
      versionId: { in: eligibleVersionIds },
    },
    include: { version: { include: { document: { select: { id: true, title: true, category: true } } } } },
    take: 1500,
    orderBy: { createdAt: 'desc' },
  });
  const terms = queryTerms(input.query);
  return chunks
    .map((chunk) => {
      const haystack = `${chunk.version.document.title} ${chunk.sourceLocator} ${chunk.content}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((item) => terms.length === 0 || item.score > 0)
    .sort((a, b) => b.score - a.score || b.chunk.createdAt.getTime() - a.chunk.createdAt.getTime())
    .slice(0, Math.min(Math.max(input.limit || 8, 1), 20))
    .map(({ chunk }) => ({
      chunkId: chunk.id,
      documentId: chunk.version.document.id,
      versionId: chunk.versionId,
      title: chunk.version.document.title,
      category: chunk.version.document.category,
      locator: chunk.sourceLocator,
      excerpt: chunk.content,
      quoteHash: chunk.quoteHash,
    }));
}
