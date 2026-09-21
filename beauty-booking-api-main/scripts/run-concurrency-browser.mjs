import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_restriction_\d{12,14}$/);
assert.equal(process.env.NODE_ENV, 'test');
assert.ok(process.env.PW_FIXTURE_PASSWORD);
assert.ok(process.env.JWT_SECRET);
const source = new URL(process.env.DATABASE_URL);
assert.equal(source.pathname, '/glowbook_db');
source.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: source.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime.js');
const api = 'http://localhost:3102/api/v1';
const web = resolve('../beauty-booking-web-main/beauty-booking-web-main');

function accessToken(user, role, workspace, businessId = null, branchId = null) {
  return jwt.sign({
    sub: user.id,
    email: user.email,
    roles: [role],
    scopes: [{ code: role, businessId, branchId, expiresAt: null }],
    sessionType: workspace === 'SALON' ? 'salon' : 'customer',
    workspace,
    businessId,
    branchId,
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function availableSlots(branchId, serviceIds, staffId, needed, startOffset = 3) {
  const slots = [];
  for (let offset = startOffset; offset <= 75 && slots.length < needed; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const query = new URLSearchParams({ branchId, serviceIds: serviceIds.join(','), date });
    if (staffId) query.set('staffId', staffId);
    const response = await fetch(`${api}/bookings/available-slots?${query}`, {
      headers: { 'X-Forwarded-For': `127.0.3.${(offset % 200) + 1}` },
    });
    assert.equal(response.status, 200, `available-slots failed for ${date}`);
    const body = await response.json();
    // Use at most one slot per day so fixtures cannot overlap when the UI
    // advertises adjacent start times for a long service.
    const slot = (body.slots ?? [])[0];
    if (slot && !slots.some((item) => item.start === slot.start)) slots.push(slot);
  }
  assert.ok(slots.length >= needed, `Need ${needed} isolated slots, found ${slots.length}`);
  return slots;
}

function bookingPayload(branchId, serviceIds, slot, staffId, extra = {}) {
  return {
    branchId,
    serviceIds,
    appointmentDate: slot.start,
    ...(staffId ? { staffId } : {}),
    ...extra,
  };
}

async function createExistingBooking(customerId, offering, staffId, slot, codePrefix) {
  const start = new Date(slot.start);
  const duration = Number(offering.durationMinutes);
  const end = new Date(start.getTime() + duration * 60_000);
  return db.booking.create({
    data: {
      bookingCode: `${codePrefix}-${randomUUID()}`,
      customerId,
      branchId: offering.branchId,
      status: 'CONFIRMED',
      source: 'STAFF_CREATED',
      totalAmount: offering.price,
      finalAmount: offering.price,
      ...normalizeAppointmentForStorage(start, end),
      bookingServices: {
        create: {
          serviceId: offering.id,
          businessServiceId: offering.businessServiceId,
          canonicalServiceId: offering.canonicalServiceId,
          staffId,
          priceAtBooking: offering.price,
          durationMinutes: duration,
          serviceNameSnapshot: offering.name,
          itemStartAt: start,
          itemEndAt: end,
        },
      },
    },
  });
}

try {
  const suffix = randomUUID();
  const customerRole = await db.role.findUniqueOrThrow({ where: { code: 'CUSTOMER' } });
  const passwordHash = await bcrypt.hash(process.env.PW_FIXTURE_PASSWORD, 12);
  const customers = [];
  for (let index = 0; index < 12; index += 1) {
    const user = await db.user.create({
      data: {
        email: `e2e-race-${index}-${suffix}@example.invalid`,
        fullName: `E2E race customer ${index}`,
        passwordHash,
        isEmailVerified: true,
        customerProfile: { create: {} },
        userRoles: { create: { roleId: customerRole.id } },
      },
      include: { customerProfile: true },
    });
    customers.push({
      email: user.email,
      password: process.env.PW_FIXTURE_PASSWORD,
      accessToken: accessToken(user, 'CUSTOMER', 'CUSTOMER'),
      customerId: user.customerProfile.id,
    });
  }

  const receptionGrant = await db.userRole.findFirstOrThrow({
    where: { role: { code: 'RECEPTIONIST' }, branchId: { not: null }, user: { isActive: true } },
    include: { user: true },
  });
  const receptionActor = {
    accessToken: accessToken(receptionGrant.user, 'RECEPTIONIST', 'SALON', receptionGrant.businessId, receptionGrant.branchId),
  };
  const candidates = await db.staffProfile.findMany({
    where: {
      status: 'ACTIVE', isBookable: true, deletedAt: null,
      staffServices: { some: { service: { branchId: receptionGrant.branchId, status: 'ACTIVE', bookable: true, deletedAt: null } } },
    },
    include: {
      staffServices: {
        where: { service: { branchId: receptionGrant.branchId, status: 'ACTIVE', bookable: true, deletedAt: null } },
        include: { service: true },
      },
    },
  });
  const staff = candidates.find((item) => item.staffServices.length >= 2) ?? candidates[0];
  assert.ok(staff?.staffServices.length, 'Concurrency fixture requires an active skilled staff member');
  const offering = staff.staffServices[0].service;
  const secondOffering = staff.staffServices[1]?.service ?? offering;
  const singleSlots = await availableSlots(offering.branchId, [offering.id], staff.id, 16);
  const multiIds = [...new Set([offering.id, secondOffering.id])];
  assert.equal(multiIds.length, 2, 'Multi-service concurrency needs two services on one staff member');
  const multiSlots = await availableSlots(offering.branchId, multiIds, staff.id, 3, 25);

  const payloads = [0, 1, 2, 3].map((index) => bookingPayload(offering.branchId, [offering.id], singleSlots[index], staff.id));
  const scenarios = {};
  scenarios.PW_RACE_CUSTOMER_RECEPTIONIST_JSON = {
    actors: [customers[0], receptionActor],
    requests: [
      { actor: 0, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], singleSlots[4], staff.id) },
      { actor: 1, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], singleSlots[4], staff.id, { customerId: customers[1].customerId, source: 'STAFF_CREATED' }) },
    ],
  };
  scenarios.PW_RACE_MULTI_SERVICE_ONE_STAFF_JSON = {
    actors: [customers[2], customers[3]],
    requests: [0, 1].map((actor) => ({ actor, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, multiIds, multiSlots[0], staff.id) })),
  };
  scenarios.PW_RACE_MULTI_SERVICE_MANY_STAFF_JSON = {
    actors: [customers[4], customers[5]],
    requests: [0, 1].map((actor) => ({ actor, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, multiIds, multiSlots[1], null) })),
    allowedOutcomes: [{ successes: 1, conflicts: 1 }, { successes: 2, conflicts: 0 }],
  };

  const moveSource = await createExistingBooking(customers[6].customerId, offering, staff.id, singleSlots[8], 'E2E-RACE-MOVE');
  const moveTarget = singleSlots[9];
  scenarios.PW_RACE_RESCHEDULE_CREATE_JSON = {
    actors: [receptionActor, customers[7]],
    requests: [
      { actor: 0, method: 'PATCH', path: `/bookings/${moveSource.id}/move`, data: { newStartTime: moveTarget.start, newEndTime: new Date(new Date(moveTarget.start).getTime() + Number(offering.durationMinutes) * 60_000).toISOString(), newStaffId: staff.id } },
      { actor: 1, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], moveTarget, staff.id) },
    ],
  };

  const cancelSource = await createExistingBooking(customers[8].customerId, offering, staff.id, singleSlots[10], 'E2E-RACE-CANCEL');
  scenarios.PW_RACE_CANCEL_CREATE_JSON = {
    actors: [receptionActor, customers[9]],
    requests: [
      { actor: 0, method: 'PATCH', path: `/bookings/${cancelSource.id}/status`, data: { status: 'CANCELLED', changedByType: 'SALON', note: 'Concurrency verification' } },
      { actor: 1, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], singleSlots[10], staff.id) },
    ],
    allowedOutcomes: [{ successes: 1, conflicts: 1 }, { successes: 2, conflicts: 0 }],
  };

  const voucherCode = `E2ERACE${Date.now()}`;
  const voucher = await db.voucher.create({ data: {
    code: voucherCode, name: 'E2E quota one', discountType: 'FIXED_AMOUNT', discountValue: 1000,
    totalQuantity: 1, usedQuantity: 0, startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 7 * 86_400_000), businessId: receptionGrant.businessId,
    scope: 'TENANT', audience: 'SELECTED', maxUsagePerCustomer: 1,
  } });
  await db.customerVoucher.createMany({ data: [10, 11].map((index) => ({ voucherId: voucher.id, customerId: customers[index].customerId, expiresAt: voucher.endDate })) });
  await db.customerBusinessSegment.createMany({
    data: [10, 11].map((index) => ({
      businessId: receptionGrant.businessId,
      customerId: customers[index].customerId,
      segment: 'SELECTED',
    })),
    skipDuplicates: true,
  });
  scenarios.PW_RACE_VOUCHER_QUOTA_JSON = {
    actors: [customers[10], customers[11]],
    requests: [
      { actor: 0, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], singleSlots[12], staff.id, { voucherCode }) },
      { actor: 1, method: 'POST', path: '/bookings', data: bookingPayload(offering.branchId, [offering.id], singleSlots[13], staff.id, { voucherCode }) },
    ],
    expectedSuccesses: 1,
    expectedConflicts: 1,
  };

  const claimToken = randomUUID() + randomUUID();
  const offeredStart = new Date(singleSlots[14].start);
  const waitlist = await db.waitlistEntry.create({ data: {
    customerId: customers[0].customerId,
    businessId: receptionGrant.businessId,
    branchId: offering.branchId,
    serviceId: offering.id,
    staffId: staff.id,
    windowStart: new Date(offeredStart.getTime() - 60_000),
    windowEnd: new Date(offeredStart.getTime() + 60_000),
    status: 'OFFERED',
    offeredStartAt: offeredStart,
    offerExpiresAt: new Date(Date.now() + 30 * 60_000),
    offerTokenHash: createHash('sha256').update(claimToken).digest('hex'),
    offerSlotKey: `${offering.branchId}:${staff.id}:${offeredStart.toISOString()}:${suffix}`,
  } });
  scenarios.PW_RACE_WAITLIST_ACCEPT_JSON = {
    actors: [customers[0]],
    requests: [0, 1].map(() => ({ actor: 0, method: 'PATCH', path: `/waitlist/${waitlist.id}/accept`, data: { token: claimToken } })),
  };

  const negativeCases = [
    { name: 'empty services', expectedStatus: 400, payload: { branchId: offering.branchId, serviceIds: [], appointmentDate: singleSlots[15].start, staffId: staff.id } },
    { name: 'invalid branch id', expectedStatus: 400, payload: { branchId: 'not-a-uuid', serviceIds: [offering.id], appointmentDate: singleSlots[15].start, staffId: staff.id } },
    { name: 'invalid appointment date', expectedStatus: 400, payload: { branchId: offering.branchId, serviceIds: [offering.id], appointmentDate: 'not-a-date', staffId: staff.id } },
  ];

  const env = {
    ...process.env,
    PW_BASE_URL: 'http://localhost:8183',
    PW_API_BASE_URL: api,
    PW_NO_WEB_SERVER: '1',
    PW_RUN_MUTATING_E2E: '1',
    PW_RUN_CONCURRENCY_E2E: '1',
    PW_TEST_DATABASE_URL: source.toString(),
    PW_CONCURRENCY_CUSTOMERS_JSON: JSON.stringify(customers.slice(0, 10).map(({ accessToken }) => ({ accessToken }))),
    PW_BOOKING_PAYLOADS_JSON: JSON.stringify(payloads),
    PW_BOOKING_CUSTOMER_EMAIL: customers[11].email,
    PW_BOOKING_CUSTOMER_PASSWORD: process.env.PW_FIXTURE_PASSWORD,
    PW_BOOKING_NEGATIVE_CASES_JSON: JSON.stringify(negativeCases),
    ...Object.fromEntries(Object.entries(scenarios).map(([key, value]) => [key, JSON.stringify(value)])),
  };
  const args = [resolve(web, 'node_modules/@playwright/test/cli.js'), 'test', '--grep', '@concurrency|prepared booking rule violations', '--project=chromium', '--reporter=line', '--workers=1', '--max-failures=1'];
  const code = await new Promise((ok, no) => {
    const child = spawn(process.execPath, args, { cwd: web, env, windowsHide: true, stdio: 'inherit' });
    child.on('error', no);
    child.on('close', ok);
  });
  assert.equal(code, 0, 'Concurrency/negative browser regression failed');
} finally {
  await db.$disconnect();
  await pool.end();
}
