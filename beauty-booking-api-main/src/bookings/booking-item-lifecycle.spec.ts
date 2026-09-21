import { BookingsService } from './bookings.service';
import { cancelUnfinishedBookingItems } from './booking-item-lifecycle';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn().mockResolvedValue(undefined),
  notifyBookingCustomer: jest.fn().mockResolvedValue(undefined),
  notifySalonMembers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../common/utils/audit', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../common/utils/policy', () => ({
  resolveCancellationPolicy: jest.fn().mockResolvedValue({ policy: 'allowed' }),
}));

function fixture(status = 'PENDING') {
  let items = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'].map((itemStatus, index) => ({
    id: `item-${index}`, bookingId: 'booking-1', status: itemStatus, revision: 3,
    serviceNameSnapshot: `Service ${index}`, priceAtBooking: 100,
  }));
  let booking: any = {
    id: 'booking-1', bookingCode: 'BB-TEST', status, voucherId: null,
    appointmentDate: new Date('2026-09-09T00:00:00.000Z'),
    appointmentStartTime: new Date('1970-01-01T09:00:00.000Z'),
    appointmentEndTime: new Date('1970-01-01T10:00:00.000Z'),
    totalAmount: 500, finalAmount: 500, customer: { user: null },
    branch: { id: 'branch-1', businessId: 'business-1', business: { name: 'Salon' } },
  };
  const snapshot = () => ({ ...booking, bookingServices: items.map((item) => ({ ...item })) });
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: {
      updateMany: jest.fn(async ({ data }) => { booking = { ...booking, ...data }; return { count: 1 }; }),
      findUnique: jest.fn(async () => snapshot()),
      findMany: jest.fn(async () => [snapshot()]),
    },
    bookingService: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        items = items.map((item) => {
          if (item.bookingId !== where.bookingId || !where.status.in.includes(item.status)) return item;
          count += 1;
          return { ...item, status: data.status, revision: item.revision + data.revision.increment };
        });
        return { count };
      }),
    },
    bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    recurringBookingPlan: { update: jest.fn().mockResolvedValue({}) },
    promotionRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    priceAdjustment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma: any = {
    booking: { findUnique: jest.fn(async () => snapshot()), findMany: jest.fn(async () => [snapshot()]) },
    // Transaction-scoped delegate is deliberately separate from the root delegate.
    bookingService: { updateMany: jest.fn() },
    $transaction: jest.fn(async (operation) => {
      const previousBooking = { ...booking };
      const previousItems = items.map((item) => ({ ...item }));
      try { return await operation(tx); }
      catch (error) { booking = previousBooking; items = previousItems; throw error; }
    }),
  };
  const service = new BookingsService(
    prisma,
    { sendBookingCancellation: jest.fn() } as never,
    { notifyBookingUpdated: jest.fn() } as never,
    { getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 24 }) } as never,
    {} as never,
    { reverseRedemptionForBooking: jest.fn() } as never,
  );
  return { service, tx, prisma, snapshot };
}

describe('Terminal booking item lifecycle', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-08T10:00:00Z')); });
  afterEach(() => jest.useRealTimers());

  test.each(['CANCELLED', 'REJECTED', 'EXPIRED'])(
    '%s closes only unfinished items and returns the synchronized state', async (status) => {
      const { service, tx, prisma, snapshot } = fixture(status === 'NO_SHOW' ? 'CONFIRMED' : 'PENDING');
      if (status === 'NO_SHOW') jest.setSystemTime(new Date('2026-09-10T10:00:00Z'));
      const before = snapshot().bookingServices;
      const result = await service.updateStatus('booking-1', status, 'admin-1', 'Test', 'ADMIN', ['PLATFORM_ADMIN']);
      expect(result.bookingServices.map((item) => item.status)).toEqual([
        'CANCELLED', 'CANCELLED', 'COMPLETED', 'SKIPPED', 'CANCELLED',
      ]);
      expect(result.bookingServices.map((item) => item.revision)).toEqual([4, 4, 3, 3, 3]);
      expect(result.bookingServices.slice(2)).toEqual(before.slice(2));
      expect(result.totalAmount).toBe(500);
      expect(tx.bookingService.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.bookingService.updateMany).not.toHaveBeenCalled();
    },
  );

  test('child-update failure rolls back the parent and its history', async () => {
    const { service, tx, snapshot } = fixture();
    tx.bookingService.updateMany.mockRejectedValueOnce(new Error('write failed'));
    await expect(service.updateStatus('booking-1', 'REJECTED', 'admin-1', undefined, 'ADMIN', ['PLATFORM_ADMIN']))
      .rejects.toThrow('write failed');
    expect(snapshot().status).toBe('PENDING');
    expect(snapshot().bookingServices[0].status).toBe('SCHEDULED');
    expect(tx.bookingStatusHistory.create).not.toHaveBeenCalled();
  });

  test('a lost parent compare-and-set never cancels items', async () => {
    const { service, tx } = fixture();
    tx.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateStatus('booking-1', 'REJECTED', 'admin-1', undefined, 'ADMIN', ['PLATFORM_ADMIN']))
      .rejects.toThrow('vừa thay đổi');
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
  });

  test.each(['expire', 'compensate', 'cancel-series'])(
    '%s uses the same transactional cascade', async (path) => {
      const { service, snapshot, tx } = fixture();
      if (path === 'expire') await service.expirePendingHolds();
      else if (path === 'compensate') await service.compensateCreatedBookings(['booking-1'], 'Saga failed');
      else await service.cancelRecurringPlanOccurrences('plan-1', ['booking-1'], 'customer-1', 'Cancel series');
      expect(snapshot().bookingServices.map((item) => item.status)).toEqual([
        'CANCELLED', 'CANCELLED', 'COMPLETED', 'SKIPPED', 'CANCELLED',
      ]);
      expect(tx.bookingService.updateMany).toHaveBeenCalledTimes(1);
    },
  );

  test('cascade is idempotent for already terminal items', async () => {
    const { tx, snapshot } = fixture();
    await expect(cancelUnfinishedBookingItems(tx, 'booking-1')).resolves.toEqual({ count: 2 });
    await expect(cancelUnfinishedBookingItems(tx, 'booking-1')).resolves.toEqual({ count: 0 });
    expect(snapshot().bookingServices.map((item) => item.revision)).toEqual([4, 4, 3, 3, 3]);
  });
});
