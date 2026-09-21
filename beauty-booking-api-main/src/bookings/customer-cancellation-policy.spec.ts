import { BadRequestException } from '@nestjs/common';
import { assertCustomerDirectCancellation, customerCancellationMode } from './customer-cancellation-policy';
import { resolveCancellationPolicy } from '../common/utils/policy';
import { BookingsService } from './bookings.service';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn(), notifyBookingCustomer: jest.fn(), notifySalonMembers: jest.fn(),
}));
jest.mock('../common/utils/audit', () => ({ auditLog: jest.fn() }));

const now = new Date('2026-09-20T03:00:00.000Z');
const startAfter = (ms: number) => new Date(now.getTime() + ms);
const fourHours = 4 * 3_600_000;

function fixture(start: Date, lockedStart = start) {
  const initial = {
    id: 'booking-1', status: 'CONFIRMED', voucherId: null, totalAmount: 100,
    ...normalizeAppointmentForStorage(start, new Date(start.getTime() + 3_600_000)),
    branch: { businessId: 'business-1', business: { name: 'Salon' } },
    bookingServices: [{ status: 'SCHEDULED', comboId: null }], customer: { user: null },
  };
  let state = { ...initial, ...normalizeAppointmentForStorage(lockedStart, new Date(lockedStart.getTime() + 3_600_000)) };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: {
      findUnique: jest.fn(async () => ({ ...state })),
      findMany: jest.fn(async () => [{ ...state }]),
      updateMany: jest.fn(async ({ data }) => { state = { ...state, ...data }; return { count: 1 }; }),
    },
    bookingService: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    promotionRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    priceAdjustment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    recurringBookingPlan: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    booking: { findUnique: jest.fn().mockResolvedValue(initial) },
    $transaction: jest.fn(async (operation) => operation(tx)),
  };
  const service = new BookingsService(prisma, {} as any,
    { notifyBookingUpdated: jest.fn() } as any,
    { getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 0 }) } as any,
    {} as any, { reverseRedemptionForBooking: jest.fn() } as any);
  return { service, tx, prisma };
}

describe('Fixed four-hour customer cancellation', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => jest.useRealTimers());

  test.each([fourHours, fourHours + 1, 24 * 3_600_000])('allows %i ms before start', (remaining) => {
    expect(customerCancellationMode(startAfter(remaining), now)).toBe('allowed');
    expect(() => assertCustomerDirectCancellation(startAfter(remaining), now)).not.toThrow();
  });
  test.each([fourHours - 1, 3_600_000, 1, 0, -1])('rejects %i ms before start', (remaining) => {
    expect(() => assertCustomerDirectCancellation(startAfter(remaining), now)).toThrow(BadRequestException);
  });
  test('invalid timestamps fail closed', () => {
    expect(() => assertCustomerDirectCancellation(new Date('invalid'), now)).toThrow(BadRequestException);
  });
  test('legacy business/platform cutoff does not override four hours or introduce fees', async () => {
    const prisma: any = { cancellationPolicy: { findUnique: jest.fn().mockResolvedValue({ freeCancelHours: 0, lateCancelFeePercent: 80 }) } };
    expect(await resolveCancellationPolicy(prisma, 'business-1', 1000, startAfter(fourHours - 1), now, 0))
      .toMatchObject({ policy: 'warn_late_cancel', feeAmount: 0, feePercent: 0 });
    expect(await resolveCancellationPolicy(prisma, 'business-1', 1000, startAfter(fourHours), now, 24))
      .toMatchObject({ policy: 'allowed', feeAmount: 0, feePercent: 0 });
    expect(prisma.cancellationPolicy.findUnique).not.toHaveBeenCalled();
  });
  test('service cancels exactly four hours before start and releases items', async () => {
    const { service, tx } = fixture(startAfter(fourHours));
    expect(await service.updateStatus('booking-1', 'CANCELLED', 'customer-1', 'Reason', 'CUSTOMER', ['CUSTOMER']))
      .toMatchObject({ status: 'CANCELLED', cancelledByType: 'CUSTOMER', cancellationFeeAmount: null });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.bookingService.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledTimes(1);
  });
  test('service refuses late direct cancellation before any write', async () => {
    const { service, tx } = fixture(startAfter(fourHours - 1));
    await expect(service.updateStatus('booking-1', 'CANCELLED', 'customer-1', 'Reason', 'CUSTOMER', ['CUSTOMER']))
      .rejects.toThrow(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('changing the actor type cannot bypass the customer role cutoff', async () => {
    const { service, tx } = fixture(startAfter(fourHours - 1));
    await expect(service.updateStatus('booking-1', 'CANCELLED', 'customer-1', 'Reason', 'SALON', ['CUSTOMER']))
      .rejects.toThrow(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('a reschedule between initial read and transaction is revalidated under lock', async () => {
    const { service, tx } = fixture(startAfter(fourHours + 1), startAfter(fourHours - 1));
    await expect(service.updateStatus('booking-1', 'CANCELLED', 'customer-1', 'Reason', 'CUSTOMER', ['CUSTOMER']))
      .rejects.toThrow(BadRequestException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('recurring cancellation cannot bypass the cutoff', async () => {
    const { service, tx } = fixture(startAfter(fourHours - 1));
    await expect(service.cancelRecurringPlanOccurrences('plan-1', ['booking-1'], 'customer-1', 'Reason'))
      .rejects.toThrow(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.recurringBookingPlan.update).not.toHaveBeenCalled();
  });
});
