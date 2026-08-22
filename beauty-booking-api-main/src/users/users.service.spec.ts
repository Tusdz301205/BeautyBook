import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const PLATFORM: AuthUser = {
  id: 'platform-1',
  email: 'platform@example.com',
  roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN' }],
  sessionType: 'admin',
};

function setup() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    userRole: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    branch: { findUnique: jest.fn() },
    permission: { findUnique: jest.fn() },
  };
  const service = new UsersService(
    prisma as never,
    { revokeAllForUser: jest.fn() } as never,
  );
  return { service, prisma };
}

describe('UsersService role scope validation', () => {
  it.each(['ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE'])(
    'rejects retired platform role %s',
    async (roleCode) => {
      const { service } = setup();
      await expect(service.assignRole(
        'user-1',
        { roleCode },
        PLATFORM,
      )).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'])(
    'rejects %s without a branch even for platform actors',
    async (roleCode) => {
      const { service } = setup();
      await expect(service.assignRole(
        'user-1',
        { roleCode, businessId: 'business-1' },
        PLATFORM,
      )).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects a branch/business mismatch', async () => {
    const { service, prisma } = setup();
    prisma.branch.findUnique.mockResolvedValue({ businessId: 'business-2' });
    await expect(service.assignRole(
      'user-1',
      { roleCode: 'STAFF', businessId: 'business-1', branchId: 'branch-2' },
      PLATFORM,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects direct platform grants that turn Platform Admin into a salon operator', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', userRoles: [{ id: 'platform-role' }] });
    prisma.permission.findUnique.mockResolvedValue({
      id: 'permission-1', code: 'service:update:platform', scope: 'PLATFORM',
    });
    await expect(service.grantDirectPermission(
      'user-1',
      { permissionCode: 'service:update:platform' },
      PLATFORM,
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
