import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_restriction_\d+$/);
assert.notEqual(process.env.NODE_ENV, 'production');
const url = new URL(process.env.DATABASE_URL); url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { recordBookingViolation } = require('../dist/src/bookings/booking-violation-policy.js');
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime.js');
const { withSerializableTransaction } = require('../dist/src/common/utils/serializable-transaction.js');
try {
  const owner = await db.user.findUniqueOrThrow({ where: { email: 'lananh.owner@glowbook.vn' } });
  const grant = await db.userRole.findFirstOrThrow({ where: { userId: owner.id, role: { code: 'BUSINESS_OWNER' } } });
  const service = await db.branchServiceOffering.findFirstOrThrow({ where: { status: 'ACTIVE', bookable: true, deletedAt: null,
    branch: { businessId: grant.businessId, status: 'ACTIVE', deletedAt: null },
    staffServices: { some: { staff: { status: 'ACTIVE', isBookable: true, deletedAt: null } } } },
    include: { branch: true, staffServices: { where: { staff: { status: 'ACTIVE', isBookable: true, deletedAt: null } }, include: { staff: true } } } });
  const fixture = { testDatabase: name, branchId: service.branchId, businessId: grant.businessId,
    serviceId: service.id, staffId: service.staffServices[0].staffId, staffName: service.staffServices[0].staff.fullName, customers: {} };
  for (const [score, email] of [[2,'khach0998@glowbook.vn'],[3,'khach0997@glowbook.vn'],[4,'khach0996@glowbook.vn']]) {
    const c = await db.customerProfile.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(await db.bookingViolationEvent.count({ where: { customerId: c.id } }), 0, 'Use fresh copy; do not double seed');
    const kinds = score === 2 ? ['NO_SHOW'] : score === 3 ? ['NO_SHOW','LATE_CANCELLATION'] : ['NO_SHOW','NO_SHOW'];
    for (const [i, kind] of kinds.entries()) {
      const at = new Date(Date.now() - (3-i)*86_400_000); at.setUTCHours(3,0,0,0);
      const start = new Date(at.getTime() + (kind === 'NO_SHOW' ? -3_600_000 : 3_600_000));
      await withSerializableTransaction(db, async tx => {
        const booking = await tx.booking.create({ data: { bookingCode: `TEST-UI-POLICY-${randomUUID()}`, customerId: c.id,
          branchId: service.branchId, status: kind === 'NO_SHOW' ? 'NO_SHOW' : 'CANCELLED', totalAmount: 0, finalAmount: 0,
          ...normalizeAppointmentForStorage(start,new Date(start.getTime()+1_800_000)) } });
        const request = kind === 'LATE_CANCELLATION' ? await tx.appointmentChangeRequest.create({ data: {
          bookingId: booking.id, requestedBy: c.userId, requestedByType: 'CUSTOMER', requestType: 'CANCEL',
          createdAt: at, expiresAt: new Date(at.getTime()+86_400_000) } }) : null;
        await recordBookingViolation(tx, { bookingId: booking.id, customerId: c.id, businessId: grant.businessId,
          kind, sourceRequestId: request?.id, occurredAt: at, appointmentStartAt: start, recordedById: request ? c.userId : owner.id });
      });
    }
    fixture.customers[score] = { email, customerId: c.id };
  }
  writeFileSync('../tmp/restriction-browser.json', JSON.stringify(fixture, null, 2));
  console.log(JSON.stringify({ result: 'UI_FIXTURES_READY', testDatabase: name, branchId: fixture.branchId, serviceId: fixture.serviceId }));
} finally { await db.$disconnect(); await pool.end(); }
