import { request as apiRequest } from '@playwright/test';
import { test, expect } from '../fixtures/test.js';
import { apiBaseURL, concurrencyGate } from '../helpers/environment.js';

function parseEnvironment(name, fallback = null) {
  const raw = process.env[name];
  return raw ? JSON.parse(raw) : fallback;
}

function bookingPayloadAt(index) {
  const prepared = parseEnvironment('PW_BOOKING_PAYLOADS_JSON', []);
  if (Array.isArray(prepared) && prepared[index]) return prepared[index];
  return parseEnvironment('PW_BOOKING_PAYLOAD_JSON');
}

function apiUrl(path) {
  return `${apiBaseURL.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

async function authenticatedActor(account) {
  const context = await apiRequest.newContext();
  if (account.accessToken) return { context, token: account.accessToken };
  const login = await context.post(apiUrl('/auth/login'), {
    data: {
      email: account.email,
      password: account.password,
      ...(account.workspace ? { workspace: account.workspace } : {}),
      ...(account.businessId ? { businessId: account.businessId } : {}),
      ...(account.branchId ? { branchId: account.branchId } : {}),
    },
  });
  if (!login.ok()) {
    const detail = await login.text();
    expect(login.ok(), `Could not login race actor ${account.email}: HTTP ${login.status()} ${detail}`).toBeTruthy();
  }
  const result = await login.json();
  return { context, token: result.accessToken };
}

async function closeActors(actors) {
  await Promise.all(actors.map((actor) => actor.context.dispose()));
}

async function createRace(accounts, payload, size) {
  // Authentication is fixture setup, not the operation under race. Keeping it
  // sequential prevents password hashing/session creation from contaminating
  // the booking-concurrency signal on small local CI machines.
  const actors = [];
  for (const account of accounts.slice(0, size)) actors.push(await authenticatedActor(account));
  try {
    const responses = await Promise.all(actors.map((actor, index) => actor.context.post(apiUrl('/bookings'), {
      headers: {
        Authorization: `Bearer ${actor.token}`,
        'Idempotency-Key': crypto.randomUUID(),
        'X-Forwarded-For': `127.0.1.${index + 1}`,
      },
      data: payload,
    })));
    const statuses = responses.map((response) => response.status());
    expect(statuses.filter((status) => status >= 200 && status < 300), `HTTP statuses: ${statuses.join(',')}`).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(size - 1);
    expect(statuses.every((status) => status < 500)).toBeTruthy();
    const winner = responses.find((response) => response.ok());
    const booking = await winner.json();
    expect(booking.id).toBeTruthy();
  } finally {
    await closeActors(actors);
  }
}

for (const [raceIndex, size] of [5, 10].entries()) {
  test(`@concurrency exactly one of ${size} customers wins the same staff slot`, async () => {
    test.skip(!concurrencyGate(), 'Concurrency requires explicit flags and PW_TEST_DATABASE_URL');
    const accounts = parseEnvironment('PW_CONCURRENCY_CUSTOMERS_JSON', []);
    const payload = bookingPayloadAt(raceIndex);
    test.skip(accounts.length < size || !payload, `Provide ${size} isolated customer actors and one free-slot payload`);
    test.slow();
    await createRace(accounts, payload, size);
  });
}

test('@concurrency retrying the same idempotency key returns one booking', async () => {
  test.skip(!concurrencyGate(), 'Concurrency requires an isolated test database');
  const accounts = parseEnvironment('PW_CONCURRENCY_CUSTOMERS_JSON', []);
  const payload = bookingPayloadAt(2);
  test.skip(!accounts.length || !payload, 'Provide a customer actor and free-slot payload');
  const actor = await authenticatedActor(accounts[0]);
  try {
    const key = crypto.randomUUID();
    const headers = { Authorization: `Bearer ${actor.token}`, 'Idempotency-Key': key };
    const first = await actor.context.post(apiUrl('/bookings'), { headers, data: payload });
    const retry = await actor.context.post(apiUrl('/bookings'), { headers, data: payload });
    expect(first.ok()).toBeTruthy();
    expect(retry.ok()).toBeTruthy();
    const [firstBooking, retriedBooking] = await Promise.all([first.json(), retry.json()]);
    expect(retriedBooking.id).toBe(firstBooking.id);
  } finally {
    await actor.context.dispose();
  }
});

test('@concurrency one idempotency key rejects a changed payload', async () => {
  test.skip(!concurrencyGate(), 'Concurrency requires an isolated test database');
  const accounts = parseEnvironment('PW_CONCURRENCY_CUSTOMERS_JSON', []);
  const payload = bookingPayloadAt(3);
  test.skip(!accounts.length || !payload, 'Provide a customer actor and free-slot payload');
  const actor = await authenticatedActor(accounts[0]);
  try {
    const key = crypto.randomUUID();
    const headers = { Authorization: `Bearer ${actor.token}`, 'Idempotency-Key': key };
    const first = await actor.context.post(apiUrl('/bookings'), { headers, data: payload });
    const changed = await actor.context.post(apiUrl('/bookings'), {
      headers,
      data: { ...payload, note: `PW-E2E-changed-${Date.now()}` },
    });
    expect(first.ok()).toBeTruthy();
    expect(changed.status()).toBe(409);
  } finally {
    await actor.context.dispose();
  }
});

async function runPreparedRace(environmentName) {
  const scenario = parseEnvironment(environmentName);
  test.skip(!scenario, `Provide ${environmentName}`);
  const actors = [];
  for (const account of scenario.actors) actors.push(await authenticatedActor(account));
  try {
    const responses = await Promise.all(scenario.requests.map((operation, index) => {
      const actor = actors[operation.actor];
      return actor.context.fetch(apiUrl(operation.path), {
        method: operation.method,
        headers: {
          Authorization: `Bearer ${actor.token}`,
          'Idempotency-Key': operation.idempotencyKey || crypto.randomUUID(),
          'X-Forwarded-For': `127.0.2.${index + 1}`,
          ...(operation.headers || {}),
        },
        data: operation.data,
      });
    }));
    const statuses = responses.map((response) => response.status());
    const responseDetails = await Promise.all(responses.map(async (response) => response.ok() ? '' : await response.text()));
    expect(statuses.every((status) => status < 500), `HTTP statuses: ${statuses.join(',')} ${responseDetails.join(' | ')}`).toBeTruthy();
    if (scenario.allowedOutcomes) {
      const outcome = {
        successes: statuses.filter((status) => status >= 200 && status < 300).length,
        conflicts: statuses.filter((status) => status === 409).length,
      };
      expect(scenario.allowedOutcomes).toContainEqual(outcome);
      if (scenario.expectedStatuses) expect(statuses).toEqual(scenario.expectedStatuses);
      return;
    }
    expect(statuses.filter((status) => status >= 200 && status < 300), `HTTP statuses: ${statuses.join(',')} ${responseDetails.join(' | ')}`).toHaveLength(scenario.expectedSuccesses ?? 1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(scenario.expectedConflicts ?? statuses.length - 1);
    if (scenario.expectedStatuses) expect(statuses).toEqual(scenario.expectedStatuses);
  } finally {
    await closeActors(actors);
  }
}

const preparedRaces = [
  ['customer and receptionist cannot bypass the same slot conflict', 'PW_RACE_CUSTOMER_RECEPTIONIST_JSON'],
  ['multi-service booking with one staff commits all items atomically', 'PW_RACE_MULTI_SERVICE_ONE_STAFF_JSON'],
  ['multi-service booking with many staff rolls back when one conflicts', 'PW_RACE_MULTI_SERVICE_MANY_STAFF_JSON'],
  ['reschedule and create race leaves the losing booking unchanged', 'PW_RACE_RESCHEDULE_CREATE_JSON'],
  ['cancel and create race leaves a consistent slot owner', 'PW_RACE_CANCEL_CREATE_JSON'],
  ['voucher quota one is consumed by one booking only', 'PW_RACE_VOUCHER_QUOTA_JSON'],
  ['waitlist offer can be accepted once only', 'PW_RACE_WAITLIST_ACCEPT_JSON'],
];

for (const [title, environmentName] of preparedRaces) {
  test(`@concurrency ${title}`, async () => {
    test.skip(!concurrencyGate(), 'Concurrency requires explicit flags and PW_TEST_DATABASE_URL');
    test.slow();
    await runPreparedRace(environmentName);
  });
}
