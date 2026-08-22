import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { deleteDocumentFile } from '../../server/services/document-storage';

const prisma = new PrismaClient();
const localBaseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(localBaseUrl.hostname);
const createdTitles = new Set<string>();

async function cleanupDocuments() {
  if (!createdTitles.size) return;
  const documents = await prisma.document.findMany({
    where: { title: { in: [...createdTitles] } },
    include: { versions: { select: { id: true, filePath: true } } },
  });
  const documentIds = documents.map((document) => document.id);
  const versionIds = documents.flatMap((document) => document.versions.map((version) => version.id));
  for (const document of documents) {
    for (const version of document.versions) {
      await deleteDocumentFile(version.filePath).catch(() => undefined);
    }
  }
  await prisma.aiProposal.deleteMany({
    where: { sourceVersion: { documentId: { in: documentIds } } },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { entityId: { in: [...documentIds, ...versionIds] } },
        { details: { contains: [...createdTitles][0] || '__NO_TEST_DOCUMENT__' } },
      ],
    },
  });
  await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
  createdTitles.clear();
}

test.describe('document ingestion UX', () => {
  test.skip(!isLocal, 'A suíte cria e remove documentos somente no ambiente local.');

  test.afterEach(async () => {
    await cleanupDocuments();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('uploads by drag-and-drop, reports progress, and indexes the document in the real catalog', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await page.getByTestId('login-email').fill('sindico@gcv.com.br');
    await page.getByTestId('login-password').fill('sindico123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible();
    await page.getByTestId('nav-carga-dados').click();

    await expect(page.getByTestId('data-imports-page')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Arquivos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('document-drop-zone')).toBeVisible();
    await expect(page.getByTestId('document-file-input')).toHaveAttribute('multiple', '');

    const marker = `TEST_E2E_UI_DOCUMENT_${Date.now()}`;
    createdTitles.add(marker);
    const uploadResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/documents/upload'));

    await page.getByTestId('document-drop-zone').evaluate((element, input) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([input.content], input.fileName, { type: 'text/plain' }));
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }));
    }, {
      fileName: `${marker}.txt`,
      content: `${marker}\nManual técnico: inspecionar a bomba elevatória mensalmente.`,
    });

    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status(), await uploadResponse.text()).toBe(201);
    const uploadPayload = await uploadResponse.json() as any;
    expect(uploadPayload.uploads).toHaveLength(1);
    expect(uploadPayload.uploads[0].title).toBe(marker);

    await expect(page.getByText(`${marker}.txt`, { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Progresso total' })).toHaveAttribute('aria-valuemax', '100');

    const catalogRow = page.getByRole('row').filter({ hasText: marker });
    await expect(catalogRow).toBeVisible();
    await expect(catalogRow).toContainText('Concluído', { timeout: 15_000 });
    await expect(catalogRow).toContainText(/\d+ trecho\(s\)/);

    await page.getByPlaceholder('Buscar documento').fill(marker);
    await expect(catalogRow).toBeVisible();
    await page.getByPlaceholder('Buscar documento').fill('DOCUMENTO_QUE_NAO_EXISTE');
    await expect(page.getByText('Nenhum documento corresponde à busca.')).toBeVisible();
    await page.getByPlaceholder('Buscar documento').fill('');
    await page.screenshot({ path: 'test-results/data-ingestion-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('data-imports-page')).toBeVisible();
    const mobileOverflow = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      rootOverflowX: getComputedStyle(document.documentElement).overflowX,
    }));
    expect(mobileOverflow.bodyWidth).toBeLessThanOrEqual(mobileOverflow.viewportWidth);
    expect(mobileOverflow.rootOverflowX).toBe('hidden');
    await page.getByTestId('data-imports-page').screenshot({ path: 'test-results/data-ingestion-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByTestId('document-file-input').setInputFiles({
      name: `${marker}.exe`,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ invalid executable'),
    });
    await expect(page.getByText('Formato não permitido.')).toBeVisible();

    const cancelledMarker = `TEST_E2E_UI_CANCELLED_${Date.now()}`;
    createdTitles.add(cancelledMarker);
    await page.route('**/documents/upload', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.continue().catch(() => undefined);
    });
    await page.getByTestId('document-file-input').setInputFiles({
      name: `${cancelledMarker}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.alloc(2 * 1024 * 1024, 'a'),
    });
    await page.getByRole('button', { name: `Cancelar upload de ${cancelledMarker}.txt` }).click();
    const cancelledItem = page.locator('li').filter({ hasText: `${cancelledMarker}.txt` });
    await expect(cancelledItem).toContainText('Cancelado');
    await page.unroute('**/documents/upload');
    expect(pageErrors).toEqual([]);
  });
});
