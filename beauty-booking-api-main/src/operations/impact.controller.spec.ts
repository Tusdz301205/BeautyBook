import { BadRequestException } from '@nestjs/common';
import { ImpactController } from './impact.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('ImpactController access errors', () => {
  it('returns a readable owner-only message for business-wide impact cases', async () => {
    const impacts = { detail: jest.fn() };
    const prisma = {
      operationalImpactCase: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ businessId: 'business-1', branchId: null }),
      },
    };
    const controller = new ImpactController(impacts as any, prisma as any);
    const user = { id: 'manager-1', roles: ['BRANCH_MANAGER'] } as AuthUser;

    await expect(controller.detail('impact-1', user)).rejects.toEqual(
      new BadRequestException('Impact case cấp doanh nghiệp chỉ dành cho chủ doanh nghiệp'),
    );
    expect(impacts.detail).not.toHaveBeenCalled();
  });
});
