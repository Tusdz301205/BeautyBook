import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_[a-z0-9_]+$/i);
assert.notEqual(process.env.NODE_ENV, 'production');
const url = new URL(process.env.DATABASE_URL); url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const require = createRequire(import.meta.url);
const { normalizeAppointmentForStorage } = require('../dist/src/common/utils/booking-datetime.js');
const { recordBookingViolation, bookingViolationSummary, voidInvalidBookingViolation } = require('../dist/src/bookings/booking-violation-policy.js');
const { ChangeRequestsService } = require('../dist/src/bookings/change-requests.service.js');
const { BookingsService } = require('../dist/src/bookings/bookings.service.js');
const { withSerializableTransaction } = require('../dist/src/common/utils/serializable-transaction.js');
const results = [];
const now = new Date();
const day = 86_400_000;
try {
  const customer = await db.customerProfile.findFirstOrThrow({ where: { user: { email: 'khach0999@glowbook.vn' } } });
  const owner = await db.user.findUniqueOrThrow({ where: { email: 'lananh.owner@glowbook.vn' } });
  const grant = await db.userRole.findFirstOrThrow({ where: { userId: owner.id, role: { code: 'BUSINESS_OWNER' } } });
  const branch = await db.branch.findFirstOrThrow({ where: { businessId: grant.businessId, deletedAt: null } });
  const foreign = await db.branch.findFirstOrThrow({ where: { businessId: { not: branch.businessId }, deletedAt: null } });
  const baseline = await bookingViolationSummary(db, customer.id, branch.businessId, now);
  const changeRequests = new ChangeRequestsService(db, { getEffective: async () => ({ freeCancellationHours: 4 }) }, { releaseBookingBenefits: async () => {} });
  async function fixture(occurredAt, kind = 'LATE_CANCELLATION', target = branch) {
    let start = new Date(occurredAt.getTime() + (kind === 'NO_SHOW' ? -3_600_000 : 3_600_000));
    let interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    // Legacy DATE/TIME storage rejects overnight fixtures. Keep the late
    // request inside 4h while moving only this test's interval past midnight.
    if (interval.appointmentEndTime <= interval.appointmentStartTime) {
      start = new Date(start.getTime() + (kind === 'NO_SHOW' ? -1_800_000 : 1_800_000));
      interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    }
    return db.$transaction(async tx => {
      const booking = await tx.booking.create({ data: { bookingCode: `TEST-POLICY-${randomUUID()}`, customerId: customer.id,
        branchId: target.id, status: 'CONFIRMED', totalAmount: 0, finalAmount: 0, source: 'ONLINE_WEB',
        ...interval } });
      const request = kind === 'LATE_CANCELLATION' ? await tx.appointmentChangeRequest.create({ data: {
        bookingId: booking.id, requestedBy: customer.userId, requestedByType: 'CUSTOMER', requestType: 'CANCEL',
        createdAt: occurredAt, expiresAt: new Date(occurredAt.getTime() + day), reason: 'Isolated policy verification',
      } }) : null;
      const event = await recordBookingViolation(tx, { bookingId: booking.id, customerId: customer.id,
        businessId: target.businessId, sourceRequestId: request?.id, kind, occurredAt,
        appointmentStartAt: start, recordedById: kind === 'NO_SHOW' ? owner.id : customer.userId });
      return { booking, request, event };
    });
  }
  const late = await fixture(new Date(now.getTime() - 3 * 3_600_000));
  assert.equal((await bookingViolationSummary(db, customer.id, branch.businessId, now)).score, baseline.score + 1);
  results.push('Pending late cancellation already counts +1 at requestedAt');
  await assert.rejects(changeRequests.reject(late.request.id, owner.id, 'Keep booking'), /Không được từ chối/);
  assert.equal((await db.appointmentChangeRequest.findUniqueOrThrow({ where: { id: late.request.id } })).status, 'PENDING');
  results.push('Salon cannot reject valid late cancellation');
  const bookings = new BookingsService(db, {}, { notifyBookingUpdated() {} }, {}, {}, {});
  await assert.rejects(bookings.updateStatus(late.booking.id, 'NO_SHOW', owner.id, undefined, 'SALON', ['BUSINESS_OWNER'], true), /đã gửi yêu cầu hủy/);
  results.push('Valid request prevents no-show after start');
  const approved = await changeRequests.approve(late.request.id, owner.id);
  assert.equal(approved.status, 'CANCELLED');
  assert.equal(await db.bookingViolationEvent.count({ where: { sourceRequestId: late.request.id } }), 1);
  assert.equal((await bookingViolationSummary(db, customer.id, branch.businessId, now)).score, baseline.score + 1);
  await assert.rejects(changeRequests.approve(late.request.id, owner.id), /đã xử lý/);
  results.push('Approval after start within 24h cancels booking without additional points');

  const expired = await fixture(new Date(now.getTime() - 2 * day));
  await changeRequests.expirePending(expired.booking.id);
  assert.equal((await db.appointmentChangeRequest.findUniqueOrThrow({ where: { id: expired.request.id } })).status, 'EXPIRED');
  await assert.rejects(bookings.updateStatus(expired.booking.id, 'NO_SHOW', owner.id, undefined, 'SALON', ['BUSINESS_OWNER'], true), /đã gửi yêu cầu hủy/);
  assert.equal((await bookingViolationSummary(db, customer.id, branch.businessId, now)).score, baseline.score + 2);
  results.push('Expiry keeps +1 and no-show protection');

  const old = await fixture(new Date(now.getTime() - 91 * day));
  const boundary = await fixture(new Date(now.getTime() - 90 * day));
  const invalid = await fixture(new Date(now.getTime() - 89 * day));
  await withSerializableTransaction(db, tx => voidInvalidBookingViolation(tx, invalid.event.id, owner.id, 'BUSINESS_RULE_ERROR', 'Isolated test proves invalid booking state', now));
  await assert.rejects(changeRequests.approve(invalid.request.id, owner.id), /không hợp lệ/);
  await fixture(new Date(now.getTime() - day), 'NO_SHOW');
  await fixture(new Date(now.getTime() - day), 'LATE_CANCELLATION', foreign);
  const summary = await bookingViolationSummary(db, customer.id, branch.businessId, now);
  assert.equal(summary.score, baseline.score + 5);
  assert.equal(summary.lateCancellations, baseline.lateCancellations + 3);
  assert.equal(summary.noShows, baseline.noShows + 1);
  results.push('90-day boundary included; older/void events excluded; no-show +2; business isolation');
  assert.equal((await bookingViolationSummary(db, customer.id, branch.businessId, new Date(now.getTime() + 91 * day))).score, 0);
  results.push('Score ages out from history without counter updates');
  await assert.rejects(db.bookingViolationEvent.update({ where: { id: old.event.id }, data: { occurredAt: now } }));
  await assert.rejects(db.bookingViolationEvent.delete({ where: { id: boundary.event.id } }));
  await assert.rejects(db.bookingViolationEvent.update({ where: { id: invalid.event.id }, data: { voidedAt: null, voidedById: null, voidReason: null } }));
  results.push('Evidence immutable, no deletion or unvoid');
  const duplicateData = { ...late.event, id: randomUUID() }; delete duplicateData.createdAt;
  await assert.rejects(db.bookingViolationEvent.create({ data: duplicateData }));
  results.push('Database prevents duplicate event/source request');
  console.log(JSON.stringify({ results, testDatabase: name, summary }, null, 2));
} finally { await db.$disconnect(); await pool.end(); }
