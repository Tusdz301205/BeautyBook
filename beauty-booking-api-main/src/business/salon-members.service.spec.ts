import { BadRequestException } from '@nestjs/common';
import { SalonMembersService } from './salon-members.service';

function setup() {
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
    salonMember: { upsert: jest.fn().mockResolvedValue({ id: 'member-1' }) },
  };
  return { prisma, service: new SalonMembersService(prisma as never) };
}

describe('SalonMembersService supported metadata roles', () => {
  it.each(['MANAGER', 'BRANCH_MANAGER'])(
    'rejects retired membership role %s before writing metadata',
    async (role) => {
      const { service, prisma } = setup();
      await expect(service.addMember('business-1', {
        userId: 'user-1', role: role as never, branchId: 'branch-1',
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.branch.findFirst).not.toHaveBeenCalled();
      expect(prisma.salonMember.upsert).not.toHaveBeenCalled();
    },
  );

  it('requires a branch for Receptionist metadata', async () => {
    const { service, prisma } = setup();
    await expect(service.addMember('business-1', {
      userId: 'user-1', role: 'RECEPTIONIST',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.salonMember.upsert).not.toHaveBeenCalled();
  });

  it('rejects a branch that is not in the selected business', async () => {
    const { service, prisma } = setup();
    prisma.branch.findFirst.mockResolvedValue(null as never);
    await expect(service.addMember('business-1', {
      userId: 'user-1', role: 'RECEPTIONIST', branchId: 'other-branch',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.salonMember.upsert).not.toHaveBeenCalled();
  });

  it('writes valid branch-scoped Receptionist metadata without inferring ownership', async () => {
    const { service, prisma } = setup();
    await service.addMember('business-1', {
      userId: 'user-1', role: 'RECEPTIONIST', branchId: 'branch-1',
    });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 'branch-1', businessId: 'business-1', deletedAt: null },
    });
    expect(prisma.salonMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'user-1', businessId: 'business-1', branchId: 'branch-1', role: 'RECEPTIONIST' },
      update: { role: 'RECEPTIONIST', branchId: 'branch-1', isActive: true },
    }));
  });
});
