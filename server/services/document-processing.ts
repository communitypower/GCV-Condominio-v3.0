import { DocumentProcessingStatus, DocumentScanStatus, Prisma, PrismaClient } from '@prisma/client';
import { chunkExtractedSections, extractDocumentSections } from './document-extraction';
import { readDocumentFile } from './document-storage';
import { requiresCleanMalwareScan, scanDocumentContent } from './document-security';

const prisma = new PrismaClient();
const activeProcessing = new Set<string>();
const pendingProcessing: string[] = [];
const queuedProcessing = new Set<string>();
const maxConcurrentProcessing = Math.max(1, Number(process.env.DOCUMENT_PROCESSING_CONCURRENCY || 2));

export async function processDocumentVersion(versionId: string) {
  if (activeProcessing.has(versionId)) return;
  activeProcessing.add(versionId);
  try {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { condominium: { select: { accountId: true } } } } },
    });
    if (!version || !version.condominiumId || !version.accountId || !version.mimeType) return;
    if (version.processingStatus === DocumentProcessingStatus.cancelled) return;

    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { processingStatus: DocumentProcessingStatus.scanning, scanStatus: DocumentScanStatus.pending, processingError: null },
    });
    const buffer = await readDocumentFile(version.filePath);
    const scan = await scanDocumentContent({ buffer, mimeType: version.mimeType, fileName: version.originalFileName });
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        scanStatus: scan.status === 'clean' ? DocumentScanStatus.clean : scan.status === 'infected' ? DocumentScanStatus.infected : DocumentScanStatus.unavailable,
        processingError: null,
      },
    });
    if (scan.status === 'infected' || (scan.status !== 'clean' && requiresCleanMalwareScan())) {
      const processingError = scan.status === 'infected'
        ? 'Arquivo bloqueado pelo antivírus.'
        : 'Antivírus indisponível; arquivo mantido em quarentena e não indexado.';
      await prisma.$transaction([
        prisma.documentChunk.deleteMany({ where: { versionId: version.id } }),
        prisma.documentVersion.update({
          where: { id: version.id },
          data: {
            processingStatus: DocumentProcessingStatus.failed,
            processingError,
            metadata: { scanner: scan.status, scannerDetails: scan.details || null, quarantine: true, sourceTrust: 'untrusted' },
          },
        }),
        prisma.auditEvent.create({
          data: {
            accountId: version.accountId,
            condominiumId: version.condominiumId,
            userEmail: version.uploadedBy,
            action: 'update',
            entity: 'DocumentVersion',
            entityId: version.id,
            details: scan.status === 'infected'
              ? 'Arquivo bloqueado pelo antivírus durante o processamento.'
              : 'Arquivo mantido em quarentena porque o antivírus está indisponível.',
          },
        }),
      ]);
      return;
    }

    // The scanner interface is explicit: production must configure an external
    // scanner before treating uploads as malware-cleared.
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { processingStatus: DocumentProcessingStatus.extracting },
    });

    const extraction = await extractDocumentSections(buffer, version.mimeType, version.originalFileName);
    const chunks = chunkExtractedSections(extraction.sections);
    const securityFlags = [...new Set(chunks.flatMap((chunk) => chunk.securityFlags))];

    await prisma.$transaction(async (tx) => {
      const current = await tx.documentVersion.findUnique({ where: { id: version.id }, select: { processingStatus: true } });
      if (current?.processingStatus === DocumentProcessingStatus.cancelled) return;
      await tx.documentChunk.deleteMany({ where: { versionId: version.id } });
      if (chunks.length > 0) {
        await tx.documentChunk.createMany({
          data: chunks.map((chunk, ordinal) => ({
            accountId: version.accountId!,
            condominiumId: version.condominiumId!,
            versionId: version.id,
            ordinal,
            content: chunk.text,
            sourceLocator: chunk.locator,
            quoteHash: chunk.quoteHash,
            metadata: {
              ...(chunk.metadata || {}),
              securityFlags: chunk.securityFlags,
              untrustedSource: true,
            } as Prisma.InputJsonValue,
          })),
        });
      }
      await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          processingStatus: extraction.partialReason ? DocumentProcessingStatus.partial : DocumentProcessingStatus.indexed,
          processingError: extraction.partialReason || null,
          extractedAt: new Date(),
          metadata: {
            chunkCount: chunks.length,
            securityFlags,
            scanner: scan.status,
            scannerDetails: scan.details || null,
            quarantine: false,
            sourceTrust: 'untrusted',
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          accountId: version.accountId!,
          condominiumId: version.condominiumId!,
          userEmail: version.uploadedBy,
          action: 'update',
          entity: 'DocumentVersion',
          entityId: version.id,
          details: `Processamento documental concluído com ${chunks.length} trecho(s); status ${extraction.partialReason ? 'parcial' : 'indexado'}.`,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida no processamento documental.';
    await prisma.documentVersion.updateMany({
      where: { id: versionId, processingStatus: { not: DocumentProcessingStatus.cancelled } },
      data: { processingStatus: DocumentProcessingStatus.failed, processingError: message.slice(0, 1000) },
    });
  } finally {
    activeProcessing.delete(versionId);
  }
}

export function queueDocumentProcessing(versionId: string) {
  if (activeProcessing.has(versionId) || queuedProcessing.has(versionId)) return;
  queuedProcessing.add(versionId);
  pendingProcessing.push(versionId);
  setImmediate(drainDocumentProcessingQueue);
}

function drainDocumentProcessingQueue() {
  while (activeProcessing.size < maxConcurrentProcessing && pendingProcessing.length > 0) {
    const versionId = pendingProcessing.shift()!;
    queuedProcessing.delete(versionId);
    void processDocumentVersion(versionId).finally(() => setImmediate(drainDocumentProcessingQueue));
  }
}

export async function resumePendingDocumentProcessing() {
  const pending = await prisma.documentVersion.findMany({
    where: {
      processingStatus: { in: [
        DocumentProcessingStatus.queued,
        DocumentProcessingStatus.scanning,
        DocumentProcessingStatus.extracting,
      ] },
      document: { deletedAt: null },
    },
    select: { id: true },
    take: 500,
    orderBy: { createdAt: 'asc' },
  });
  pending.forEach((version) => queueDocumentProcessing(version.id));
  return pending.length;
}
