import { createHash } from 'node:crypto';
import mammoth from 'mammoth';
import readXlsxFile from 'read-excel-file/node';
import { extractText as extractPdfText } from 'unpdf';
import { extractTextWithOcr } from './document-security';

export type ExtractedSection = {
  locator: string;
  text: string;
  metadata?: Record<string, unknown>;
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function injectionFlags(text: string) {
  const normalized = text.toLowerCase();
  const patterns = [
    /ignore (all|any|the|previous) (instructions|rules)/,
    /system prompt/,
    /reveal (secrets|credentials|passwords)/,
    /exfiltrat/,
    /acesse (outro|todos os) condom[ií]nio/,
  ];
  return patterns.filter((pattern) => pattern.test(normalized)).map((pattern) => pattern.source);
}

export async function extractDocumentSections(buffer: Buffer, mimeType: string, fileName?: string | null): Promise<{
  sections: ExtractedSection[];
  partialReason?: string;
}> {
  if (mimeType === 'application/pdf') {
    const result = await extractPdfText(new Uint8Array(buffer), { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    const sections = pages.map((text, index) => ({ locator: `Página ${index + 1}`, text: normalizeText(text) })).filter((item) => item.text);
    if (sections.length > 0) return { sections };
    const ocrSections = await extractTextWithOcr({ buffer, mimeType, fileName });
    return ocrSections
      ? { sections: ocrSections.map((section) => ({ ...section, text: normalizeText(section.text), metadata: { extractedBy: 'ocr' } })) }
      : { sections: [], partialReason: 'PDF sem texto extraível e OCR não configurado neste ambiente.' };
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return { sections: [{ locator: 'Documento', text: normalizeText(result.value), metadata: { warnings: result.messages.length } }] };
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const sheets = await readXlsxFile(buffer);
    return {
      sections: sheets.map(({ sheet, data }) => ({
        locator: `Planilha ${sheet}`,
        text: normalizeText(data.map((row) => row.map((cell) => cell == null ? '' : String(cell)).join(' | ')).join('\n')),
        metadata: { sheet },
      })).filter((item) => item.text),
    };
  }
  if (mimeType.startsWith('image/')) {
    const ocrSections = await extractTextWithOcr({ buffer, mimeType, fileName });
    return ocrSections
      ? { sections: ocrSections.map((section) => ({ ...section, text: normalizeText(section.text), metadata: { extractedBy: 'ocr' } })) }
      : { sections: [], partialReason: 'OCR não configurado para imagens neste ambiente.' };
  }

  const raw = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const text = mimeType === 'application/json' ? JSON.stringify(JSON.parse(raw), null, 2) : raw;
  return { sections: [{ locator: 'Conteúdo', text: normalizeText(text) }] };
}

export function chunkExtractedSections(sections: ExtractedSection[], maxLength = 1800, overlap = 180) {
  const chunks: Array<ExtractedSection & { quoteHash: string; securityFlags: string[] }> = [];
  for (const section of sections) {
    for (let offset = 0; offset < section.text.length; offset += maxLength - overlap) {
      const text = section.text.slice(offset, offset + maxLength).trim();
      if (!text) continue;
      chunks.push({
        ...section,
        locator: section.text.length > maxLength ? `${section.locator}, trecho ${chunks.length + 1}` : section.locator,
        text,
        quoteHash: createHash('sha256').update(text).digest('hex'),
        securityFlags: injectionFlags(text),
      });
    }
  }
  return chunks;
}
