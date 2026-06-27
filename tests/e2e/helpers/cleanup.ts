import type { APIRequestContext } from '@playwright/test';

export const TEST_PREFIX = 'TEST_E2E_';

export async function cleanupE2EData(request: APIRequestContext, baseURL: string) {
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) {
    console.warn('E2E_TEST_SECRET is not set; skipping server-side cleanup.');
    return;
  }

  const response = await request.post(`${baseURL}/api/v1/testing/cleanup`, {
    headers: {
      origin: baseURL,
      'x-e2e-secret': secret,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`E2E cleanup failed with ${response.status()}: ${body}`);
  }
}

export function uniqueName(label: string) {
  return `${TEST_PREFIX}${label}_${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
}
