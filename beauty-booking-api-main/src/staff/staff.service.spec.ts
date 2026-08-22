import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { StaffService } from './staff.service';

describe('StaffService schedule validation', () => {
  it('deactivates staff without setting deletedAt so the profile remains manageable', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'staff-1', status: 'INACTIVE', deletedAt: null });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const revokeAllForUser = jest.fn().mockResolvedValue(undefined);
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
          id: 'staff-1',
          userId: 'user-1',
          branchId: 'branch-1',
          branch: { businessId: 'business-1' },
        }),
      },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await new StaffService(prisma, { revokeAllForUser } as never).deactivate('staff-1', { reason: 'Đã nghỉ việc' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        status: 'INACTIVE',
        isBookable: false,
        publicVisible: false,
        deletedAt: null,
      }),
    }));
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', businessId: 'business-1' }),
    }));
    expect(updateMany).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', workspace: 'SALON', businessId: 'business-1' }),
    }));
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it('rejects assigning a service that is not active at the staff branch before replacing skills', async () => {
    const transaction = jest.fn();
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', branchId: 'branch-a' }) },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(new StaffService(prisma, {} as never).assignServices('staff-1', ['service-other-branch']))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects overlapping breaks before changing stored data', async () => {
    const transaction = jest.fn();
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new StaffService(prisma, {} as never);

    await expect(service.replaceBreaks('staff-1', [
      { dayOfWeek: 1, startTime: '12:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '12:30', endTime: '13:30' },
    ])).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects special hours for staff from another branch', async () => {
    const create = jest.fn();
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue({ branchId: 'branch-b' }) },
      specialWorkingDay: { create },
    } as unknown as PrismaService;
    const service = new StaffService(prisma, {} as never);

    await expect(service.createSpecialDay('branch-a', {
      staffId: 'staff-b', date: '2026-08-01', startTime: '09:00', endTime: '17:00',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an overlapping leave request', async () => {
    const create = jest.fn();
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) },
      staffLeave: {
        findFirst: jest.fn().mockResolvedValue({ id: 'leave-existing' }),
        create,
      },
    } as unknown as PrismaService;
    const service = new StaffService(prisma, {} as never);

    await expect(service.requestLeave('staff-1', {
      startAt: '2026-08-01T09:00:00.000Z', endAt: '2026-08-01T17:00:00.000Z',
    }, { id: 'user-1', email: 'staff@example.com', roles: ['STAFF'], scopes: [], sessionType: 'salon' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
