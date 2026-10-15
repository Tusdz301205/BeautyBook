import type { Prisma } from '@prisma/client';
import { bookingAttendance, attendedHistoryWhere, customerScheduleWhere, hasRecordedVisit, attendedVisitWhere } from './booking-attendance';
import { withBookingTiming } from './booking-actual-timing';
import { BookingsController } from './bookings.controller';
import { BookingItemsService } from './booking-items.service';
import { assertActorStatusTransition } from './bookings.validation';
import { BookingsService } from './bookings.service';

const now = new Date('2026-10-13T03:00:00Z'); // 10:00 in the existing booking timezone.
const fields = { appointmentStartTime: { name: 'appointmentStartTime' } as never };
const booking = (status = 'CHECKED_IN', day = '2026-10-13', start = '09:30', end = '10:00') => ({
  status, appointmentDate: new Date(day), appointmentStartTime: new Date(`1970-01-01T${start}:00Z`),
  appointmentEndTime: new Date(`1970-01-01T${end}:00Z`), bookingServices: [{ status: 'SCHEDULED' }],
});

// Exercise the actual query predicate against schedule/attendance cases, including overnight rows.
function matches(row: Record<string, unknown>, where: Prisma.BookingWhereInput): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR') { if (!(value as Prisma.BookingWhereInput[]).some(w => matches(row, w))) return false; }
    else if (key === 'NOT') { if (matches(row, value as Prisma.BookingWhereInput)) return false; }
    else if (key === 'AND') { if (!(value as Prisma.BookingWhereInput[]).every(w => matches(row, w))) return false; }
    else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      for (const [op, operand] of Object.entries(value as Record<string, unknown>)) {
        const expected = operand === fields.appointmentStartTime ? row.appointmentStartTime : operand;
        const actual = row[key] as Date;
        if (op === 'lt' && !(actual < (expected as Date)) || op === 'lte' && !(actual <= (expected as Date)) ||
          op === 'gt' && !(actual > (expected as Date)) || op === 'in' && !(expected as string[]).includes(row[key] as string)) return false;
      }
    } else if (row[key] instanceof Date && value instanceof Date ? row[key].getTime() !== value.getTime() : row[key] !== value) return false;
  }
  return true;
}

describe('check-in-only booking workflow', () => {
  it('later cancellation does not erase the recorded visit for returning-customer rules, but does not enable cancelled reviews', () => {
    const row = { ...booking('CANCELLED'), statusHistory: [{ status: 'CONFIRMED' }, { status: 'CHECKED_IN' }, { status: 'CANCELLED' }] };
    expect(hasRecordedVisit(row)).toBe(true);
    expect(hasRecordedVisit({ status: 'CANCELLED', statusHistory: [{ status: 'CONFIRMED' }] })).toBe(false);
    expect(attendedVisitWhere().deletedAt).toBe(null);
    expect(attendedVisitWhere().OR).toContainEqual({ statusHistory: { some: { status: { in: ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'] } } } });
    expect(bookingAttendance(row, now).canReview).toBe(false);
  });
  it('all customer rows use one cutoff and one scoped query instead of racing time partitions', async () => {
    const rows = [{ ...booking(), id: 'attended' }, { ...booking('CONFIRMED'), id: 'future' }];
    const prisma = { customerProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'own' }) }, booking: { findMany: jest.fn().mockResolvedValue(rows) } };
    const controller = new BookingsController({} as never, {} as never, prisma as never, {} as never, {} as never, {} as never, {} as never);
    const result = await controller.myAppointments({ id: 'customer' } as never, 'all');
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: 'own', deletedAt: null } }));
    expect(result.data.map(row => row.id)).toEqual(['attended', 'future']);
    expect(result.data.every(row => row.serverNow === result.serverNow)).toBe(true);
  });
  it('unfinished filtering and metadata use the same cutoff even when database latency spans end time', async () => {
    jest.useFakeTimers().setSystemTime(new Date(now.getTime() - 1));
    try {
      const row = { ...booking(), id: 'b', bookingCode: 'BB', bookingServices: [], totalAmount: 100 };
      const readBookings = jest.fn<Promise<typeof row[]>, [{ where: Prisma.BookingWhereInput }]>(() => { jest.setSystemTime(now); return Promise.resolve([row]); });
      const prisma = { booking: { fields, count: jest.fn().mockResolvedValue(1), findMany: readBookings } };
      const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
      jest.spyOn(service, 'expirePendingHolds').mockResolvedValue(0);
      const result = await service.findAll({ status: 'unfinished', allowedBranchIds: ['branch'] });
      expect(result.data[0]).toMatchObject({ scheduleElapsed: false, scheduleBucket: 'UPCOMING', serverNow: new Date(now.getTime() - 1) });
      expect(prisma.booking.findMany.mock.calls[0][0].where.NOT).toEqual(attendedHistoryWhere(result.data[0].serverNow, fields));
    } finally { jest.useRealTimers(); }
  });
  it('resizing an item stores a wall-clock TIME and preserves the correct history/review boundary', async () => {
    const parent = booking('CHECKED_IN', '2026-10-13', '09:00', '10:00');
    const item = { id: 'item', bookingId: 'b', revision: 1, status: 'SCHEDULED', itemStartAt: new Date('2026-10-13T02:00:00Z'), booking: parent, staffId: null };
    const tx = { $queryRaw: jest.fn(), bookingService: { findFirst: jest.fn().mockResolvedValue(item), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(item) },
      booking: { findUnique: jest.fn().mockResolvedValue(parent), update: jest.fn(({ data }: { data: { appointmentEndTime: Date } }) => { parent.appointmentEndTime = data.appointmentEndTime; return Promise.resolve(parent); }) } };
    const service = new BookingItemsService({ $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) } as never);
    jest.spyOn(service as any, 'recordAdjustment').mockResolvedValue(null);
    jest.spyOn(service as any, 'detail').mockResolvedValue({});
    await service.update('b', 'item', 'owner', { action: 'RESIZE', durationMinutes: 120, expectedRevision: 1, reason: 'Adjust planned duration' });
    expect(parent.appointmentEndTime.toISOString()).toBe('1970-01-01T11:00:00.000Z');
    expect(bookingAttendance(parent, new Date('2026-10-13T03:59:59Z')).canReview).toBe(false);
    expect(bookingAttendance(parent, new Date('2026-10-13T04:00:00Z'))).toMatchObject({ canReview: true, scheduledEndAt: new Date('2026-10-13T04:00:00Z') });
  });
  it('moves an attended booking to history at planned end without lifecycle/actual/payment mutation', () => {
    const row = booking(); const before = JSON.stringify(row);
    expect(bookingAttendance(row, new Date(now.getTime() - 1))).toMatchObject({ scheduleBucket: 'UPCOMING', canReview: false });
    const view = withBookingTiming(row, now);
    expect(view).toMatchObject({ status: 'CHECKED_IN', attendanceWorkflow: 'CHECK_IN_ONLY', scheduleBucket: 'HISTORY', scheduleElapsed: true, canReview: true });
    expect(view.bookingServices[0]).toMatchObject({ status: 'SCHEDULED', actualStartedAt: null, actualCompletedAt: null, actualTimingStatus: 'UNKNOWN' });
    expect(JSON.stringify(row)).toBe(before);
  });
  it.each(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'])('elapsed %s is not invented completion/review eligibility', status => {
    expect(bookingAttendance(booking(status), now).canReview).toBe(false);
  });
  it('preserves historical completion and proven actual-time audits', () => {
    const start = new Date('2026-10-13T02:30:00Z'), end = new Date('2026-10-13T03:05:00Z');
    const view = withBookingTiming({ ...booking('COMPLETED'), bookingServices: [{ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      { action: 'START', version: 1, createdAt: start, beforeSnapshot: { status: 'SCHEDULED' }, afterSnapshot: { status: 'IN_PROGRESS' } },
      { action: 'COMPLETE', version: 2, createdAt: end, beforeSnapshot: { status: 'IN_PROGRESS' }, afterSnapshot: { status: 'COMPLETED' } },
    ] }] }, now);
    expect(view.bookingServices[0]).toMatchObject({ actualStartedAt: start, actualCompletedAt: end, actualTimingSource: 'SERVICE_ADJUSTMENT' });
    expect(view.scheduleBucket).toBe('HISTORY');
  });
  it('never guesses absent or invalid schedules and rejects deleted bookings for reviews', () => {
    expect(bookingAttendance({ status: 'CHECKED_IN' }, now)).toMatchObject({ scheduleElapsed: false, canReview: false, scheduledEndAt: null });
    expect(bookingAttendance({ ...booking(), appointmentDate: new Date(NaN) }, now).canReview).toBe(false);
    expect(bookingAttendance({ ...booking(), deletedAt: now }, now).canReview).toBe(false);
  });
  it.each([
    booking(), booking('CHECKED_IN', '2026-10-13', '09:30', '10:01'), booking('CHECKED_IN', '2026-10-12'),
    booking('CHECKED_IN', '2026-10-14'), booking('CHECKED_IN', '2026-10-12', '23:30', '10:01'),
    booking('CHECKED_IN', '2026-10-12', '23:30', '10:00'), booking('CHECKED_IN', '2026-10-13', '23:30', '01:00'),
    booking('COMPLETED'), booking('IN_PROGRESS'), booking('CANCELLED'), booking('CONFIRMED'),
  ])('query and projection agree for %j', row => {
    expect(matches(row, attendedHistoryWhere(now, fields))).toBe(row.status === 'CHECKED_IN' && bookingAttendance(row, now).scheduleElapsed);
    expect(matches(row, customerScheduleWhere('completed', now, fields))).toBe(bookingAttendance(row, now).scheduleBucket === 'HISTORY');
    expect(matches(row, customerScheduleWhere('upcoming', now, fields))).toBe(bookingAttendance(row, now).scheduleBucket === 'UPCOMING');
  });
  it.each(['START', 'COMPLETE', 'REASSIGN', 'REPRICE'] as const)('rejects direct STAFF item %s without writing', async action => {
    const items = { update: jest.fn() }, access = { assertWrite: jest.fn().mockResolvedValue({}), rolesAtResource: jest.fn().mockReturnValue(['STAFF']) };
    const controller = new BookingsController({} as never, access as never, {} as never, {} as never, {} as never, {} as never, items as never);
    await expect(controller.updateBookingItem('b', 'i', { action, reason: 'test', expectedRevision: 1 }, { id: 'u', roles: ['STAFF'] } as never))
      .rejects.toMatchObject({ status: 403, response: { code: 'STAFF_SCHEDULE_READ_ONLY' } });
    expect(items.update).not.toHaveBeenCalled();
  });
  it('denies legacy STAFF service calls before transactions; actor parent transitions deny START and COMPLETE', async () => {
    const prisma = { $transaction: jest.fn() };
    await expect(new BookingItemsService(prisma as never).update('b', 'i', 'u', { action: 'START', reason: 'test', expectedRevision: 1 }, { assignedStaffUserId: 'u' }))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(() => assertActorStatusTransition(['STAFF'], 'CHECKED_IN', 'IN_PROGRESS')).toThrow();
    expect(() => assertActorStatusTransition(['STAFF'], 'IN_PROGRESS', 'COMPLETED')).toThrow();
    expect(() => assertActorStatusTransition(['RECEPTIONIST'], 'CONFIRMED', 'CHECKED_IN')).not.toThrow();
  });
});
