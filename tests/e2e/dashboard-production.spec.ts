import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eSessionLogin, waitForDocumentDownload } from './helpers/api';
import { cleanupE2EData, TEST_PREFIX, uniqueName } from './helpers/cleanup';
import type { Equipment, MaintenanceRequest } from '../../src/types';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isProductionTarget = baseURL.includes('gcv-app-production-production.up.railway.app');
const visibleUuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

async function passwordLogin(page: Page, email = 'sindico@gcv.com.br', password = 'sindico123') {
  await page.goto('/');
  if (process.env.E2E_TEST_SECRET) {
    await e2eSessionLogin(page.request, baseURL, email);
    await page.goto('/');
    await expect(page.getByText(/ENCERRAR SESSÃO/i)).toBeVisible();
    return;
  }

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/ENCERRAR SESSÃO/i)).toBeVisible();
}

async function apiLogin(request: APIRequestContext) {
  if (process.env.E2E_TEST_SECRET) {
    await e2eSessionLogin(request, baseURL);
    return;
  }

  const response = await request.post(`${baseURL}/api/v1/auth/login`, {
    headers: {
      origin: baseURL,
      'content-type': 'application/json',
    },
    data: {
      email: 'sindico@gcv.com.br',
      password: 'sindico123',
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function firstCondominium(request: APIRequestContext) {
  const response = await request.get(`${baseURL}/api/v1/condominiums`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const condos = await response.json();
  expect(condos.length).toBeGreaterThan(0);
  const rfcUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return (condos.find((condo: { id: string }) => rfcUuidPattern.test(condo.id)) || condos[0]) as { id: string; accountId: string; name: string };
}

test.beforeEach(async ({ request }) => {
  if (isProductionTarget) {
    expect(process.env.E2E_TEST_SECRET, 'E2E_TEST_SECRET is required for production E2E cleanup').toBeTruthy();
  }
  await cleanupE2EData(request, baseURL);
});

test.afterEach(async ({ request }) => {
  await cleanupE2EData(request, baseURL);
});

test('password session, dashboard shell, sidebar workflows, and logout work', async ({ page }) => {
  await passwordLogin(page);

  await expect(page.getByText(/GCV/i).first()).toBeVisible();
  await expect(page.getByText(/EDIFÍCIO ATIVO/i)).toBeVisible();
  await expect(page.getByTestId('dashboard-sidebar').getByText(/Cassiano Marins/i)).toBeVisible();

  const menuItems = [
    ['ia_assistant', /Assistente IA/i],
    ['dashboard', /Dashboard/i],
    ['edificios', /Cadastro de Unidades Habitacionais/i],
    ['equipamentos', /Inventário de Equipamentos/i],
    ['planos', /Planos de Manutenção Preventiva/i],
    ['ordens', /Posto de Manutenção Predial/i],
    ['logs', /Logs de Operação Predial/i],
    ['bim', /Visualizador BIM Integrado/i],
    ['ciclovida', /Gestão de Custo de Ciclo de Vida/i],
    ['compras', /Requisições de Compra & Almoxarifado/i],
    ['cobrancas', /Painel de Faturamento/i],
    ['pagamentos', /Controle de Ordens de Pagamento/i],
    ['demonstrativos', /Demonstrativos Financeiros/i],
    ['condominos', /Moradores e acessos/i],
    ['documentacao', /Biblioteca Digital de Documentação/i],
    ['notificacoes', /Comunicados & Notificações Gerais/i],
    ['usuarios', /Corpo Diretivo e Equipe/i],
  ];

  for (const [tab, expectedContent] of menuItems) {
    await page.getByTestId(`nav-${tab}`).click();
    await expect(page.getByTestId('dashboard-main')).toContainText(expectedContent);
    await expect(page.getByTestId('dashboard-main')).not.toContainText(visibleUuidPattern);
  }
  await expect(page.getByTestId('nav-github')).toHaveCount(0);

  await page.getByTestId('nav-edificios').click();
  const firstUnit = page.getByTestId('unit-card').first();
  if (await firstUnit.count()) {
    await expect(firstUnit).toContainText(/Unidade\s+\S+/i);
    await firstUnit.click();
    await expect(page.getByTestId('unit-details')).toBeVisible();
    await expect(page.getByTestId('unit-details')).not.toContainText(visibleUuidPattern);
    await expect(page.getByTestId('unit-details')).toContainText(/Unidade\s+\S+/i);
    await page.locator('#drawer-close').click();
    await expect(page.getByTestId('unit-details')).toBeHidden();
  }

  await page.getByRole('button', { name: /ENCERRAR SESSÃO/i }).click();
  await expect(page.getByRole('button', { name: /Entrar com E-mail/i })).toBeVisible();
});

test('resident session shows resident-oriented dashboard state', async ({ page }) => {
  await passwordLogin(page, 'carlos.ramos@email.com', 'resident123');
  await expect(page.getByText(/Portal do Condômino/i)).toBeVisible();
  await expect(page.getByText(/Minhas Cobranças/i)).toBeVisible();
  await expect(page.getByText(/Minhas Solicitações de Reparo/i)).toBeVisible();
});

test('dashboard recent orders and equipment alerts reflect the active condominium APIs', async ({ page }) => {
  await passwordLogin(page);
  const activeBuildingSelector = page.getByTestId('active-building-selector');
  await expect(activeBuildingSelector).toHaveValue(/^(?!__new__$).+/);
  const condominiumId = await activeBuildingSelector.inputValue();
  const { tickets, equipment } = await page.evaluate(async activeId => {
    const [ticketsResponse, equipmentResponse] = await Promise.all([
      fetch(`/api/v1/condominiums/${activeId}/tickets`),
      fetch(`/api/v1/condominiums/${activeId}/equipment`),
    ]);
    if (!ticketsResponse.ok || !equipmentResponse.ok) {
      throw new Error(`Dashboard API validation failed: tickets=${ticketsResponse.status}, equipment=${equipmentResponse.status}`);
    }
    return {
      tickets: await ticketsResponse.json(),
      equipment: await equipmentResponse.json(),
    };
  }, condominiumId) as { tickets: MaintenanceRequest[]; equipment: Equipment[] };
  const expectedRecent = [...tickets]
    .sort((left, right) => new Date(right.reportedAt).getTime() - new Date(left.reportedAt).getTime())
    .slice(0, 3);
  const expectedAlerts = equipment
    .filter(item => item.status === 'alert' || item.status === 'critical')
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'critical' ? -1 : 1;
      return left.name.localeCompare(right.name, 'pt-BR');
    })
    .slice(0, 3);

  await expect(page.getByTestId('recent-service-order')).toHaveCount(expectedRecent.length);
  if (expectedRecent.length === 0) {
    await expect(page.getByTestId('recent-service-orders-empty')).toBeVisible();
  } else {
    for (const ticket of expectedRecent) {
      await expect(page.getByTestId('recent-service-orders')).toContainText(ticket.title);
    }
  }

  await expect(page.getByTestId('alert-equipment')).toHaveCount(expectedAlerts.length);
  if (expectedAlerts.length === 0) {
    await expect(page.getByTestId('alert-equipment-empty')).toBeVisible();
  } else {
    for (const item of expectedAlerts) {
      await expect(page.getByTestId('alert-equipment-list')).toContainText(item.name);
    }
  }

});

test('dashboard shows truthful empty states when no orders or equipment alerts exist', async ({ page }) => {
  await page.route(/\/api\/v1\/condominiums\/[^/]+\/tickets(?:\?.*)?$/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route(/\/api\/v1\/condominiums\/[^/]+\/equipment(?:\?.*)?$/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await passwordLogin(page);

  await expect(page.getByTestId('recent-service-orders-empty')).toBeVisible();
  await expect(page.getByTestId('alert-equipment-empty')).toBeVisible();
  await expect(page.getByTestId('recent-service-orders')).not.toContainText("Limpeza da caixa d'água");
  await expect(page.getByTestId('alert-equipment-list')).not.toContainText('Bomba Centrífuga Principal');
});

test('Google and Microsoft auth entrypoints are controlled', async ({ request }) => {
  const google = await request.get(`${baseURL}/api/v1/auth/google/login`, { maxRedirects: 0 });
  expect([302, 429, 500]).toContain(google.status());
  if (google.status() === 302) {
    expect(google.headers().location || '').toContain('accounts.google.com');
    expect(google.headers().location || '').toContain(encodeURIComponent(`${baseURL}/api/v1/auth/google/callback`));
  }

  const microsoft = await request.get(`${baseURL}/api/v1/auth/microsoft/login`, { maxRedirects: 0 });
  expect(microsoft.status()).toBe(501);
  expect((await microsoft.json()).code).toBe('MICROSOFT_OAUTH_UNAVAILABLE');
});

test('API-backed dashboard workflows create, update, block, and clean production test data', async ({ request }) => {
  await apiLogin(request);
  const condo = await firstCondominium(request);

  const buildingName = uniqueName('BUILDING');
  const buildingRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/buildings`, {
    headers: { origin: baseURL },
    data: { name: buildingName },
  });
  expect(buildingRes.status(), await buildingRes.text()).toBe(201);
  const building = await buildingRes.json();

  const unitNumber = uniqueName('UNIT');
  const unitRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/units`, {
    headers: { origin: baseURL },
    data: {
      number: unitNumber,
      type: 'apartment',
      status: 'occupied',
      fractionalShare: 0.001,
      buildingId: building.id,
    },
  });
  expect(unitRes.status(), await unitRes.text()).toBe(201);
  const unit = await unitRes.json();

  const residentRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/residents`, {
    headers: { origin: baseURL },
    data: {
      name: `${TEST_PREFIX}Resident`,
      email: `test_e2e_${Date.now()}@example.com`,
      phone: '11999999999',
      unitId: unit.id,
      role: 'owner',
    },
  });
  expect(residentRes.status(), await residentRes.text()).toBe(202);

  const equipmentName = uniqueName('EQUIPMENT');
  const equipmentRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/equipment`, {
    headers: { origin: baseURL },
    data: {
      name: equipmentName,
      location: `${TEST_PREFIX}Casa de Bombas`,
      category: `${TEST_PREFIX}Hidraulica`,
      status: 'operational',
    },
  });
  expect(equipmentRes.status(), await equipmentRes.text()).toBe(201);
  const equipment = await equipmentRes.json();

  const equipmentPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/equipment/${equipment.id}`, {
    headers: { origin: baseURL },
    data: { status: 'alert' },
  });
  expect(equipmentPatch.status(), await equipmentPatch.text()).toBe(200);

  const planRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/plans`, {
    headers: { origin: baseURL },
    data: {
      equipmentId: equipment.id,
      title: uniqueName('PLAN'),
      description: `${TEST_PREFIX}Plano preventivo automatizado`,
      frequency: 'monthly',
      nextOccurrence: '2099-12-10',
      status: 'active',
    },
  });
  expect(planRes.status(), await planRes.text()).toBe(201);
  const plan = await planRes.json();

  const planPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/plans/${plan.id}`, {
    headers: { origin: baseURL },
    data: { status: 'suspended' },
  });
  expect(planPatch.status(), await planPatch.text()).toBe(200);

  const ticketRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/tickets`, {
    headers: { origin: baseURL },
    data: {
      title: uniqueName('TICKET'),
      description: `${TEST_PREFIX}Chamado criado por Playwright`,
      category: 'electrical',
      priority: 'high',
      unitId: unit.id,
      estimatedCost: 123.45,
    },
  });
  expect(ticketRes.status(), await ticketRes.text()).toBe(201);
  const ticket = await ticketRes.json();

  const commentRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/tickets/${ticket.id}/comments`, {
    headers: { origin: baseURL },
    data: { comment: `${TEST_PREFIX}Comentário técnico` },
  });
  expect(commentRes.status(), await commentRes.text()).toBe(201);

  const ticketPatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/tickets/${ticket.id}`, {
    headers: { origin: baseURL },
    data: { status: 'in_progress', assignedStaff: `${TEST_PREFIX}Equipe elétrica` },
  });
  expect(ticketPatch.status(), await ticketPatch.text()).toBe(200);

  const chargeRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/charges`, {
    headers: { origin: baseURL },
    data: {
      unitId: unit.id,
      monthString: '2099-11',
      amount: 321.45,
      dueDate: '2099-11-10',
      description: `${TEST_PREFIX}Cobrança individual`,
    },
  });
  expect(chargeRes.status(), await chargeRes.text()).toBe(201);
  const charge = await chargeRes.json();

  const chargePatch = await request.patch(`${baseURL}/api/v1/condominiums/${condo.id}/charges/${charge.id}/status`, {
    headers: { origin: baseURL },
    data: { status: 'paid' },
  });
  expect(chargePatch.status(), await chargePatch.text()).toBe(200);

  const massGenerate = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/charges/mass-generate`, {
    headers: { origin: baseURL },
    data: { monthString: '2099-12' },
  });
  expect([200, 201], await massGenerate.text()).toContain(massGenerate.status());

  const auditRes = await request.post(`${baseURL}/api/v1/accounts/${condo.accountId}/audit`, {
    headers: { origin: baseURL },
    data: {
      title: uniqueName('AUDIT'),
      content: `${TEST_PREFIX}Registro operacional`,
      type: 'admin',
      condominiumId: condo.id,
    },
  });
  expect(auditRes.status(), await auditRes.text()).toBe(201);

  const documentRes = await request.post(`${baseURL}/api/v1/condominiums/${condo.id}/documents/upload`, {
    headers: { origin: baseURL },
    multipart: {
      files: { name: `${uniqueName('DOCUMENT')}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`${TEST_PREFIX}document`) },
      category: 'billing',
      requiredRole: 'resident',
      unitId: unit.id,
    },
  });
  expect(documentRes.status(), await documentRes.text()).toBe(201);
  const document = (await documentRes.json()).uploads[0];

  const downloadLink = await waitForDocumentDownload(request, baseURL, condo.id, document.id);
  expect(downloadLink.status(), await downloadLink.text()).toBe(200);
  const downloadRes = await request.get(`${baseURL}${(await downloadLink.json()).url}`);
  expect(downloadRes.status(), await downloadRes.text()).toBe(200);

  const aiResponse = await request.post(`${baseURL}/api/gemini/chat`, {
    headers: { origin: baseURL },
    data: { prompt: 'Responda apenas: OK', contextData: { edificioNome: 'Condomínio Beta' } },
  });
  const publicConfig = await request.get(`${baseURL}/api/v1/config`);
  expect(publicConfig.ok()).toBeTruthy();
  const aiEnabled = Boolean((await publicConfig.json()).features?.aiAssistant);
  expect(aiResponse.status(), await aiResponse.text()).toBe(aiEnabled ? 410 : 403);

  const githubBlocked = await request.get(`${baseURL}/api/auth/github/url`);
  expect(githubBlocked.status()).toBe(403);

  const demoBlocked = await request.get(`${baseURL}/api/demo/github-profile`);
  expect(demoBlocked.status()).toBe(403);
});
