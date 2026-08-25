import { connect } from 'node:http2';

type ScanResult = { status: 'clean' | 'infected' | 'unavailable'; details?: string };

async function scanWithClamavRestH2c(endpoint: string, input: { buffer: Buffer; mimeType: string; fileName?: string | null }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:') throw new Error('CLAMAV_REST_H2C_REQUIRES_HTTP');

  const boundary = `----gcv-${crypto.randomUUID()}`;
  const fileName = (input.fileName || 'document').replace(/[\r\n"]/g, '_');
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
    input.buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return new Promise<number>((resolve, reject) => {
    const client = connect(url.origin);
    const timeout = setTimeout(() => finish(new Error('CLAMAV_REST_TIMEOUT')), 30_000);
    let finished = false;
    const finish = (result: number | Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      client.close();
      result instanceof Error ? reject(result) : resolve(result);
    };
    client.once('error', finish);
    const request = client.request({
      ':method': 'POST',
      ':path': `${url.pathname}${url.search}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(payload.length),
      ...(process.env.DOCUMENT_ANTIVIRUS_TOKEN ? { authorization: `Bearer ${process.env.DOCUMENT_ANTIVIRUS_TOKEN}` } : {}),
    });
    request.once('error', finish);
    request.once('response', (headers) => {
      const status = Number(headers[':status']);
      request.resume();
      request.once('end', () => finish(status));
    });
    request.end(payload);
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
    const isClamavRest = protocol === 'clamav_rest';
    if (isClamavRest) {
      const status = await scanWithClamavRestH2c(endpoint, input);
      if (status === 406) return { status: 'infected', details: 'ClamAV identificou conteúdo malicioso.' };
      if (status >= 200 && status < 300) return { status: 'clean', details: 'Arquivo verificado pelo ClamAV.' };
      return { status: 'unavailable', details: `ClamAV respondeu HTTP ${status}; arquivo mantido em quarentena.` };
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
