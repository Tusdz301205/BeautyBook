import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { assertActorStatusTransition, evaluateTimeAllowedForStatusTransition } from './bookings.validation';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';
import { UpdateStatusDto } from './dto/bookings.dto';
import { validate } from 'class-validator';

jest.mock('../common/utils/notify', () => ({ notifyBookingBothParties: jest.fn() }));
const start = new Date('2026-09-20T03:00:00Z');
const end = new Date('2026-09-20T04:00:00Z');

function fixture() {
  let booking: any = {
    id: 'booking', customerId: 'profile', status: 'CONFIRMED', deletedAt: null, voucherId: null,
    ...normalizeAppointmentForStorage(start, end),
    bookingServices: [{ status: 'SCHEDULED', comboId: null }],
    customer: { user: null }, branch: { businessId: 'business', business: { name: 'Salon' } },
  };
  const events: any[] = [];
  const policy = { id: 'policy', startsAt: null, endsAt: null, triggeredByViolationEventId: null };
  const tx: any = {
    customerBookingPolicy: { upsert: jest.fn().mockResolvedValue(policy), findUnique: jest.fn().mockResolvedValue(policy), findUniqueOrThrow: jest.fn().mockResolvedValue(policy) },
    business: { findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Test business' }) },
    notification: { create: jest.fn() },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'customer' }) },
    userRole: { findMany: jest.fn().mockResolvedValue([{ role: { code: 'CUSTOMER' } }]) },
    bookingViolationEvent: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn(async () => events), create: jest.fn(async ({ data }) => { const e = { id: 'event', ...data }; events.push(e); return e; }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    booking: {
      findUnique: jest.fn(async () => ({ ...booking })),
      updateMany: jest.fn(async ({ data }) => { booking = { ...booking, ...data }; return { count: 1 }; }),
    },
    appointmentChangeRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    bookingStatusHistory: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    bookingService: { updateMany: jest.fn() }, auditLog: { create: jest.fn() },
  };
  const prisma: any = {
    booking: { findUnique: jest.fn(async () => ({ ...booking })) },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  const service = new BookingsService(prisma, {} as any, { notifyBookingUpdated: jest.fn() } as any,
    {} as any, {} as any, {} as any);
  return { tx, service, booking, prisma };
}

describe('No-show policy and evidence', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(start.getTime() + 15 * 60_000 + 1)); });
  afterEach(() => jest.useRealTimers());

  test.each(['BUSINESS_OWNER', 'RECEPTIONIST'])('%s records absence and atomic evidence', async (role) => {
    const { service, tx } = fixture();
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', [role], true))
      .resolves.toMatchObject({ status: 'NO_SHOW' });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.appointmentChangeRequest.findFirst.mock.invocationCallOrder[0]);
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'actor', entityId: 'booking', newData: expect.objectContaining({ noShowConfirmed: true, graceMinutes: 15 }),
    }) });
    expect(tx.bookingService.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledTimes(1);
  });
  test.each([['STAFF'], ['CUSTOMER'], ['PLATFORM_ADMIN'], ['PLATFORM_ADMIN', 'BUSINESS_OWNER'], ['CUSTOMER', 'RECEPTIONIST'], []])
  ('rejects roles %j even with confirmation', async (...roles) => {
    const { service, tx } = fixture();
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', roles, true))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test.each([undefined, false])('requires explicit confirmation (%s)', async (confirmed) => {
    const { service, tx } = fixture();
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], confirmed))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test.each([-1, 0, 1])('strict fifteen-minute boundary: offset %i', (offset) => {
    expect(evaluateTimeAllowedForStatusTransition({ fromStatus: 'CONFIRMED', toStatus: 'NO_SHOW',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date(start.getTime() + 15 * 60_000 + offset), noShowGraceMinutes: 0,
    }).allowed).toBe(offset > 0);
  });
  test('missing/invalid timestamps cannot authorize absence', () => {
    expect(evaluateTimeAllowedForStatusTransition({ fromStatus: 'CONFIRMED', toStatus: 'NO_SHOW',
      appointmentStartTime: new Date('invalid'), appointmentEndTime: end }).allowed).toBe(false);
  });
  test.each(['PENDING', 'REJECTED', 'EXPIRED', 'APPROVED'])('any recorded cancellation request prevents no-show (%s)', async (status) => {
    const { service, tx } = fixture();
    tx.appointmentChangeRequest.findFirst.mockResolvedValue({ id: 'request', status });
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['RECEPTIONIST'], true))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.appointmentChangeRequest.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ bookingId: 'booking', requestType: 'CANCEL',
      OR: [{ violationEvent: { is: null } }, { violationEvent: { is: { voidedAt: null } } }] }), select: { id: true } });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('revalidates time after a concurrent reschedule', async () => {
    const { service, tx, booking } = fixture();
    tx.booking.findUnique.mockResolvedValue({ ...booking, ...normalizeAppointmentForStorage(end, new Date(end.getTime() + 3_600_000)) });
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], true))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test.each(['CHECKED_IN', 'CANCELLED', 'NO_SHOW'])('concurrent status %s aborts operation', async (status) => {
    const { service, tx, booking } = fixture();
    tx.booking.findUnique.mockResolvedValue({ ...booking, status });
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], true))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('arrival history blocks absence even if current status is inconsistent', async () => {
    const { service, tx } = fixture();
    tx.bookingStatusHistory.findFirst.mockResolvedValue({ id: 'arrival' });
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], true))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test.each(['IN_PROGRESS', 'COMPLETED'])('service status %s proves customer attendance', async (status) => {
    const { service, tx, booking } = fixture();
    booking.bookingServices = [{ status }];
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], true))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('audit failure aborts the status change', async () => {
    const { service, tx } = fixture();
    tx.auditLog.create.mockRejectedValue(new Error('evidence unavailable'));
    await expect(service.updateStatus('booking', 'NO_SHOW', 'actor', undefined, 'SALON', ['BUSINESS_OWNER'], true))
      .rejects.toThrow('evidence unavailable');
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
  test('confirmation DTO rejects a string boolean', async () => {
    expect(await validate(Object.assign(new UpdateStatusDto(), { status: 'NO_SHOW', noShowConfirmed: 'true' })))
      .toEqual(expect.arrayContaining([expect.objectContaining({ property: 'noShowConfirmed' })]));
  });
  test('service-state rules still reject checked-in customers', () => {
    expect(() => assertActorStatusTransition(['RECEPTIONIST'], 'CHECKED_IN', 'NO_SHOW')).toThrow();
  });
});
