import { connect } from 'node:net';

type ScanResult = { status: 'clean' | 'infected' | 'unavailable'; details?: string };

async function scanWithClamavTcp(endpoint: string, input: { buffer: Buffer }) {
  const url = new URL(endpoint);
  const port = Number(url.port || 3310);
  return new Promise<'clean' | 'infected'>((resolve, reject) => {
    const socket = connect({ host: url.hostname, port });
    const timeout = setTimeout(() => finish(new Error('CLAMAV_TCP_TIMEOUT')), 30_000);
    let finished = false;
    let response = '';
    const finish = (result: 'clean' | 'infected' | Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.destroy();
      result instanceof Error ? reject(result) : resolve(result);
    };
    socket.once('error', finish);
    socket.once('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < input.buffer.length; offset += 65_536) {
        const chunk = input.buffer.subarray(offset, offset + 65_536);
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (!response.includes('\0')) return;
      if (/\bOK\0/.test(response)) return finish('clean');
      if (/\bFOUND\0/.test(response)) return finish('infected');
      finish(new Error(`CLAMAV_TCP_INVALID_RESPONSE:${response.slice(0, 120)}`));
    });
  });
}

export function requiresCleanMalwareScan() {
  if (process.env.DOCUMENT_AV_FAIL_CLOSED === 'true') return true;
  return ['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase());
}

function syntheticScanBypassAllowed() {
  const environment = (process.env.NODE_ENV || 'development').toLowerCase();
  return !requiresCleanMalwareScan()
    && (['test', 'development'].includes(environment) || process.env.DOCUMENT_ALLOW_UNSCANNED_LOCAL === 'true');
}

export async function scanDocumentContent(input: { buffer: Buffer; mimeType: string; fileName?: string | null }): Promise<ScanResult> {
  const endpoint = process.env.DOCUMENT_ANTIVIRUS_URL;
  const protocol = process.env.DOCUMENT_ANTIVIRUS_PROTOCOL || 'json';
  if (!endpoint) {
    return syntheticScanBypassAllowed()
      ? { status: 'clean', details: 'Bypass sintético permitido somente em ambiente local/teste.' }
      : { status: 'unavailable', details: 'Antivírus não configurado; arquivo mantido em quarentena.' };
  }
  try {
    if (protocol === 'clamav_tcp') {
      const status = await scanWithClamavTcp(endpoint, input);
      return status === 'infected'
        ? { status, details: 'ClamAV identificou conteúdo malicioso.' }
        : { status, details: 'Arquivo verificado pelo ClamAV.' };
    }
    const headers = {
      'Content-Type': input.mimeType,
      'X-File-Name': encodeURIComponent(input.fileName || 'document'),
      ...(process.env.DOCUMENT_ANTIVIRUS_TOKEN ? { Authorization: `Bearer ${process.env.DOCUMENT_ANTIVIRUS_TOKEN}` } : {}),
    };
    const body = new Uint8Array(input.buffer);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return { status: 'unavailable', details: `Antivírus respondeu HTTP ${response.status}; arquivo mantido em quarentena.` };
    const result = await response.json() as { status?: string; details?: string };
    if (result.status !== 'clean' && result.status !== 'infected') {
      return { status: 'unavailable', details: 'Resposta inválida do antivírus; arquivo mantido em quarentena.' };
    }
    return { status: result.status, details: result.details };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'falha desconhecida';
    return { status: 'unavailable', details: `Antivírus indisponível (${reason}); arquivo mantido em quarentena.` };
  }
}

export async function extractTextWithOcr(input: { buffer: Buffer; mimeType: string; fileName?: string | null }) {
  const endpoint = process.env.DOCUMENT_OCR_URL;
  if (!endpoint) return null;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': input.mimeType,
      'X-File-Name': encodeURIComponent(input.fileName || 'document'),
      ...(process.env.DOCUMENT_OCR_TOKEN ? { Authorization: `Bearer ${process.env.DOCUMENT_OCR_TOKEN}` } : {}),
    },
    body: new Uint8Array(input.buffer),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OCR_UNAVAILABLE:${response.status}`);
  const result = await response.json() as { text?: string; pages?: Array<{ page: number; text: string }> };
  if (Array.isArray(result.pages)) return result.pages.map((page) => ({ locator: `Página ${page.page}`, text: page.text }));
  if (result.text) return [{ locator: 'OCR', text: result.text }];
  throw new Error('OCR_INVALID_RESPONSE');
}
