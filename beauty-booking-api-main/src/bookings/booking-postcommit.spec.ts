import { BookingsService } from './bookings.service';
import { BookingItemsService } from './booking-items.service';
import { notifyBookingBothParties } from '../common/utils/notify';
import { resolveRescheduleCutoffHours } from '../common/utils/policy';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn().mockResolvedValue(undefined),
  notifyBookingCustomer: jest.fn().mockResolvedValue(undefined),
  notifySalonMembers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../common/utils/audit', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../common/utils/policy', () => ({ resolveRescheduleCutoffHours: jest.fn().mockResolvedValue(1) }));

function fixture() {
  let committed = false;
  const row = { id: 'booking', bookingCode: 'BB', status: 'PENDING', voucherId: null,
    branchId: 'branch', customerId: 'customer', appointmentDate: new Date('2099-01-03T00:00:00Z'),
    appointmentStartTime: new Date('1970-01-01T09:00:00Z'), appointmentEndTime: new Date('1970-01-01T10:00:00Z'),
    customer: { user: { id: 'customer-user', email: 'customer@example.test' } },
    branch: { businessId: 'business' }, bookingServices: [], totalAmount: 100 };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: {
      findMany: jest.fn(() => Promise.resolve([{ ...row }])), findUnique: jest.fn(() => Promise.resolve({ ...row })),
      updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => { Object.assign(row, data); return Promise.resolve({ count: 1 }); }),
      findFirst: jest.fn(), update: jest.fn(),
    },
    bookingService: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst: jest.fn(), count: jest.fn(),
      findUniqueOrThrow: jest.fn(), create: jest.fn() },
    branchServiceOffering: { findFirst: jest.fn() },
    bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    recurringBookingPlan: { update: jest.fn().mockResolvedValue({}) },
    voucherRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    promotionRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    priceAdjustment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    booking: { findUnique: jest.fn(() => Promise.resolve({ ...row })), findMany: jest.fn(() => Promise.resolve([{ ...row }])), findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => { const result = await fn(tx); committed = true; return result; }),
  };
  const commitStates: boolean[] = [];
  const gateway = { notifyBookingUpdated: jest.fn(() => { commitStates.push(committed); }) };
  const mail = { sendBookingConfirmation: jest.fn().mockResolvedValue(undefined), sendBookingCancellation: jest.fn() };
  const service = new BookingsService(prisma as never, mail as never, gateway as never, {} as never, {} as never);
  return { row, tx, prisma, gateway, service, mail, commitStates };
}

describe('Committed booking changes always invalidate subscribers', () => {
  beforeEach(() => { jest.mocked(notifyBookingBothParties).mockReset().mockResolvedValue(undefined); });
  test.each(['expire', 'compensate', 'cancel-series'])( '%s emits only after successful commit', async (path) => {
    const f = fixture();
    if (path === 'expire') await f.service.expirePendingHolds();
    if (path === 'compensate') await f.service.compensateCreatedBookings(['booking'], 'Test');
    if (path === 'cancel-series') await f.service.cancelRecurringPlanOccurrences('plan', ['booking'], 'actor', 'Test');
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'booking' }));
    expect(f.commitStates).toEqual([true]);
  });
  test('expiration losing its claim emits no event', async () => {
    const f = fixture(); f.tx.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await f.service.expirePendingHolds()).toBe(0);
    expect(f.gateway.notifyBookingUpdated).not.toHaveBeenCalled();
  });
  test('rollback emits no compensation event', async () => {
    const f = fixture(); f.tx.bookingService.updateMany.mockRejectedValueOnce(new Error('rollback'));
    await expect(f.service.compensateCreatedBookings(['booking'], 'Test')).rejects.toThrow('rollback');
    expect(f.gateway.notifyBookingUpdated).not.toHaveBeenCalled();
  });
  test.each(['mail', 'in-app'])('%s failure preserves committed status and invalidation', async (channel) => {
    const f = fixture();
    if (channel === 'mail') f.mail.sendBookingConfirmation.mockRejectedValueOnce(new Error('mail outage'));
    else jest.mocked(notifyBookingBothParties).mockRejectedValueOnce(new Error('notification outage'));
    await expect(f.service.updateStatus('booking', 'CONFIRMED', 'actor', undefined, 'SALON', ['BUSINESS_OWNER']))
      .resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
  });
  test('failed series notification still emits and returns committed count', async () => {
    const f = fixture(); jest.mocked(notifyBookingBothParties).mockRejectedValueOnce(new Error('outage'));
    await expect(f.service.cancelRecurringPlanOccurrences('plan', ['booking'], 'actor', 'Test')).resolves.toBe(1);
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
  });
  test('emitter failure does not turn a committed status into an API failure', async () => {
    const f = fixture(); f.gateway.notifyBookingUpdated.mockImplementationOnce(() => { throw new Error('socket outage'); });
    await expect(f.service.updateStatus('booking', 'CONFIRMED', 'actor', undefined, 'SALON', ['BUSINESS_OWNER']))
      .resolves.toMatchObject({ status: 'CONFIRMED' });
  });
  test('completion still rejects a fee failure, but emits the already committed booking', async () => {
    const f = fixture(); f.row.status = 'IN_PROGRESS'; f.row.appointmentDate = new Date('2020-01-03T00:00:00Z');
    const payments = { ensurePlatformFee: jest.fn().mockRejectedValue(new Error('fee failed')), redeemPackageEntitlements: jest.fn() };
    const service = new BookingsService(f.prisma as never, f.mail as never, f.gateway as never, {} as never, {} as never, payments as never);
    await expect(service.updateStatus('booking', 'COMPLETED', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'])).rejects.toThrow('fee failed');
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(f.commitStates).toEqual([true]);
    expect(payments.ensurePlatformFee).toHaveBeenCalledTimes(1);
  });
  test('move notification failure preserves the committed move and emits', async () => {
    const f = fixture();
    f.prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    f.tx.booking.findFirst.mockResolvedValue(null);
    f.tx.booking.update.mockResolvedValue(f.row);
    jest.mocked(notifyBookingBothParties).mockRejectedValueOnce(new Error('notification outage'));
    await expect(f.service.moveBooking('booking', '2099-01-04T02:00:00Z', '2099-01-04T03:00:00Z', 'staff')).resolves.toMatchObject({ id: 'booking' });
    expect(resolveRescheduleCutoffHours).toHaveBeenCalled();
    expect(f.gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1); expect(f.commitStates).toEqual([true]);
  });
  test.each(['START', 'COMPLETE', 'SKIP', 'RESIZE', 'REPRICE', 'REMOVE', 'ADD'])(
    'item %s emits once after commit even if the emitter throws', async (action) => {
      const f = fixture();
      let committed = false;
      f.prisma.$transaction.mockImplementation(async (fn) => { const result = await fn(f.tx); committed = true; return result; });
      const commitStates: boolean[] = [];
      const gateway = { notifyBookingUpdated: jest.fn(() => { commitStates.push(committed); throw new Error('socket outage'); }) };
      const service = new BookingItemsService(f.prisma as never, gateway as never);
      const item = { id: 'item', bookingId: 'booking', staffId: null, revision: 1, priceAtBooking: 100,
        itemStartAt: new Date('2099-01-03T09:00:00Z'), durationMinutes: 30,
        status: action === 'COMPLETE' ? 'IN_PROGRESS' : 'SCHEDULED', booking: { ...f.row, status: 'CHECKED_IN' } };
      f.tx.bookingService.findFirst = jest.fn().mockResolvedValue(item);
      f.tx.bookingService.count = jest.fn().mockResolvedValue(1);
      f.tx.bookingService.updateMany.mockResolvedValue({ count: 1 });
      f.tx.bookingService.findUniqueOrThrow = jest.fn().mockResolvedValue({ ...item, revision: 2 });
      f.tx.booking.findFirst = jest.fn().mockResolvedValue({ ...f.row, bookingServices: [] });
      f.tx.booking.update = jest.fn().mockResolvedValue({});
      f.tx.branchServiceOffering = { findFirst: jest.fn().mockResolvedValue({ id: 'service', durationMinutes: 30, price: 100,
        businessService: { canonicalServiceId: 'canonical' } }) };
      f.tx.bookingService.create = jest.fn().mockResolvedValue(item);
      jest.spyOn(service as any, 'recordAdjustment').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'applyAmountDelta').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'detail').mockResolvedValue({ id: 'booking' });
      // Scheduling validation belongs to its own overlap suite; test lifecycle
      // postcommit dispatch directly with no resource assigned.
      if (action === 'RESIZE') f.tx.bookingService.findFirst.mockResolvedValueOnce(item).mockResolvedValueOnce({ id: 'item' });
      const result = action === 'ADD' ? await service.add('booking', 'actor', { serviceId: 'service', reason: 'Test' })
        : await service.update('booking', 'item', 'actor', { action: action as never, expectedRevision: 1, reason: 'Test', durationMinutes: 40, price: 100 });
      expect(result).toEqual({ id: 'booking' });
      expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
      expect(commitStates).toEqual([true]);
    },
  );
});
