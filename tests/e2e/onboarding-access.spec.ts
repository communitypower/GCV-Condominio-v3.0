import { expect, test } from '@playwright/test';

const isLocal = (process.env.PLAYWRIGHT_BASE_URL || '').includes('localhost');

test.describe('onboarding and scoped access', () => {
  test.skip(!isLocal, 'Local seed identities are required for this suite.');

  test('system administrator reaches the onboarding console', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-email').fill('sindico@gcv.com.br');
    await page.getByTestId('login-password').fill('sindico123');
    await page.getByTestId('login-submit').click();

    await page.getByTestId('nav-onboarding').click();
    await expect(page.getByRole('heading', { name: 'Onboarding de condomínio' })).toBeVisible();
    await expect(page.getByText('Administração do sistema', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar e convidar síndico' })).toBeVisible();
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
