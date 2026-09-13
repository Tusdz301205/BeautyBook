import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { StaffService } from './staff.service';

describe('StaffService provider management', () => {
  it('deactivates staff without deleting the manageable profile', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'staff-1', status: 'INACTIVE', deletedAt: null,
    });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      staffProfile: { update },
      userRole: { deleteMany },
      userSession: { updateMany },
      staffBranchAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      staffInvitation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'staff-1', userId: 'user-1', branchId: 'branch-1',
          branch: { businessId: 'business-1' },
        }),
      },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await new StaffService(prisma, {} as never).deactivate(
      'staff-1', { reason: 'Đã nghỉ việc' }, 'owner-1',
    );

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        status: 'INACTIVE', isBookable: false, publicVisible: false, deletedAt: null,
      }),
    }));
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', businessId: 'business-1' }),
    }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1', workspace: 'SALON', businessId: 'business-1',
      }),
    }));
  });

  it('rejects a service that is not active at the provider branch', async () => {
    const transaction = jest.fn();
    const prisma = {
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', branchId: 'branch-a' }),
      },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new StaffService(prisma, {} as never)
        .assignServices('staff-1', ['service-other-branch']),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('upserts a branch-wide special opening', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'special-1' });
    const prisma = { specialWorkingDay: { upsert } } as unknown as PrismaService;

    await new StaffService(prisma, {} as never).createSpecialDay('branch-a', {
      date: '2026-08-01', startTime: '09:00', endTime: '17:00',
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        branchId_date: { branchId: 'branch-a', date: new Date('2026-08-01') },
      },
      create: expect.not.objectContaining({ staffId: expect.anything() }),
    }));
  });

  it('rejects an invalid special opening interval', async () => {
    const upsert = jest.fn();
    const prisma = { specialWorkingDay: { upsert } } as unknown as PrismaService;

    await expect(
      new StaffService(prisma, {} as never).createSpecialDay('branch-a', {
        date: '2026-08-01', startTime: '17:00', endTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});

