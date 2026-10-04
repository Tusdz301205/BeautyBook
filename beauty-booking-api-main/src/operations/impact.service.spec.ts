import type { PrismaService } from '../prisma/prisma.service';
import { ImpactService } from './impact.service';
import { BadRequestException } from '@nestjs/common';

describe('ImpactService scoped listing', () => {
  it('does not expose business-wide or sibling-branch cases when a branch filter is supplied', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { operationalImpactCase: { findMany } } as unknown as PrismaService;
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never);

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
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as unknown as PrismaService;
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never);
    await expect((service as any).transferBranch(booking, 'branch-new', 'staff-other', 'actor-1', 'Điều chuyển'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
});
