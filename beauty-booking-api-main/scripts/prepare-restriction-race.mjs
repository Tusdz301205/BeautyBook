import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_restriction_\d+$/);
assert.notEqual(process.env.NODE_ENV, 'production');
const fixture = JSON.parse(readFileSync('../tmp/restriction-browser.json', 'utf8'));
assert.equal(name, fixture.testDatabase);
const url = new URL(process.env.DATABASE_URL); url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime.js');
try {
  const start = new Date(); start.setUTCHours(1,0,0,0);
  if (start.getTime() >= Date.now()-900000) start.setUTCDate(start.getUTCDate()-1);
  const booking = await db.booking.create({ data: { bookingCode: `TEST-RESTRICTION-RACE-${randomUUID()}`, customerId: fixture.customers[3].customerId,
    branchId: fixture.branchId, status: 'CONFIRMED', totalAmount: 0, finalAmount: 0,
    ...normalizeAppointmentForStorage(start, new Date(start.getTime()+1_800_000)) } });
  fixture.raceNoShowBookingId = booking.id;
  writeFileSync('../tmp/restriction-browser.json', JSON.stringify(fixture,null,2));
  console.log(JSON.stringify({ testDatabase: name, result: 'RACE_FIXTURE_READY' }));
} finally { await db.$disconnect(); await pool.end(); }
