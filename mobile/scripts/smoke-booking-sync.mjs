import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.RUN_MUTATING_SMOKE !== '1') {
  throw new Error('Set RUN_MUTATING_SMOKE=1 to create disposable customer accounts and a booking.');
}

const baseUrl = (process.env.BEAUTYBOOK_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const password = `Qa-${randomUUID()}!`; 
const marker = randomUUID().slice(0, 12);

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

function expectOk(result, label) {
  assert.ok(result.status >= 200 && result.status < 300, `${label}: HTTP ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}

const register = (suffix) => request('/auth/register', {
  method: 'POST',
  body: {
    fullName: `BeautyBook QA ${suffix}`,
    email: `beautybook-qa-${marker}-${suffix}@example.test`,
    password,
    accountType: 'CUSTOMER',
    refreshTokenTransport: 'BODY',
  },
});

const customerA = expectOk(await register('a'), 'register A');
const customerB = expectOk(await register('b'), 'register B');
const secondSessionA = expectOk(await request('/auth/login', {
  method: 'POST',
  body: {
    email: `beautybook-qa-${marker}-a@example.test`,
    password,
    workspace: 'CUSTOMER',
    refreshTokenTransport: 'BODY',
  },
}), 'second session A');

assert.ok(customerA.accessToken && customerB.accessToken && secondSessionA.accessToken);
const search = expectOk(await request('/services/search?sort=rating&limit=50'), 'service search');
const offering = search.data.find((row) => row.displayName === 'Phun xăm lông mày' && row.branchName?.includes('Thanh Hương'));
assert.ok(offering, 'expected public offering is missing');
const bookingDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const slots = expectOk(await request(`/bookings/available-slots?${new URLSearchParams({
  branchId: offering.branchId,
  serviceIds: offering.id,
  date: bookingDate,
})}`), 'available slots');
assert.ok(slots.slots.length > 0, 'no bookable slot for QA date');
const appointmentDate = slots.slots[Math.min(2, slots.slots.length - 1)].start;
const bookingInput = {
  branchId: offering.branchId,
  serviceIds: [offering.id],
  appointmentDate,
  source: 'ONLINE_APP',
  note: `QA account sync ${marker}`,
};

expectOk(await request('/bookings/self-booking-policy?' + new URLSearchParams({ branchId: offering.branchId }), {
  token: customerA.accessToken,
}), 'self booking policy');
const preview = expectOk(await request('/bookings/preview-price', {
  token: customerA.accessToken,
  method: 'POST',
  body: bookingInput,
}), 'price preview');

const idempotencyKey = randomUUID();
const created = expectOk(await request('/bookings', {
  token: customerA.accessToken,
  method: 'POST',
  body: bookingInput,
  headers: { 'Idempotency-Key': idempotencyKey },
}), 'create booking');
assert.ok(created.id);
assert.equal(created.branchId, offering.branchId);
assert.equal(Number(created.finalAmount), Number(preview.finalAmount));

const list = (token, tab) => request(`/bookings/my-appointments?tab=${tab}`, { token });
const sessionA1 = expectOk(await list(customerA.accessToken, 'upcoming'), 'session A1 upcoming');
const sessionA2 = expectOk(await list(secondSessionA.accessToken, 'upcoming'), 'session A2 upcoming');
const sessionB = expectOk(await list(customerB.accessToken, 'upcoming'), 'customer B upcoming');
assert.ok(sessionA1.data.some((row) => row.id === created.id));
assert.ok(sessionA2.data.some((row) => row.id === created.id));
assert.ok(!sessionB.data.some((row) => row.id === created.id));

const forbidden = await request(`/bookings/${created.id}`, { token: customerB.accessToken });
assert.ok([403, 404].includes(forbidden.status), `another account read booking: HTTP ${forbidden.status}`);

expectOk(await request(`/bookings/${created.id}/status`, {
  token: customerA.accessToken,
  method: 'PATCH',
  body: { status: 'CANCELLED', note: `Kết thúc kiểm thử ${marker}` },
}), 'cancel QA booking');
const cancelledA2 = expectOk(await list(secondSessionA.accessToken, 'cancelled'), 'session A2 cancelled');
assert.ok(cancelledA2.data.some((row) => row.id === created.id && row.status === 'CANCELLED'));
const afterB = expectOk(await list(customerB.accessToken, 'cancelled'), 'customer B cancelled');
assert.ok(!afterB.data.some((row) => row.id === created.id));

console.log(JSON.stringify({
  ok: true,
  marker,
  bookingId: created.id,
  offeringId: offering.id,
  slot: appointmentDate,
  price: Number(created.finalAmount),
  checks: ['public catalog', 'available slot', 'policy', 'price preview', 'create', 'same account two sessions', 'other account isolation', 'cancellation synchronization'],
}, null, 2));
