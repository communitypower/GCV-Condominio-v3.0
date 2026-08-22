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
    await expect(page.getByTestId('active-building-selector')).toBeVisible();
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    for (const menu of [
      'edificios', 'equipamentos', 'planos', 'ordens', 'logs', 'bim', 'ciclovida',
      'compras', 'cobrancas', 'pagamentos', 'demonstrativos', 'condominos',
      'documentacao', 'notificacoes', 'usuarios', 'carga-dados',
    ]) {
      await expect(page.getByTestId(`nav-${menu}`)).toBeVisible();
    }
    await expect(page.getByTestId('nav-github')).toHaveCount(0);
    await expect(page.getByTestId('profile-description')).toHaveText(/Superusuário da Plataforma/i);
    await expect(page.getByText(/Recarregar Dados/i)).toBeVisible();
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

  test('resident invitation explains the unit prerequisite and links to unit registration', async ({ page }) => {
    await page.route('**/api/v1/condominiums/*/units', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }));
    await page.goto('/');
    await page.getByTestId('login-email').fill('vitorlcastro92@gmail.com');
    await page.getByTestId('login-password').fill('platform-admin-local-123');
    await page.getByTestId('login-submit').click();
    await page.getByTestId('nav-condominos').click();

    await expect(page.getByTestId('resident-unit-prerequisite')).toContainText('Cadastre uma unidade antes de convidar moradores');
    await expect(page.getByTestId('invite-resident')).toHaveCount(0);
    await page.getByTestId('create-first-unit').click();
    await expect(page.getByRole('heading', { name: 'Cadastro de Unidades Habitacionais' })).toBeVisible();
  });

  test('invitation detects an authenticated account mismatch and supports account switching', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-email').fill('vitorlcastro92@gmail.com');
    await page.getByTestId('login-password').fill('platform-admin-local-123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('nav-onboarding')).toBeVisible();

    await page.route('**/api/v1/onboarding/invitations/account-mismatch-token', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: 'resident.invited@example.com',
        name: 'Morador Convidado',
        phone: '11999999999',
        role: 'resident',
        relationshipRole: 'owner',
        expiresAt: '2099-12-31T23:59:59.000Z',
        condominium: { name: 'Condomínio QA' },
        unit: { number: '101', building: { name: 'Bloco A' } },
        requiresExistingAccountLogin: false,
      }),
    }));
    await page.goto('/invite/account-mismatch-token');

    await expect(page.getByRole('heading', { name: 'Troque de conta para continuar' })).toBeVisible();
    await expect(page.getByText('vitorlcastro92@gmail.com', { exact: true })).toBeVisible();
    await expect(page.getByText('resident.invited@example.com', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair e continuar com o convite' }).click();

    await expect(page.getByText('Crie uma senha', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Troque de conta para continuar' })).toHaveCount(0);
  });
});
