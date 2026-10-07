import { BookingsService } from './bookings.service';
import { ConflictException } from '@nestjs/common';
import * as validation from './bookings.validation';
import { assertUnstartedBookingItems } from './booking-schedule-integrity';

describe('Bulk provider assignment preserves execution identity', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED'])('does not rewrite %s items on an operational parent', async status => {
    const prisma = { booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking', status: 'IN_PROGRESS', bookingServices: [{ id: 'item', status }] }) }, $transaction: jest.fn() };
    const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.assignStaff('booking', 'provider-new', 'owner')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(() => assertUnstartedBookingItems([{ status: 'SCHEDULED' }, { status }])).toThrow(ConflictException);
  });
  it('scheduled-only bulk changes increment revisions and atomically preserve old/new provider identity', async () => {
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertNoOverlap').mockResolvedValue(undefined);
    const item = { id: 'item', bookingId: 'booking', serviceId: 'service', status: 'SCHEDULED' as const, revision: 3, staffId: 'provider-old',
      itemStartAt: new Date('2099-01-01T01:00:00Z'), itemEndAt: new Date('2099-01-01T01:30:00Z'), durationMinutes: 30 };
    const booking = { id: 'booking', status: 'CONFIRMED' as const, appointmentDate: new Date('2099-01-01'), appointmentStartTime: new Date('1970-01-01T08:00:00Z'), appointmentEndTime: new Date('1970-01-01T08:30:00Z'), bookingServices: [item] };
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), booking: { findUnique: jest.fn().mockResolvedValue(booking), update: jest.fn().mockResolvedValue(booking) },
      staffProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'provider-old', userId: 'old-user' }, { id: 'provider-new', userId: 'new-user' }]) },
      bookingServiceAdjustment: { count: jest.fn().mockResolvedValue(2), create: jest.fn().mockResolvedValue({}) }, bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = { booking: { findUnique: jest.fn().mockResolvedValue(booking) }, $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) };
    const service = new BookingsService(prisma as never, {} as never, { notifyBookingUpdated: jest.fn() } as never, {} as never, {} as never);
    await service.assignStaff('booking', 'provider-new', 'owner');
    expect(tx.booking.update).toHaveBeenCalledWith(expect.objectContaining({ data: { bookingServices: { updateMany: {
      where: { bookingId: 'booking', status: 'SCHEDULED' }, data: { staffId: 'provider-new', revision: { increment: 1 } },
    } } } }));
    expect(tx.bookingServiceAdjustment.create).toHaveBeenCalledTimes(1);
    const assignment: unknown = (tx.bookingServiceAdjustment.create.mock.calls as readonly (readonly unknown[])[])[0][0];
    expect(assignment).toMatchObject({ data: { actorId: 'owner', action: 'REASSIGN', version: 3,
      beforeSnapshot: { status: 'SCHEDULED', staffId: 'provider-old', staffUserId: 'old-user', revision: 3 },
      afterSnapshot: { status: 'SCHEDULED', staffId: 'provider-new', staffUserId: 'new-user', revision: 4 }, amountDelta: 0 } });
    const history: unknown = (tx.bookingStatusHistory.create.mock.calls as readonly (readonly unknown[])[])[0][0];
    expect(history).toMatchObject({ data: { changedBy: 'owner' } });
  });
  it('a service that completes between initial read and locked reread is not reassigned', async () => {
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertNoOverlap').mockResolvedValue(undefined);
    const item = { id: 'item', serviceId: 'service', staffId: 'old', status: 'SCHEDULED', durationMinutes: 30,
      itemStartAt: new Date('2099-01-01T01:00:00Z'), itemEndAt: new Date('2099-01-01T01:30:00Z') };
    const row = { id: 'booking', status: 'CONFIRMED', branchId: 'branch', appointmentDate: new Date('2099-01-01'),
      appointmentStartTime: new Date('1970-01-01T08:00:00Z'), appointmentEndTime: new Date('1970-01-01T08:30:00Z'), bookingServices: [item] };
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), booking: { findUnique: jest.fn().mockResolvedValue({ ...row, bookingServices: [{ ...item, status: 'COMPLETED' }] }), update: jest.fn() } };
    const prisma = { booking: { findUnique: jest.fn().mockResolvedValue(row) }, $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) };
    const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.assignStaff('booking', 'new', 'owner')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
