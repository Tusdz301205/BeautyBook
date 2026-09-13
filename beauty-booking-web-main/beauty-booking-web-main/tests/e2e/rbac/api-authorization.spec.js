import { test, expect } from '../fixtures/test.js';
import { apiBaseURL, credentialsFor } from '../helpers/environment.js';

async function login(request, credential) {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      email: credential.email,
      password: credential.password,
      workspace: credential.workspace,
    },
  });
  expect(response.ok(), `API login failed with HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

test('@rbac protected API rejects an anonymous caller', async ({ request }) => {
  const response = await request.get(`${apiBaseURL}/users`);
  expect(response.status()).toBe(401);
});

for (const role of ['customer', 'staff']) {
  test(`@rbac ${role} cannot list platform users through the API`, async ({ request }) => {
    const credential = credentialsFor(role);
    test.skip(!credential, `Missing ${role} E2E credentials`);
    const session = await login(request, credential);
    const response = await request.get(`${apiBaseURL}/users`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(response.status()).toBe(403);
  });
}

test('@rbac platform admin can list users through the API', async ({ request }) => {
  const credential = credentialsFor('platformAdmin');
  test.skip(!credential, 'Missing platform admin E2E credentials');
  const session = await login(request, credential);
  const response = await request.get(`${apiBaseURL}/users?limit=5`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(expect.objectContaining({ data: expect.any(Array) }));
});
