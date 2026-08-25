import { expect, test } from '@playwright/test';

const healthPaths = ['/health', '/livez', '/readyz'] as const;

test.describe('production read-only smoke', () => {
  test('public health endpoints and application shell respond without test hooks', async ({ request }) => {
    for (const path of healthPaths) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be healthy`).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
    }

    const shell = await request.get('/');
    expect(shell.status()).toBe(200);
    expect(shell.headers()['content-type']).toContain('text/html');
    expect(await shell.text()).toContain('<div id="root"></div>');
  });

  test('protected APIs reject unauthenticated reads', async ({ request }) => {
    const response = await request.get('/api/v1/condominiums');
    expect(response.status()).toBe(401);
  });
});
