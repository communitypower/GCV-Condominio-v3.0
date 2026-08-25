import path from 'node:path';

const MAX_FILE_SIZE_BYTES = Number(process.env.DOCUMENT_MAX_FILE_SIZE_BYTES || 20 * 1024 * 1024);
const MAX_REQUEST_SIZE_BYTES = Number(process.env.DOCUMENT_MAX_REQUEST_SIZE_BYTES || 40 * 1024 * 1024);
const MAX_ARCHIVE_ENTRIES = Number(process.env.DOCUMENT_MAX_ARCHIVE_ENTRIES || 2000);
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = Number(process.env.DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES || 100 * 1024 * 1024);
const MAX_ARCHIVE_ENTRY_BYTES = Number(process.env.DOCUMENT_MAX_ARCHIVE_ENTRY_BYTES || 50 * 1024 * 1024);
const MAX_ARCHIVE_COMPRESSION_RATIO = Number(process.env.DOCUMENT_MAX_ARCHIVE_COMPRESSION_RATIO || 100);

const allowedExtensions = new Map<string, string[]>([
  ['pdf', ['application/pdf']],
  ['docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
  ['csv', ['text/csv', 'text/plain', 'application/csv']],
  ['json', ['application/json', 'text/plain']],
  ['txt', ['text/plain']],
  ['png', ['image/png']],
  ['jpg', ['image/jpeg']],
  ['jpeg', ['image/jpeg']],
  ['webp', ['image/webp']],
  ['tif', ['image/tiff']],
  ['tiff', ['image/tiff']],
]);

function looksLikeText(buffer: Buffer) {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
  return !sample.includes('\uFFFD');
}

function detectedBinaryMime(buffer: Buffer, extension: string) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return 'image/tiff';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return undefined;
}

function inspectZipContainer(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdSize = 22;
  const searchStart = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.length - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('ARCHIVE_INVALID');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('ARCHIVE_ZIP64_UNSUPPORTED');
  }
  if (entryCount > MAX_ARCHIVE_ENTRIES) throw new Error('ARCHIVE_TOO_MANY_ENTRIES');
  if (centralDirectoryOffset + centralDirectorySize > buffer.length || centralDirectoryOffset >= eocdOffset) {
    throw new Error('ARCHIVE_INVALID');
  }

  let offset = centralDirectoryOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== centralSignature) throw new Error('ARCHIVE_INVALID');
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > buffer.length) throw new Error('ARCHIVE_INVALID');
    if ((flags & 0x1) !== 0) throw new Error('ARCHIVE_ENCRYPTED');
    if (![0, 8].includes(compressionMethod)) throw new Error('ARCHIVE_COMPRESSION_UNSUPPORTED');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) throw new Error('ARCHIVE_ZIP64_UNSUPPORTED');
    if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) throw new Error('ARCHIVE_ENTRY_TOO_LARGE');
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8').replace(/\\/g, '/');
    if (fileName.startsWith('/') || fileName.split('/').includes('..') || fileName.includes('\0')) throw new Error('ARCHIVE_UNSAFE_PATH');
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new Error('ARCHIVE_EXPANSION_LIMIT');
    offset = nextOffset;
  }
  const ratio = totalUncompressed / Math.max(totalCompressed, 1);
  if (ratio > MAX_ARCHIVE_COMPRESSION_RATIO) throw new Error('ARCHIVE_COMPRESSION_RATIO_EXCEEDED');
}

export async function inspectDocumentFile(file: Express.Multer.File) {
  if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE:${MAX_FILE_SIZE_BYTES}`);
  }
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const expectedMimes = allowedExtensions.get(extension);
  if (!expectedMimes) throw new Error('UNSUPPORTED_FILE_EXTENSION');

  let mimeType = detectedBinaryMime(file.buffer, extension);
  if (!mimeType && ['csv', 'json', 'txt'].includes(extension) && looksLikeText(file.buffer)) {
    mimeType = extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv' : 'text/plain';
  }
  if (!mimeType || !expectedMimes.includes(mimeType)) throw new Error('FILE_TYPE_MISMATCH');
  if (extension === 'docx' || extension === 'xlsx') inspectZipContainer(file.buffer);
  if (extension === 'json') JSON.parse(file.buffer.toString('utf8').replace(/^\uFEFF/, ''));

  return { extension, mimeType, maxFileSizeBytes: MAX_FILE_SIZE_BYTES };
}

export const documentUploadLimits = {
  maxFiles: 8,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  maxRequestSizeBytes: MAX_REQUEST_SIZE_BYTES,
  maxTenantStorageBytes: Number(process.env.DOCUMENT_MAX_TENANT_STORAGE_BYTES || 1024 * 1024 * 1024),
  maxTenantDocuments: Number(process.env.DOCUMENT_MAX_TENANT_DOCUMENTS || 5000),
  maxPendingVersions: Number(process.env.DOCUMENT_MAX_PENDING_VERSIONS || 25),
  extensions: [...allowedExtensions.keys()],
};
