import { expect, test } from '@playwright/test';

const isLocal = (process.env.PLAYWRIGHT_BASE_URL || '').includes('localhost');

test.describe('onboarding and scoped access', () => {
  test.skip(!isLocal, 'Local seed identities are required for this suite.');

  test('system administrator reaches the onboarding console', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/');
    await page.getByTestId('login-email').fill('vitorlcastro92@gmail.com');
    await page.getByTestId('login-password').fill('platform-admin-local-123');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('nav-onboarding')).toBeVisible();
    await expect(page.getByTestId('active-building-selector')).toHaveCount(0);
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
    await page.getByTestId('nav-onboarding').click();
    await expect(page.getByRole('heading', { name: 'Onboarding de condomínio' })).toBeVisible();
    await expect(page.getByText('Administração do sistema', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar e convidar síndico' })).toBeVisible();

    await page.route('**/api/v1/onboarding/system/condominiums', route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        account: { id: 'account-test', name: 'Conta E2E' },
        condominium: { id: 'condominium-test', name: 'Condomínio E2E' },
        invitation: {
          id: 'invitation-test',
          status: 'pending',
          emailNormalized: 'sindico.e2e@example.com',
        },
        delivery: {
          method: 'manual_link',
          acceptanceUrl: 'http://localhost:3000/invite/test-token',
        },
      }),
    }));
    await page.getByLabel('Nome da conta').fill('Conta E2E');
    await page.getByLabel('Nome do condomínio').fill('Condomínio E2E');
    await page.getByLabel('Endereço').fill('Rua de Teste, 100');
    await page.getByLabel('Nome completo').fill('Síndico E2E');
    await page.getByLabel('E-mail').fill('sindico.e2e@example.com');
    await page.getByRole('button', { name: 'Criar e convidar síndico' }).click();

    await expect(page.getByText('Onboarding criado', { exact: true })).toBeVisible();
    await expect(page.getByText(/O convite de sindico\.e2e@example\.com está pending/)).toBeVisible();
    await expect(page.locator('input[readonly]')).toHaveValue('http://localhost:3000/invite/test-token');
    expect(pageErrors).toEqual([]);
  });

  test('resident receives only active units linked to their identity', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-email').fill('carlos.ramos@email.com');
    await page.getByTestId('login-password').fill('resident123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible();

    const units = await page.evaluate(async () => {
      const condominiums = await fetch('/api/v1/condominiums').then(response => response.json());
      return fetch(`/api/v1/condominiums/${condominiums[0].id}/units`).then(response => response.json());
    });
    expect(units).toHaveLength(1);
    expect(units[0].relationships).toHaveLength(1);
    expect(units[0].relationships[0].person.email).toBe('carlos.ramos@email.com');
  });
});
