import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';

export const TEST_PREFIX = 'TEST_E2E_';

export async function cleanupE2EData(_request: APIRequestContext, baseURL: string) {
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) {
    console.warn('E2E_TEST_SECRET is not set; skipping server-side cleanup.');
    return;
  }

  const cleanupContext = await playwrightRequest.newContext({ baseURL });
  const sessionResponse = await cleanupContext.post(`${baseURL}/api/v1/testing/session`, {
    headers: {
      origin: baseURL,
      'x-e2e-secret': secret,
    },
    data: { email: 'sindico@gcv.com.br' },
  });
  if (!sessionResponse.ok()) {
    const body = await sessionResponse.text();
    await cleanupContext.dispose();
    throw new Error(`E2E cleanup session failed with ${sessionResponse.status()}: ${body}`);
  }

  const condominiumsResponse = await cleanupContext.get(`${baseURL}/api/v1/condominiums`);
  if (!condominiumsResponse.ok()) {
    const body = await condominiumsResponse.text();
    await cleanupContext.dispose();
    throw new Error(`E2E condominium discovery failed with ${condominiumsResponse.status()}: ${body}`);
  }

  const condominiums = await condominiumsResponse.json() as Array<{ id: string }>;
  try {
    for (const condominium of condominiums) {
      const response = await cleanupContext.post(`${baseURL}/api/v1/testing/cleanup`, {
        headers: {
          origin: baseURL,
          'x-e2e-secret': secret,
        },
        data: { condominiumId: condominium.id },
      });
      if (!response.ok()) {
        throw new Error(`E2E cleanup failed with ${response.status()}: ${await response.text()}`);
      }
    }
  } finally {
    await cleanupContext.dispose();
  }
}

export function uniqueName(label: string) {
  return `${TEST_PREFIX}${label}_${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
}
