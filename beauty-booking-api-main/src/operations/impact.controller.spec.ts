import { ForbiddenException } from '@nestjs/common';
import { ImpactController } from './impact.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('ImpactController access errors', () => {
  it.each(['RECEPTIONIST', 'STAFF', 'BRANCH_MANAGER'])(
    'rejects %s before loading an operational impact case',
    async (roleCode) => {
      const impacts = { detail: jest.fn() };
      const prisma = {
        operationalImpactCase: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ businessId: 'business-1', branchId: null }),
        },
      };
      const controller = new ImpactController(impacts as any, prisma as any);
      const user = { id: 'branch-user-1', roles: [roleCode] } as AuthUser;

      await expect(controller.detail('impact-1', user)).rejects.toEqual(
        new ForbiddenException('Chỉ chủ doanh nghiệp hoặc quản trị nền tảng được quản lý ảnh hưởng vận hành'),
      );
      expect(prisma.operationalImpactCase.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(impacts.detail).not.toHaveBeenCalled();
    },
  );
});
