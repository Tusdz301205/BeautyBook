import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingItemsService } from './booking-items.service';
import { ChangeRequestsService } from './change-requests.service';
import * as validation from './bookings.validation';
import { auditLog } from '../common/utils/audit';
import { notifyBookingBothParties, notifySalonMembers } from '../common/utils/notify';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn(), notifySalonMembers: jest.fn(), notifyBookingCustomer: jest.fn(),
}));
jest.mock('../common/utils/audit', () => ({ auditLog: jest.fn() }));

const deadline = new Date('2026-10-13T05:03:28.000Z');
const start = new Date('2026-10-15T02:00:00.000Z');
const end = new Date('2026-10-15T03:00:00.000Z');
const actions = ['CONFIRM', 'ADD', 'REASSIGN', 'MOVE', 'RESIZE_ITEM', 'RESIZE_BOOKING', 'ASSIGN', 'APPROVE_MOVE', 'APPROVE_STAFF'] as const;
type Action = typeof actions[number];
type ItemInput = Parameters<BookingItemsService['update']>[3];
type ItemPatch = { status?: string; staffId?: string; priceAtBooking?: number; revision?: { increment: number } };
type ParentPatch = { bookingServices?: { updateMany: { data: { staffId: string; revision: { increment: number } } } }; [key: string]: unknown };

// In-memory Prisma transport only: call real services, transaction wrapper,
// deadline policy, CAS, lifecycle and adjustment code. Snapshot rollback also
// proves an unsuccessful approval retains its pending request and parent.
function fixture() {
  const item = { id: 'item', bookingId: 'booking', status: 'SCHEDULED', revision: 1,
    serviceId: 'service', staffId: 'staff', sortOrder: 0, durationMinutes: 60,
    priceAtBooking: 100, itemStartAt: start, itemEndAt: end, actualTimeCorrections: [] as {
      actualTimingStatus: string; actualStartedAt: null; actualCompletedAt: null; version: number;
    }[],
    staff: { userId: 'staff-user' } };
  const booking = { id: 'booking', status: 'PENDING', deletedAt: null, pendingExpiresAt: deadline as Date | null | undefined,
    branchId: 'branch', customerId: 'customer', totalAmount: 100, finalAmount: 100, voucherId: null,
    appointmentDate: new Date('2026-10-15T00:00:00Z'),
    appointmentStartTime: new Date('1970-01-01T09:00:00Z'),
    appointmentEndTime: new Date('1970-01-01T10:00:00Z'),
    branch: { id: 'branch', businessId: 'business' }, customer: { user: null }, bookingServices: [item] };
  const request = { id: 'request', bookingId: booking.id, status: 'PENDING', requestType: 'RESCHEDULE',
    booking, expiresAt: new Date('2026-10-14T05:00:00Z'), createdAt: new Date('2026-10-13T04:00:00Z'),
    proposedStartTime: new Date('2026-10-15T04:00:00Z'), proposedEndTime: new Date('2026-10-15T05:00:00Z'),
    proposedStaffId: 'staff', requestedByType: 'SALON' };
  const readBooking = () => ({ ...booking, bookingServices: booking.bookingServices.map(entry => ({ ...entry })) });
  const writes: jest.Mock[] = [];
  const write = <Args extends unknown[], Result>(implementation: (...args: Args) => Result) => {
    const fn = jest.fn((...args: Args) => Promise.resolve(implementation(...args))); writes.push(fn); return fn;
  };
  let afterLock: (() => void) | undefined;
  const tx = {
    $queryRaw: jest.fn(() => { afterLock?.(); afterLock = undefined; return Promise.resolve([]); }),
    booking: {
      findFirst: jest.fn(() => Promise.resolve(readBooking())), findUnique: jest.fn(() => Promise.resolve(readBooking())),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(readBooking())), findMany: jest.fn(() => Promise.resolve([readBooking()])),
      update: write(({ data }: { data: ParentPatch }) => {
        const { bookingServices: nested, ...parentData } = data;
        Object.assign(booking, parentData);
        if (nested?.updateMany) {
          item.staffId = nested.updateMany.data.staffId;
          item.revision += nested.updateMany.data.revision.increment;
        }
        return readBooking();
      }),
      updateMany: write(({ where, data }: { where: { status?: string }; data: ParentPatch }) => {
        if (where.status && where.status !== booking.status) return { count: 0 };
        Object.assign(booking, data); return { count: 1 };
      }),
    },
    bookingService: {
      findFirst: jest.fn(({ where, select }: { where: { id?: string | { not: string } }; select?: { id?: boolean } }) => {
        if (typeof where.id === 'object' && where.id.not) return Promise.resolve(null);
        if (select?.id && !where.id) return Promise.resolve({ id: item.id });
        return Promise.resolve({ ...item, booking: readBooking() });
      }),
      findMany: jest.fn(() => Promise.resolve(booking.bookingServices)),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(item)), count: jest.fn().mockResolvedValue(1),
      create: write(({ data }: { data: Partial<typeof item> }) => { const added = { ...item, id: 'added', ...data }; booking.bookingServices.push(added); return added; }),
      update: write(({ data }: { data: ItemPatch }) => {
        const { revision, ...fields } = data; Object.assign(item, fields);
        if (revision) item.revision += revision.increment;
        return item;
      }),
      updateMany: write(({ where, data }: { where: { revision?: number }; data: ItemPatch }) => {
        if (where.revision && where.revision !== item.revision) return { count: 0 };
        if (data.status) item.status = data.status;
        if (data.staffId) item.staffId = data.staffId;
        if (data.revision?.increment) item.revision += data.revision.increment;
        if (data.priceAtBooking !== undefined) item.priceAtBooking = data.priceAtBooking;
        return { count: 1 };
      }),
    },
    branchServiceOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'service', price: 100, durationMinutes: 60,
      businessServiceId: 'business-service', businessService: { canonicalServiceId: 'canonical' } }) },
    cancellationPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
    staffProfile: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'staff' }) },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    bookingServiceAdjustment: { count: jest.fn().mockResolvedValue(0), create: write(() => ({ id: 'adjustment' })) },
    bookingStatusHistory: { create: write(() => ({ count: 1 })) }, auditLog: { create: write(() => ({ count: 1 })) },
    notificationOutbox: { createMany: write(() => ({ count: 1 })) },
    voucherRedemption: { updateMany: write(() => ({ count: 1 })) }, promotionRedemption: { updateMany: write(() => ({ count: 1 })) },
    priceAdjustment: { create: write(() => ({ count: 1 })), updateMany: write(() => ({ count: 1 })) },
    bookingViolationEvent: { findUnique: jest.fn().mockResolvedValue(null) },
    appointmentChangeRequest: {
      findUnique: jest.fn(() => Promise.resolve({ ...request, booking: readBooking() })), findFirst: jest.fn().mockResolvedValue(null),
      updateMany: write(({ data }: { data: Record<string, unknown> }) => { Object.assign(request, data); return { count: 1 }; }),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => {
    const savedBooking = { ...booking, bookingServices: [...booking.bookingServices] };
    const savedItem = { ...item };
    const savedRequest = { ...request };
    try { return await operation(tx); } catch (error) {
      Object.assign(booking, savedBooking); Object.assign(item, savedItem); Object.assign(request, savedRequest);
      throw error;
    }
  }) };
  const gateway = { notifyBookingUpdated: jest.fn() };
  const mail = { sendBookingConfirmation: jest.fn(), sendBookingCancellation: jest.fn() };
  const settings = { getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 24 }) };
  const bookings = new BookingsService(prisma as never, mail as never, gateway as never, settings as never, {} as never);
  const items = new BookingItemsService(prisma as never, gateway as never);
  const changes = new ChangeRequestsService(prisma as never, settings as never, bookings, gateway as never);
  const updateItem = (action: ItemInput['action'], overrides: Partial<ItemInput> = {}) => items.update('booking', 'item', 'actor', {
    action, reason: 'Điều chỉnh', expectedRevision: 1, staffId: 'staff', durationMinutes: 90, price: 120, ...overrides,
  });
  const run = (action: Action) => {
    switch (action) {
      case 'CONFIRM': return bookings.updateStatus('booking', 'CONFIRMED', 'actor', undefined, 'SALON', ['BUSINESS_OWNER']);
      case 'ADD': return items.add('booking', 'actor', { serviceId: 'service', reason: 'Bổ sung' });
      case 'REASSIGN': return updateItem('REASSIGN');
      case 'RESIZE_ITEM': return updateItem('RESIZE');
      case 'MOVE': return bookings.moveBooking('booking', request.proposedStartTime.toISOString(), request.proposedEndTime.toISOString(), 'staff', 'actor');
      case 'RESIZE_BOOKING': return bookings.resizeBooking('booking', '2026-10-15T03:30:00Z');
      case 'ASSIGN': return bookings.assignStaff('booking', 'staff', 'actor');
      case 'APPROVE_MOVE': request.requestType = 'RESCHEDULE'; return changes.approve('request', 'actor');
      case 'APPROVE_STAFF': request.requestType = 'STAFF_CHANGE'; return changes.approve('request', 'actor');
    }
  };
  const assertNoWrites = () => {
    for (const fn of writes) expect(fn).not.toHaveBeenCalled();
    expect(gateway.notifyBookingUpdated).not.toHaveBeenCalled();
    expect(mail.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(mail.sendBookingCancellation).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(notifyBookingBothParties).not.toHaveBeenCalled();
    expect(notifySalonMembers).not.toHaveBeenCalled();
    expect(booking.status).toBe('PENDING'); expect(request.status).toBe('PENDING');
    expect(booking.bookingServices).toHaveLength(1); expect(item.revision).toBe(1);
  };
  return { booking, item, request, prisma, tx, bookings, items, changes, run, updateItem, assertNoWrites,
    onLock: (callback: () => void) => { afterLock = callback; } };
}

describe('pending hold deadline through real booking services', () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(deadline.getTime() - 1);
    // Capacity checks are independent of the hold policy; no policy/transaction
    // or service method is mocked. Keep all status/actor/time rules real.
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertNoOverlap').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertCustomerNotDoubleBooked').mockResolvedValue(undefined);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test.each(actions)('%s succeeds one millisecond before the deadline', async (action) => {
    const f = fixture(); await expect(f.run(action)).resolves.toBeDefined();
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  test.each(actions.flatMap(action => [0, 1].map(offset => [action, offset] as const)))('%s rejects at deadline + %ims without any write or notification', async (action, offset) => {
    jest.setSystemTime(deadline.getTime() + offset);
    const f = fixture(); await expect(f.run(action)).rejects.toMatchObject({
      status: 409, response: expect.objectContaining({ code: 'PENDING_HOLD_EXPIRED', message: expect.stringContaining('đặt lại') as unknown }) as unknown,
    });
    f.assertNoWrites();
  });
  test.each(actions)('%s samples the clock after waiting for the parent lock', async (action) => {
    const f = fixture(); f.onLock(() => jest.setSystemTime(deadline));
    await expect(f.run(action)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PENDING_HOLD_EXPIRED' }) as unknown });
    expect(f.tx.$queryRaw).toHaveBeenCalled(); f.assertNoWrites();
  });
  test.each(actions)('%s uses the fresh deadline instead of the pretransaction booking', async (action) => {
    const f = fixture(); f.booking.pendingExpiresAt = new Date(deadline.getTime() + 1000);
    f.onLock(() => { f.booking.pendingExpiresAt = new Date(deadline.getTime() - 1); });
    await expect(f.run(action)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PENDING_HOLD_EXPIRED' }) as unknown });
    f.assertNoWrites();
  });
  test.each(actions.flatMap(action => [null, undefined].map(value => [action, value] as const)))('%s preserves legacy deadline %p', async (action, value) => {
    jest.setSystemTime(deadline.getTime() + 1);
    const f = fixture(); f.booking.pendingExpiresAt = value;
    await expect(f.run(action)).resolves.toBeDefined();
  });
  test.each(actions.filter(action => action !== 'CONFIRM'))('%s preserves a confirmed booking with an old hold timestamp', async (action) => {
    jest.setSystemTime(deadline.getTime() + 1);
    const f = fixture(); f.booking.status = 'CONFIRMED'; await expect(f.run(action)).resolves.toBeDefined();
  });
  test.each(['IN_PROGRESS', 'COMPLETED'])('expired pending parent with a current %s item is not blocked (UNKNOWN timing correction)', async status => {
    for (const action of ['CONFIRM', 'ADD', 'RESIZE_ITEM', 'RESIZE_BOOKING'] as const) {
      const f = fixture();
      // Resize the remaining scheduled item after a sibling has completed;
      // never fake the last-active-item query into returning a completed item.
      const executed = status === 'COMPLETED' ? { ...f.item, id: 'sibling', sortOrder: -1 } : f.item;
      executed.status = status;
      executed.actualTimeCorrections = [{ actualTimingStatus: 'UNKNOWN', actualStartedAt: null, actualCompletedAt: null, version: 1 }];
      if (status === 'COMPLETED') f.booking.bookingServices.unshift(executed);
      jest.setSystemTime(deadline.getTime() + 1);
      await expect(f.run(action)).resolves.toBeDefined();
    }
  });
  test('reassignment checks execution on a sibling, not only the target item', async () => {
    const f = fixture(); f.booking.bookingServices.push({ ...f.item, id: 'sibling', status: 'COMPLETED' });
    jest.setSystemTime(deadline.getTime() + 1); await expect(f.run('REASSIGN')).resolves.toBeDefined();
  });
  test('a planned interval in the past does not count as execution', async () => {
    const f = fixture(); f.item.itemStartAt = new Date('2026-10-12T02:00:00Z');
    jest.setSystemTime(deadline); await expect(f.run('ADD')).rejects.toMatchObject({ status: 409 }); f.assertNoWrites();
  });
  test('item expectedRevision still rejects stale callers before writes', async () => {
    const f = fixture(); await expect(f.updateItem('REASSIGN', { expectedRevision: 2 })).rejects.toThrow('vừa được');
    f.assertNoWrites();
  });
  test('item CAS remains scoped to the expected revision', async () => {
    const f = fixture(); await f.run('REASSIGN');
    expect(f.tx.bookingService.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'item', bookingId: 'booking', revision: 1 } }));
  });
  test('item CAS failure rolls back and emits no adjustment, outbox or schedule event', async () => {
    const f = fixture(); f.tx.bookingService.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(f.run('REASSIGN')).rejects.toThrow('vừa được chỉnh sửa');
    expect(f.item.revision).toBe(1);
    expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
    expect(f.tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
  test('approval request CAS remains pending on a failed claim and does not schedule anything', async () => {
    const f = fixture(); f.tx.appointmentChangeRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(f.run('APPROVE_STAFF')).rejects.toThrow('người khác');
    expect(f.request.status).toBe('PENDING'); expect(f.item.revision).toBe(1);
    expect(f.tx.booking.update).not.toHaveBeenCalled();
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
    expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
    expect(f.tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });
  test('expired parent rejection does not lazily expire a scheduling request even when both deadlines elapsed', async () => {
    const f = fixture(); f.request.expiresAt = deadline; jest.setSystemTime(deadline);
    await expect(f.run('APPROVE_STAFF')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PENDING_HOLD_EXPIRED' }) as unknown });
    f.assertNoWrites();
  });
  test('confirmation retains the existing status predicate in its atomic claim', async () => {
    const f = fixture(); await f.run('CONFIRM');
    expect(f.tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'booking', status: 'PENDING' } }));
    expect(f.tx.booking.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ pendingExpiresAt: true, bookingServices: { select: { status: true } } }) as unknown,
    }));
  });
  test('current execution first observed after the lock exempts an expired pending hold', async () => {
    const f = fixture(); f.onLock(() => { jest.setSystemTime(deadline); f.item.status = 'IN_PROGRESS'; });
    await expect(f.run('ADD')).resolves.toBeDefined();
  });
  test('stale execution in the pretransaction read cannot exempt the fresh unserved parent', async () => {
    const f = fixture(); f.item.status = 'IN_PROGRESS';
    f.onLock(() => { jest.setSystemTime(deadline); f.item.status = 'SCHEDULED'; });
    await expect(f.run('CONFIRM')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PENDING_HOLD_EXPIRED' }) as unknown });
    f.assertNoWrites();
  });
  test('bulk move retains its unstarted-items rule after the execution exception', async () => {
    const f = fixture(); f.item.status = 'IN_PROGRESS'; jest.setSystemTime(deadline);
    await expect(f.run('MOVE')).rejects.toThrow('bắt đầu'); f.assertNoWrites();
  });
  test('confirmation retains its status CAS and rejects concurrent status drift', async () => {
    const f = fixture(); f.onLock(() => { f.booking.status = 'CANCELLED'; });
    await expect(f.run('CONFIRM')).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test.each(['CANCELLED', 'REJECTED'])('expired pending hold still permits ordinary %s', async status => {
    const f = fixture(); jest.setSystemTime(deadline.getTime() + 1);
    await expect(f.bookings.updateStatus('booking', status, 'actor', undefined, 'SALON', ['BUSINESS_OWNER'])).resolves.toMatchObject({ status });
  });
  test('expired pending hold still permits a cancellation request approval', async () => {
    const f = fixture(); f.request.requestType = 'CANCEL'; jest.setSystemTime(deadline.getTime() + 1);
    await expect(f.changes.approve('request', 'actor')).resolves.toMatchObject({ status: 'CANCELLED' });
  });
  test.each(['REPRICE', 'SKIP', 'COMPLETE'] as const)('expired pending hold leaves ordinary item %s semantics intact', async action => {
    const f = fixture(); if (action === 'COMPLETE') f.item.status = 'IN_PROGRESS';
    jest.setSystemTime(deadline.getTime() + 1); await expect(f.updateItem(action)).resolves.toBeDefined();
    if (action === 'REPRICE') {
      expect(f.item.priceAtBooking).toBe(120); expect(f.booking.finalAmount).toBe(120);
      expect(f.tx.priceAdjustment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 20 }) as unknown }));
    }
  });
  test('START retains its check-in requirement rather than the scheduling hold guard', async () => {
    const f = fixture(); jest.setSystemTime(deadline.getTime() + 1);
    await expect(f.updateItem('START')).rejects.toThrow('check-in'); f.assertNoWrites();
  });
  test('normal START for a checked-in parent is unaffected by its old hold timestamp', async () => {
    const f = fixture(); f.booking.status = 'CHECKED_IN'; jest.setSystemTime(start);
    await expect(f.updateItem('START')).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(f.item.status).toBe('IN_PROGRESS');
  });
});
