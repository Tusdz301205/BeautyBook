import { ChangeRequestsService } from './change-requests.service';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';
import { notifyBookingBothParties } from '../common/utils/notify';
jest.mock('../common/utils/notify', () => ({ notifyBookingBothParties: jest.fn() }));
const requestedAt = new Date('2026-09-20T01:00:00Z');
const startAt = new Date('2026-09-20T03:00:00Z');

function fixture() {
  const event = { kind: 'LATE_CANCELLATION', occurredAt: requestedAt, appointmentStartAt: startAt, voidedAt: null };
  const booking = { id: 'booking', status: 'CONFIRMED', customerId: 'customer', branchId: 'branch',
    branch: { id: 'branch', businessId: 'business' }, bookingServices: [], voucherId: null, totalAmount: 100,
    ...normalizeAppointmentForStorage(startAt, new Date(startAt.getTime() + 3_600_000)) };
  const req = { id: 'request', bookingId: 'booking', requestType: 'CANCEL', requestedByType: 'CUSTOMER',
    status: 'PENDING', createdAt: requestedAt, expiresAt: new Date(requestedAt.getTime() + 86_400_000), booking, violationEvent: event };
  const tx: any = {
    $queryRaw: jest.fn(), appointmentChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    booking: { findUnique: jest.fn().mockResolvedValue(booking), update: jest.fn(async ({ data }) => ({ ...booking, ...data })) },
    bookingViolationEvent: { findUnique: jest.fn().mockResolvedValue(event), create: jest.fn(), updateMany: jest.fn() },
    bookingService: { updateMany: jest.fn() }, bookingStatusHistory: { create: jest.fn() },
  };
  const prisma: any = { appointmentChangeRequest: { findUnique: jest.fn().mockResolvedValue(req), updateMany: jest.fn() },
    $transaction: jest.fn(async callback => callback(tx)) };
  const service = new ChangeRequestsService(prisma, { getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 4 }) } as never,
    { releaseBookingBenefits: jest.fn() } as never);
  return { service, tx, req, event, booking };
}

describe('Late cancellation is classified at request time', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-20T12:00:00Z')); jest.clearAllMocks(); });
  afterEach(() => jest.useRealTimers());
  test('approves after start in the original 24h window, without recording points again', async () => {
    const { service, tx } = fixture();
    await expect(service.approve('request', 'owner')).resolves.toMatchObject({ status: 'CANCELLED', cancellationFeeAmount: null });
    expect(tx.bookingViolationEvent.create).not.toHaveBeenCalled();
    expect(tx.bookingViolationEvent.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingService.updateMany).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.appointmentChangeRequest.updateMany.mock.invocationCallOrder[0]);
  });
  test('a changed booking time cannot change the stored request-time classification', async () => {
    const { service, booking } = fixture();
    Object.assign(booking, normalizeAppointmentForStorage(new Date('2026-09-19T01:00:00Z'), new Date('2026-09-19T02:00:00Z')));
    await expect(service.approve('request', 'owner')).resolves.toMatchObject({ status: 'CANCELLED' });
  });
  test('exactly 24h expires processing, not the violation event', async () => {
    const { service, tx } = fixture();
    jest.setSystemTime(new Date(requestedAt.getTime() + 86_400_000));
    await expect(service.approve('request', 'owner')).rejects.toThrow('hết hạn');
    expect(tx.bookingViolationEvent.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
  test('a valid late request cannot be rejected', async () => {
    const { service, tx } = fixture();
    await expect(service.reject('request', 'owner', 'Keep the booking')).rejects.toThrow('Không được từ chối');
    expect(tx.appointmentChangeRequest.updateMany).not.toHaveBeenCalled();
    expect(notifyBookingBothParties).not.toHaveBeenCalled();
  });
  test('voided request cannot be approved', async () => {
    const { service, event, tx } = fixture();
    (event as any).voidedAt = new Date();
    await expect(service.approve('request', 'owner')).rejects.toThrow('không hợp lệ');
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
  test('duplicate approval loses request claim before any second status write', async () => {
    const { service, tx } = fixture();
    tx.appointmentChangeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve('request', 'owner')).rejects.toThrow('người khác');
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.bookingViolationEvent.create).not.toHaveBeenCalled();
  });
});
