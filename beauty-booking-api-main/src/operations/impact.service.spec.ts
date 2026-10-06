import type { PrismaService } from '../prisma/prisma.service';
import { ImpactService } from './impact.service';
import { BadRequestException } from '@nestjs/common';
import * as bookingValidation from '../bookings/bookings.validation';
import type { SchedulerGateway } from '../scheduler/scheduler.gateway';

type TransferSubject = { transferBranch(booking: unknown, branchId: string, staffId: string, actorId: string, reason: string): Promise<unknown> };

describe('ImpactService scoped listing', () => {
  it('does not expose business-wide or sibling-branch cases when a branch filter is supplied', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { operationalImpactCase: { findMany } } as unknown as PrismaService;
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never, {} as never);

    await service.list(['business-1'], ['branch-1']);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessId: { in: ['business-1'] },
        branchId: { in: ['branch-1'] },
      },
    }));
  });
});

describe('ImpactService branch transfer guard', () => {
  it('rejects a specialist from another branch before changing any booking item', async () => {
    const item = {
      id: 'item-1', bookingId: 'booking-1', businessServiceId: 'service-business-1',
      serviceNameSnapshot: 'Chăm sóc da', durationMinutes: 60, status: 'SCHEDULED', revision: 1,
      itemStartAt: null, itemEndAt: null,
    };
    const booking = {
      id: 'booking-1', branchId: 'branch-old', status: 'CONFIRMED', deletedAt: null,
      appointmentDate: new Date('2026-10-01T00:00:00.000Z'),
      appointmentStartTime: new Date('1970-01-01T09:00:00.000Z'),
      appointmentEndTime: new Date('1970-01-01T10:00:00.000Z'),
      updatedAt: new Date(), bookingServices: [item],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      booking: { findUnique: jest.fn().mockResolvedValue(booking), updateMany: jest.fn() },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-new', businessId: 'business-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'branch-old', businessId: 'business-1' }),
      },
      branchServiceOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'offering-new', durationMinutes: 60 }) },
      staffProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-other', branchId: 'branch-other', status: 'ACTIVE', isBookable: true, staffServices: [{ serviceId: 'offering-new' }] }) },
      bookingService: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) } as unknown as PrismaService;
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never, {} as never);
    await expect((service as unknown as TransferSubject).transferBranch(booking, 'branch-new', 'staff-other', 'actor-1', 'Điều chuyển'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe('ImpactService committed transfer invalidation', () => {
  afterEach(() => jest.restoreAllMocks());

  function setup() {
    jest.spyOn(bookingValidation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(bookingValidation, 'assertNoOverlap').mockResolvedValue(undefined);
    const item = { id: 'item', revision: 1, status: 'SCHEDULED', durationMinutes: 60, businessServiceId: 'catalog' };
    const original = {
      id: 'booking', branchId: 'old', status: 'CONFIRMED', deletedAt: null,
      appointmentDate: new Date('2026-11-01T00:00:00Z'),
      appointmentStartTime: new Date('1970-01-01T09:00:00Z'),
      appointmentEndTime: new Date('1970-01-01T10:00:00Z'),
      updatedAt: new Date('2026-10-04T00:00:00Z'), bookingServices: [item], customer: { userId: 'customer' },
    };
    const moved = { ...original, branchId: 'new', branch: { businessId: 'tenant' }, updatedAt: new Date('2026-10-04T00:01:00Z') };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      booking: { findUnique: jest.fn().mockResolvedValue(original), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(moved) },
      branch: { findFirst: jest.fn().mockResolvedValue({ businessId: 'tenant' }), findUniqueOrThrow: jest.fn().mockResolvedValue({ businessId: 'tenant' }) },
      branchServiceOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'offering', durationMinutes: 60 }) },
      bookingService: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    let committed = false;
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => { const result = await callback(tx); committed = true; return result; }) } as unknown as PrismaService;
    const scheduler = { notifyBookingUpdated: jest.fn((event: Parameters<SchedulerGateway['notifyBookingUpdated']>[0]) => { expect(event.id).toBe('booking'); expect(committed).toBe(true); }) };
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never, scheduler as never);
    return { service, original, moved, scheduler, prisma };
  }

  it('invalidates both branch audiences only after commit', async () => {
    const { service, original, moved, scheduler } = setup();
    await expect((service as unknown as TransferSubject).transferBranch(original, 'new', 'staff', 'actor', 'Transfer')).resolves.toEqual(moved);
    expect(scheduler.notifyBookingUpdated.mock.calls.map((call) => call[0].branchId)).toEqual(['old', 'new']);
    expect(scheduler.notifyBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({ customerUserId: 'customer', businessId: 'tenant' }));
  });

  it('keeps a committed transfer successful if realtime delivery fails', async () => {
    const { service, original, moved, scheduler } = setup();
    scheduler.notifyBookingUpdated.mockImplementation(() => { throw new Error('offline'); });
    await expect((service as unknown as TransferSubject).transferBranch(original, 'new', 'staff', 'actor', 'Transfer')).resolves.toEqual(moved);
    expect(scheduler.notifyBookingUpdated).toHaveBeenCalledTimes(2);
  });

  it('does not emit when the transaction rejects', async () => {
    const { service, original, scheduler, prisma } = setup();
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('transaction rejected'));
    await expect((service as unknown as TransferSubject).transferBranch(original, 'new', 'staff', 'actor', 'Transfer')).rejects.toThrow('transaction rejected');
    expect(scheduler.notifyBookingUpdated).not.toHaveBeenCalled();
  });
});
