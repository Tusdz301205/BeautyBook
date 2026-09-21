import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_restriction_\d{12,14}$/);
assert.equal(process.env.NODE_ENV, 'test');
const password = process.env.PW_FIXTURE_PASSWORD; assert.ok(password);
const fixture = JSON.parse(readFileSync('../tmp/restriction-browser.json'));
assert.equal(fixture.testDatabase, name);
const url = new URL(process.env.DATABASE_URL); url.pathname = '/' + name;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime');
const web = resolve('../beauty-booking-web-main/beauty-booking-web-main');
const out = resolve('../tmp/main-deployment-20260920193641/post-main');
try {
  const suffix = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const inactive = await db.user.create({ data: { email: `e2e-inactive-${suffix}@example.invalid`, fullName: 'E2E inactive', passwordHash, isActive: false } });
  const noScope = await db.user.create({ data: { email: `e2e-noscope-${suffix}@example.invalid`, fullName: 'E2E no scope', passwordHash } });
  const customerRole = await db.role.findUniqueOrThrow({ where: { code: 'CUSTOMER' } });
  const bookingActors = {};
  for (const role of ['BOOKING_CUSTOMER', 'ANY_STAFF_CUSTOMER', 'LIFECYCLE_CUSTOMER']) {
    bookingActors[role] = (await db.user.create({ data: { email: `e2e-${role.toLowerCase()}-${suffix}@example.invalid`, fullName: 'E2E isolated booking customer', passwordHash, isEmailVerified: true, customerProfile: { create: {} }, userRoles: { create: { roleId: customerRole.id } } } })).email;
  }
  const reception = await db.userRole.findFirstOrThrow({ where: { user: { email: 'reception@glowbook.vn' }, role: { code: 'RECEPTIONIST' }, branchId: { not: null } } });
  const offering = await db.branchServiceOffering.findFirstOrThrow({ where: { branchId: reception.branchId, status: 'ACTIVE', bookable: true, deletedAt: null, staffServices: { some: { staff: { isBookable: true, status: 'ACTIVE', deletedAt: null } } } }, include: { staffServices: { where: { staff: { isBookable: true, status: 'ACTIVE', deletedAt: null } } } } });
  const customer = await db.customerProfile.findFirstOrThrow({ where: { user: { email: bookingActors.LIFECYCLE_CUSTOMER } } });
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const available = await fetch('http://localhost:3102/api/v1/bookings/available-slots?' + new URLSearchParams({ branchId: reception.branchId, staffId: offering.staffServices[0].staffId, serviceIds: offering.id, date }));
  assert.equal(available.status, 200);
  const slots = (await available.json()).slots;
  assert.ok(slots?.length, 'Lifecycle fixture requires an actually free future slot');
  const start = new Date(slots[0].start);
  const end = new Date(start.getTime() + 30 * 60000);
  const booking = await db.booking.create({ data: { customerId: customer.id, branchId: reception.branchId, bookingCode: `E2E-LIFECYCLE-${suffix}`, status: 'PENDING', pendingExpiresAt: new Date(Date.now() + 86400000), totalAmount: 100000, finalAmount: 100000, ...normalizeAppointmentForStorage(start, end), bookingServices: { create: { serviceId: offering.id, businessServiceId: offering.businessServiceId, staffId: offering.staffServices[0].staffId, priceAtBooking: 100000, durationMinutes: 30, serviceNameSnapshot: 'E2E lifecycle service', itemStartAt: start, itemEndAt: end } } } });
  const env = { ...process.env, PW_BASE_URL: 'http://localhost:8183', PW_API_BASE_URL: 'http://localhost:3102/api/v1', PW_NO_WEB_SERVER: '1', PW_RUN_MUTATING_E2E: '1', PW_TEST_DATABASE_NAME: name, PW_RESTRICTION_FIXTURE: resolve('../tmp/restriction-browser.json'), PW_BOOKING_BRANCH_ID: fixture.branchId, PW_BOOKING_SERVICE_ID: fixture.serviceId, PW_BOOKING_STAFF_ID: fixture.staffId, PW_BOOKING_STAFF_NAME: fixture.staffName, PW_CUSTOMER_PHONE: '0901234567', PW_EXISTING_BOOKING_ID: booking.id, PLAYWRIGHT_JSON_OUTPUT_FILE: resolve(out, 'browser-results.json') };
  for (const [role, email] of Object.entries({ CUSTOMER: 'khach0001@glowbook.vn', BOOKING_CUSTOMER: 'khach0002@glowbook.vn', RESPONSIVE_CUSTOMER: 'khach0003@glowbook.vn', LIFECYCLE_CUSTOMER: 'khach0004@glowbook.vn', STAFF: 'staff@glowbook.vn', RECEPTIONIST: 'reception@glowbook.vn', BUSINESS_OWNER: 'lananh.owner@glowbook.vn', PLATFORM_ADMIN: 'admin@glowbook.vn', INACTIVE: inactive.email, NO_SCOPE: noScope.email })) {
    env[`PW_${role}_EMAIL`] = email; env[`PW_${role}_PASSWORD`] = password;
  }
  for (const [role, email] of Object.entries(bookingActors)) { env[`PW_${role}_EMAIL`] = email; env[`PW_${role}_PASSWORD`] = password; }
  // Run the configured actor/UI suites first; concurrency and negative API fixtures are a separate stage.
  const args = [resolve(web, 'node_modules/@playwright/test/cli.js'), 'test', '--grep-invert', '@concurrency|prepared booking rule violations', '--reporter=line,json', '--max-failures=1'];
  const code = await new Promise((ok, no) => {
    const child = spawn(process.execPath, args, { cwd: web, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; child.stdout.on('data', b => { log += b; process.stdout.write(b); }); child.stderr.on('data', b => { log += b; process.stderr.write(b); });
    child.on('error', no); child.on('close', code => { writeFileSync(resolve(out, 'browser.log'), log); ok(code); });
  });
  assert.equal(code, 0, 'Browser regression failed; stop finalization');
} finally { await db.$disconnect(); await pool.end(); }
