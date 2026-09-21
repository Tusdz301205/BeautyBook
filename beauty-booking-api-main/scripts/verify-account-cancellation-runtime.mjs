import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Explicitly target the rehearsed copy. Never infer/write to the .env database.
const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_[a-z0-9_]+$/i, 'Set BEAUTYBOOK_TEST_DATABASE to a disposable copy');
assert.notEqual(process.env.NODE_ENV, 'production');
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime.js');
const api = process.env.BEAUTYBOOK_TEST_API_BASE ?? 'http://localhost:3101/api/v1';
assert.ok(['http://localhost:3101/api/v1', 'http://localhost:3102/api/v1'].includes(api));
const results = [];
const fixtureIds = [];
const tokens = {};
async function call(path, token, method = 'GET', body) {
  const response = await fetch(`${api}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8181', ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function login(email) {
  const result = await call('/auth/login', null, 'POST', { email, password: 'Password123!' });
  assert.equal(result.status, 200, `Demo login failed (${email}); no credentials changed`);
  const data = result.data.data ?? result.data;
  assert.ok(data.accessToken);
  return data.accessToken;
}
function expectStatus(result, status, label) { assert.equal(result.status, status, label); results.push(label); }

try {
  const owner = await db.user.findUniqueOrThrow({ where: { email: 'lananh.owner@glowbook.vn' } });
  const grant = await db.userRole.findFirstOrThrow({ where: { userId: owner.id, role: { code: 'BUSINESS_OWNER' } } });
  const branch = await db.branch.findFirstOrThrow({ where: { businessId: grant.businessId, status: 'ACTIVE', deletedAt: null } });
  const foreign = await db.branch.findFirstOrThrow({ where: { businessId: { not: branch.businessId }, status: 'ACTIVE', deletedAt: null } });
  const ownerToken = await login(owner.email);
  expectStatus(await call(`/branches/${branch.id}`), 200, 'Guest public GET');
  expectStatus(await call(`/branches/${branch.id}`, ownerToken), 200, 'Owner public GET');
  expectStatus(await call(`/branches/${branch.id}/preview`, ownerToken), 200, 'Owner own preview');
  expectStatus(await call(`/branches/${foreign.id}/preview`, ownerToken), 403, 'Owner foreign preview denied');
  // Reversible fixture-only draft on the copy, always restored even on failure.
  try {
    await db.branch.update({ where: { id: branch.id }, data: { status: 'INACTIVE' } });
    const hidden = await call(`/branches/${branch.id}`);
    assert.ok(hidden.status === 404 || (hidden.status === 200 && hidden.data === null));
    results.push('Unpublished branch hidden from public');
    expectStatus(await call(`/branches/${branch.id}/preview`, ownerToken), 200, 'Owner can preview unpublished branch');
  } finally { await db.branch.update({ where: { id: branch.id }, data: { status: branch.status, updatedAt: branch.updatedAt } }); }
  for (const [role, email] of [['Owner', owner.email], ['Receptionist', 'reception@glowbook.vn'], ['Staff', 'staff@glowbook.vn'], ['Platform', 'admin@glowbook.vn']]) {
    const token = role === 'Owner' ? ownerToken : await login(email);
    tokens[role] = token;
    expectStatus(await call(`/branches/${branch.id}`, token), 200, `${role} public GET`);
    for (const path of ['/saved-services', '/loyalty/mine', '/bookings/my-appointments']) {
      expectStatus(await call(path, token), 403, `${role} denied ${path}`);
    }
    expectStatus(await call('/reviews', token, 'POST', {}), 403, `${role} review denied`);
  }
  const customerEmail = 'khach0001@glowbook.vn';
  const customer = await db.customerProfile.findFirstOrThrow({ where: { user: { email: customerEmail } } });
  // Retire only this script's earlier fixtures in this explicitly named copy.
  await db.booking.updateMany({ where: { customerId: customer.id, bookingCode: { startsWith: 'TEST-CANCEL-' }, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'CANCELLED', cancelReason: 'Retired runtime test fixture' } });
  const customerToken = await login(customerEmail);
  expectStatus(await call('/bookings/my-appointments', customerToken), 200, 'Customer own history remains available');
  expectStatus(await call(`/branches/${branch.id}/preview`, customerToken), 403, 'Customer preview denied');
  async function booking(hours) {
    let start = new Date(Date.now() + hours * 3_600_000);
    let interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    if (interval.appointmentEndTime <= interval.appointmentStartTime) {
      start = new Date(start.getTime() + (hours < 0 ? -1_800_000 : 1_800_000));
      interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    }
    const id = randomUUID(); fixtureIds.push(id);
    await db.booking.create({ data: {
      id, customerId: customer.id, branchId: branch.id,
      bookingCode: `TEST-CANCEL-${id}`, status: 'CONFIRMED', source: 'ONLINE_WEB',
      totalAmount: 0, finalAmount: 0,
      ...interval,
    } });
    // The unique fixture confirms the API is connected to this copy, not live.
    expectStatus(await call(`/bookings/${id}`, customerToken), 200, `Fixture visible on test API (${hours}h)`);
    return id;
  }
  const early = await booking(5);
  const late = await booking(1);
  expectStatus(await call(`/bookings/${early}/status`, customerToken, 'PATCH', { status: 'CANCELLED', note: 'Runtime verification' }), 200, 'Customer direct cancellation >4h');
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: early } })).status, 'CANCELLED');
  expectStatus(await call(`/bookings/${late}/status`, customerToken, 'PATCH', { status: 'CANCELLED', note: 'Runtime verification' }), 400, 'Customer direct cancellation <4h denied');
  const requests = await Promise.all([1, 2].map(() => call(`/bookings/${late}/change-requests`, customerToken, 'POST', { requestType: 'CANCEL', reason: 'Runtime verification' })));
  assert.deepEqual(requests.map(r => r.status).sort(), [201, 409], JSON.stringify(requests)); results.push('Concurrent late requests: one creation, one conflict');
  assert.equal(await db.appointmentChangeRequest.count({ where: { bookingId: late } }), 1);
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: late } })).status, 'CONFIRMED');
  assert.ok(await db.notification.count({ where: { relatedBookingId: late, userId: owner.id } }));
  results.push('Request pending; booking unchanged; Owner notified');
  const absent = await booking(-2);
  const markAbsent = (token, confirmed) => call(`/bookings/${absent}/status`, token, 'PATCH', { status: 'NO_SHOW', noShowConfirmed: confirmed });
  expectStatus(await markAbsent(ownerToken), 400, 'Owner must explicitly confirm no report/no arrival');
  for (const token of [tokens.Staff, tokens.Platform, customerToken]) {
    const denied = await markAbsent(token, true);
    assert.ok([400, 403].includes(denied.status), `Unauthorized no-show: ${denied.status}`);
  }
  results.push('Staff/Platform/Customer no-show denied');
  const noShowRace = await Promise.all([markAbsent(ownerToken, true), markAbsent(ownerToken, true)]);
  assert.equal(noShowRace.filter(r => r.status === 200).length, 1);
  assert.ok(noShowRace.filter(r => r.status !== 200).every(r => [400, 409].includes(r.status)), JSON.stringify(noShowRace.filter(r => r.status !== 200)));
  assert.equal(await db.auditLog.count({ where: { entityId: absent, newData: { path: ['noShowConfirmed'], equals: true } } }), 1);
  assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: absent, status: 'NO_SHOW' } }), 1);
  results.push('Concurrent no-show commits one status history and one confirmation evidence');
  // Move only this run's isolated fixture into the past to test an unresolved report.
  const reportedStart = new Date(Date.now() - 4 * 3_600_000);
  await db.booking.update({ where: { id: late }, data: normalizeAppointmentForStorage(reportedStart, new Date(reportedStart.getTime() + 1_800_000)) });
  expectStatus(await call(`/bookings/${late}/status`, ownerToken, 'PATCH', { status: 'NO_SHOW', noShowConfirmed: true }), 409, 'Cancellation report prevents no-show after appointment start');
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: late } })).status, 'CONFIRMED');
  const browserNoShowBookingId = await booking(-6);
  // Keep only these isolated test fixtures for browser verification in the copy.
  console.log(JSON.stringify({ results, browserFixtureBookingId: late, browserNoShowBookingId, testDatabase: name }, null, 2));
} finally { await db.$disconnect(); await pool.end(); }
