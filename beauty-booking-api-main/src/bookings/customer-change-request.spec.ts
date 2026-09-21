import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { notifySalonMembers } from '../common/utils/notify';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';

jest.mock('../common/utils/notify', () => ({ notifySalonMembers: jest.fn(), notifyBookingBothParties: jest.fn() }));
const now = new Date('2026-09-20T03:00:00.000Z');

function fixture(options: { start?: Date; status?: string; customerUserId?: string; pending?: boolean } = {}) {
  const start = options.start ?? new Date(now.getTime() + 3_600_000);
  const booking = {
    id: 'booking-1', customerId: 'profile-1', status: options.status ?? 'CONFIRMED', deletedAt: null,
    customer: { userId: options.customerUserId ?? 'customer-1' },
    branch: { businessId: 'business-1' },
    ...normalizeAppointmentForStorage(start, new Date(start.getTime() + 3_600_000)),
  };
  const events: any[] = [];
  const policy = { id: 'policy', startsAt: null, endsAt: null, triggeredByViolationEventId: null };
  const tx: any = {
    customerBookingPolicy: { upsert: jest.fn().mockResolvedValue(policy), findUnique: jest.fn().mockResolvedValue(policy), findUniqueOrThrow: jest.fn().mockResolvedValue(policy) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'customer-1' }) },
    userRole: { findMany: jest.fn().mockResolvedValue([{ role: { code: 'CUSTOMER' } }]) },
    bookingViolationEvent: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn(async () => events), create: jest.fn(async ({ data }) => { const e = { id: 'event', ...data }; events.push(e); return e; }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    appointmentChangeRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(options.pending ? { id: 'old' } : null),
      create: jest.fn(async ({ data }) => ({ id: 'new-request', ...data, status: 'PENDING' })),
    },
  };
  let committed = false;
  const prisma: any = { $transaction: jest.fn(async (callback) => { const result = await callback(tx); committed = true; return result; }) };
  return { service: new ChangeRequestsService(prisma, {} as never, {} as never), tx, prisma, committed: () => committed };
}

describe('Customer cancellation request under booking lock', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); jest.mocked(notifySalonMembers).mockReset().mockResolvedValue(undefined); });
  afterEach(() => jest.useRealTimers());
  test('creates a pending request without cancelling and notifies scoped salon recipients in the same transaction', async () => {
    const { service, tx, prisma } = fixture();
    const result = await service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL', reason: 'Unable to attend' });
    expect(result).toMatchObject({ status: 'PENDING', requestType: 'CANCEL', requestedBy: 'customer-1', requestedByType: 'CUSTOMER', expiresAt: new Date(now.getTime() + 86_400_000) });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.booking.findUnique.mock.invocationCallOrder[0]);
    expect(tx.booking).not.toHaveProperty('update');
    expect(tx.bookingViolationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sourceRequestId: 'new-request', occurredAt: now, kind: 'LATE_CANCELLATION', customerId: 'profile-1',
      appointmentStartAt: new Date(now.getTime() + 3_600_000),
    }) });
    expect(notifySalonMembers).toHaveBeenCalledWith(tx, 'business-1', 'BOOKING_RESCHEDULE_REQUEST', 'Khách gửi yêu cầu hủy lịch', 'Unable to attend', 'booking-1');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  test.each(['CANCELLED', 'NO_SHOW', 'CHECKED_IN', 'COMPLETED'])('rejects a concurrently changed %s booking', async (status) => {
    const { service, tx } = fixture({ status });
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow(ConflictException);
    expect(tx.appointmentChangeRequest.create).not.toHaveBeenCalled();
  });
  test('cannot request cancellation of another customer booking through direct service invocation', async () => {
    const { service, tx } = fixture({ customerUserId: 'customer-2' });
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow(ForbiddenException);
    expect(tx.appointmentChangeRequest.create).not.toHaveBeenCalled();
  });
  test.each([0, -1])('cannot create a customer request at/past appointment start (%i ms)', async (offset) => {
    const { service, tx } = fixture({ start: new Date(now.getTime() + offset) });
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow(BadRequestException);
    expect(tx.appointmentChangeRequest.create).not.toHaveBeenCalled();
  });
  test('does not create a second pending request', async () => {
    const { service, tx } = fixture({ pending: true });
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow(ConflictException);
    expect(tx.appointmentChangeRequest.create).not.toHaveBeenCalled();
  });
  test('notification write failure prevents the request transaction from committing', async () => {
    jest.mocked(notifySalonMembers).mockRejectedValueOnce(new Error('notification unavailable'));
    const { service, committed } = fixture();
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow('notification unavailable');
    expect(committed()).toBe(false);
  });
  test('exactly four hours is not a late-cancellation event', async () => {
    const { service, tx } = fixture({ start: new Date(now.getTime() + 4 * 3_600_000) });
    await service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' });
    expect(tx.bookingViolationEvent.create).not.toHaveBeenCalled();
  });
  test('event failure prevents request transaction success', async () => {
    const { service, tx, committed } = fixture();
    tx.bookingViolationEvent.create.mockRejectedValue(new Error('event unavailable'));
    await expect(service.create('booking-1', 'customer-1', 'CUSTOMER', { requestType: 'CANCEL' })).rejects.toThrow('event unavailable');
    expect(committed()).toBe(false);
    expect(notifySalonMembers).not.toHaveBeenCalled();
  });
});
