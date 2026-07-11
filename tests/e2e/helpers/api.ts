import { expect, type APIRequestContext } from '@playwright/test';

export type CondominiumContext = {
  id: string;
  accountId: string;
  name: string;
};

const rfcUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function apiLogin(
  request: APIRequestContext,
  baseURL: string,
  email = 'sindico@gcv.com.br',
  password = 'sindico123'
) {
  const response = await request.post(`${baseURL}/api/v1/auth/login`, {
    headers: {
      origin: baseURL,
      'content-type': 'application/json',
    },
    data: { email, password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function e2eSessionLogin(request: APIRequestContext, baseURL: string, email = 'sindico@gcv.com.br') {
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) {
    return apiLogin(request, baseURL, email, email === 'carlos.ramos@email.com' ? 'resident123' : 'sindico123');
  }

  const response = await request.post(`${baseURL}/api/v1/testing/session`, {
    headers: {
      origin: baseURL,
      'x-e2e-secret': secret,
    },
    data: { email },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function firstCondominium(request: APIRequestContext, baseURL: string) {
  const response = await request.get(`${baseURL}/api/v1/condominiums`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const condominiums = (await response.json()) as CondominiumContext[];
  expect(condominiums.length).toBeGreaterThan(0);
  return condominiums.find((condominium) => rfcUuidPattern.test(condominium.id)) || condominiums[0];
}

export async function expectStatus(response: { status(): number; text(): Promise<string> }, status: number | number[]) {
  const statuses = Array.isArray(status) ? status : [status];
  expect(statuses, await response.text()).toContain(response.status());
}

export async function createTestBuilding(request: APIRequestContext, baseURL: string, condoId: string, name: string) {
  const response = await request.post(`${baseURL}/api/v1/condominiums/${condoId}/buildings`, {
    headers: { origin: baseURL },
    data: { name },
  });
  await expectStatus(response, 201);
  return response.json();
}

export async function createTestUnit(
  request: APIRequestContext,
  baseURL: string,
  condoId: string,
  buildingId: string,
  number: string
) {
  const response = await request.post(`${baseURL}/api/v1/condominiums/${condoId}/units`, {
    headers: { origin: baseURL },
    data: {
      number,
      type: 'apartment',
      status: 'occupied',
      fractionalShare: 0.001,
      buildingId,
    },
  });
  await expectStatus(response, 201);
  return response.json();
}
