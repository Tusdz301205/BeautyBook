import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { BranchStateService } from './branch-state.service';

describe('BranchStateService', () => {
  it('uses one canonical definition for public visibility and bookability', () => {
    const service = new BranchStateService({} as PrismaService);
    expect(service.canonicalState({ status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE' })).toEqual({ publicVisible: true, bookable: true });
    expect(service.canonicalState({ status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'SUSPENDED' })).toEqual({ publicVisible: false, bookable: false });
  });

  it('requires an actor reason for every transition', async () => {
    await expect(new BranchStateService({} as PrismaService).transition('branch-1', 'PAUSE', 'owner-1', ''))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('revalidates transition guards after taking the row lock', async () => {
    const prisma: any = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'branch-1', businessId: 'business-1', status: 'INACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'READY_TO_PUBLISH',
          business: { id: 'business-1', status: 'ACTIVE' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'branch-1', status: 'PENDING', reviewStatus: 'PENDING_REVIEW', operationalStatus: 'INACTIVE',
        }),
        update: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
    await expect(new BranchStateService(prisma as PrismaService).transition('branch-1', 'PUBLISH', 'owner-1', 'Phát hành'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });
});
