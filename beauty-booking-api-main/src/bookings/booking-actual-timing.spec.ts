import { bookingItemActualTiming, withBookingTiming } from './booking-actual-timing';
import { BookingItemsService } from './booking-items.service';
import { ConflictException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const startAt = new Date('2026-10-04T16:58:00Z');
const event = (action: string, version: number, before: string, after: string, at = startAt) => ({
  action, version, beforeSnapshot: { status: before, reason: 'private' }, afterSnapshot: { status: after }, createdAt: at,
});
const start = event('START', 1, 'SCHEDULED', 'IN_PROGRESS');

describe('Actual execution is a projection of persisted service audit facts', () => {
  test('scheduled time, duration, updatedAt and parent progress never invent a START', () => {
    const timing = bookingItemActualTiming({ status: 'IN_PROGRESS' });
    expect(timing).toEqual({ actualStartedAt: null, actualCompletedAt: null, actualStoppedAt: null, actualTimingSource: 'UNAVAILABLE' });
  });
  test.each([1, 60, 180])('early, planned and overdue completion (%i minutes) uses the actual COMPLETE', (minutes) => {
    const end = new Date(startAt.getTime() + minutes * 60000);
    const timing = bookingItemActualTiming({ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      event('COMPLETE', 3, 'IN_PROGRESS', 'COMPLETED', end), start,
      event('REPRICE', 2, 'IN_PROGRESS', 'IN_PROGRESS', new Date(startAt.getTime() + 1000)),
    ] });
    expect(timing.actualStartedAt).toEqual(startAt);
    expect(timing.actualCompletedAt).toEqual(end);
    expect(timing.actualStoppedAt).toEqual(end);
    expect((timing.actualStoppedAt!.getTime() - timing.actualStartedAt!.getTime()) / 60000).toBe(minutes);
  });
  test('crosses the Vietnam day boundary using absolute timestamps', () => {
    const end = new Date('2026-10-04T17:05:00Z');
    const timing = bookingItemActualTiming({ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      start, event('COMPLETE', 2, 'IN_PROGRESS', 'COMPLETED', end),
    ] });
    expect(timing.actualStoppedAt!.getTime() - timing.actualStartedAt!.getTime()).toBe(7 * 60000);
  });
  test('skip after START stops elapsed time and never claims completion', () => {
    const stopAt = new Date(startAt.getTime() + 2000);
    expect(bookingItemActualTiming({ status: 'SKIPPED', refs_BookingServiceAdjustment_bookingServiceId: [
      start, event('SKIP', 2, 'IN_PROGRESS', 'SKIPPED', stopAt),
    ] })).toEqual({ actualStartedAt: startAt, actualCompletedAt: null, actualStoppedAt: stopAt, actualTimingSource: 'SERVICE_ADJUSTMENT' });
  });
  test('skip before START and cancelled items without a stop audit keep unknown actual times null', () => {
    expect(bookingItemActualTiming({ status: 'SKIPPED', refs_BookingServiceAdjustment_bookingServiceId: [
      event('SKIP', 1, 'SCHEDULED', 'SKIPPED'),
    ] }).actualStoppedAt).toBeNull();
    expect(bookingItemActualTiming({ status: 'CANCELLED', refs_BookingServiceAdjustment_bookingServiceId: [start] }))
      .toMatchObject({ actualStartedAt: startAt, actualStoppedAt: null, actualCompletedAt: null });
  });
  test('legacy completion without START keeps the start unknown', () => {
    const timing = bookingItemActualTiming({ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      event('COMPLETE', 2, 'IN_PROGRESS', 'COMPLETED'),
    ] });
    expect(timing.actualStartedAt).toBeNull(); expect(timing.actualCompletedAt).toEqual(startAt);
  });
  test('invalid transition snapshots never fabricate execution', () => {
    expect(bookingItemActualTiming({ status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      event('START', 1, 'CANCELLED', 'IN_PROGRESS'), event('COMPLETE', 2, 'SCHEDULED', 'COMPLETED'),
    ] }).actualTimingSource).toBe('UNAVAILABLE');
  });
  test('reload/clock offset changes serverNow only; completed values freeze and private audit stays internal', () => {
    const booking = { bookingServices: [{ id: 'item', status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [
      start, event('COMPLETE', 2, 'IN_PROGRESS', 'COMPLETED', new Date(startAt.getTime() + 1000)),
    ] }] };
    const first = withBookingTiming(booking, startAt);
    const reloaded = withBookingTiming(booking, new Date('2099-01-01T00:00:00Z'));
    expect(first.bookingServices).toEqual(reloaded.bookingServices);
    expect(first.serverNow).not.toEqual(reloaded.serverNow);
    expect(first.bookingServices[0]).not.toHaveProperty('refs_BookingServiceAdjustment_bookingServiceId');
    expect(booking.bookingServices[0]).toHaveProperty('refs_BookingServiceAdjustment_bookingServiceId');
  });
  test('each service keeps independent facts in a multi-service booking', () => {
    const booking = withBookingTiming({ status: 'IN_PROGRESS', bookingServices: [
      { id: 'a', status: 'COMPLETED', refs_BookingServiceAdjustment_bookingServiceId: [start, event('COMPLETE', 2, 'IN_PROGRESS', 'COMPLETED')] },
      { id: 'b', status: 'SCHEDULED' },
    ] });
    expect(booking.status).toBe('IN_PROGRESS');
    expect(booking.bookingServices[0].actualCompletedAt).toEqual(startAt);
    expect(booking.bookingServices[1].actualStartedAt).toBeNull();
  });
});

describe('Terminal item operational guards retain revision and financial policy', () => {
  test.each(['COMPLETED', 'SKIPPED', 'CANCELLED'])('REASSIGN on %s rejects without revision/audit changes', async (status) => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), bookingService: {
      findFirst: jest.fn().mockResolvedValue({ id: 'item', bookingId: 'booking', status, revision: 3, priceAtBooking: 100,
        booking: { status: 'IN_PROGRESS' } }), updateMany: jest.fn(),
    } };
    const service = new BookingItemsService({ $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) } as never);
    const audit = jest.spyOn(service as any, 'recordAdjustment');
    await expect(service.update('booking', 'item', 'owner', { action: 'REASSIGN', staffId: 'staff', reason: 'Test', expectedRevision: 3 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
  test('stale request rejects before any actual START or audit write', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), bookingService: {
      findFirst: jest.fn().mockResolvedValue({ revision: 2, status: 'SCHEDULED', booking: { status: 'CHECKED_IN' } }), updateMany: jest.fn(),
    } };
    const service = new BookingItemsService({ $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) } as never);
    await expect(service.update('booking', 'item', 'actor', { action: 'START', reason: 'Retry', expectedRevision: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
  });
});

describe('Customer appointments keep execution states visible in the correct tab', () => {
  test.each([
    ['upcoming', ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']],
    ['completed', ['COMPLETED']],
    ['cancelled', ['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED']],
  ] as const)('%s is scoped to the authenticated customer and includes its full state set', async (tab, expected) => {
    const all = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED']
      .map(status => ({ id: status, status, bookingServices: [], branch: { timezone: 'Asia/Ho_Chi_Minh' } }));
    const findMany = jest.fn(({ where }: { where: { status: { in: string[] } } }) => Promise.resolve(all.filter(row => where.status.in.includes(row.status))));
    const prisma = { customerProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'own-customer' }) }, booking: { findMany } };
    const controller = new BookingsController({} as never, {} as never, prisma as never, {} as never, {} as never, {} as never, {} as never);
    const user: AuthUser = { id: 'own-user', email: 'own@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };
    const result = await controller.myAppointments(user, tab);
    expect(result.data.map(row => row.id)).toEqual(expected);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ customerId: 'own-customer', deletedAt: null });
    expect(result.data.every(row => row.serverNow instanceof Date)).toBe(true);
  });
});
