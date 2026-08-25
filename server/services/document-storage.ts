import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const storageRoot = path.resolve(process.env.DOCUMENT_STORAGE_PATH || 'uploads');

function safeStoragePath(storageKey: string) {
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.split(/[\\/]+/).includes('..')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  const absolutePath = path.resolve(storageRoot, storageKey);
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) throw new Error('INVALID_STORAGE_KEY');
  return absolutePath;
}

export function buildDocumentStorageKey(input: {
  accountId: string;
  condominiumId: string;
  documentId: string;
  versionId: string;
  extension: string;
}) {
  const extension = input.extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return path.posix.join(
    'accounts', input.accountId,
    'condominiums', input.condominiumId,
    'documents', input.documentId,
    'versions', input.versionId,
    `${randomUUID()}${extension ? `.${extension}` : ''}`,
  );
}

export async function writeDocumentFile(storageKey: string, content: Buffer) {
  const absolutePath = safeStoragePath(storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, content, { flag: 'wx', mode: 0o600 });
  await fs.rename(temporaryPath, absolutePath);
}

export async function readDocumentFile(storageKey: string) {
  return fs.readFile(safeStoragePath(storageKey));
}

export async function deleteDocumentFile(storageKey: string) {
  await fs.rm(safeStoragePath(storageKey), { force: true });
}

export function resolveDocumentStoragePath(storageKey: string) {
  return safeStoragePath(storageKey);
}

export function expectedTenantStoragePrefix(accountId: string, condominiumId: string) {
  return path.posix.join('accounts', accountId, 'condominiums', condominiumId) + '/';
}
