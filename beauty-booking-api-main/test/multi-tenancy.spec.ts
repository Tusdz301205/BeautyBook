import { ForbiddenException } from '@nestjs/common';
import {
  resolveBusinessIdsForUser,
  assertBranchAccess,
  resolveBranchIdsForUser,
  tenantScope,
} from '../src/common/utils/multi-tenancy';
import type { AuthUser } from '../src/common/decorators/current-user.decorator';

function mkUser(scopes: any[], id = 'u-1'): AuthUser {
  return {
    id,
    email: 'x@x.com',
    roles: scopes.map((s) => s.code),
    scopes,
    sessionType: 'salon',
    permissions: [],
  };
}

const prismaStub: any = {
  salonMember: { findMany: async () => [] },
  userRole: { findMany: async () => [] },
  businessOwnerProfile: { findUnique: async () => null },
  branch: {
    findUnique: async ({ where }: any) =>
      ['branch-A', 'branch-B', 'branch-anywhere'].includes(where.id)
        ? { businessId: 'biz-1' }
        : null,
    findMany: async () => [
      { id: 'branch-A' },
      { id: 'branch-B' },
      { id: 'branch-anywhere' },
    ],
  },
};

describe('multi-tenancy', () => {
  it('PLATFORM_ADMIN bypasses business scoping', async () => {
    const u = mkUser([{ code: 'PLATFORM_ADMIN', businessId: null, branchId: null }]);
    const ids = await resolveBusinessIdsForUser(prismaStub, u);
    expect(ids).toContain('__ALL__');
  });

  it('BUSINESS_OWNER scoped to a business appears in business list', async () => {
    const u = mkUser([
      { code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null },
    ]);
    const ids = await resolveBusinessIdsForUser(prismaStub, u);
    expect(ids).toEqual(['biz-1']);
  });

  it('STAFF with no business scope returns empty', async () => {
    const u = mkUser([{ code: 'STAFF', businessId: null, branchId: null }]);
    const ids = await resolveBusinessIdsForUser(prismaStub, u);
    expect(ids).toEqual([]);
  });

  it('assertBranchAccess throws for cross-branch access', async () => {
    const u = mkUser([
      { code: 'STAFF', businessId: 'biz-1', branchId: 'branch-A' },
    ]);
    await expect(
      assertBranchAccess(prismaStub, u, 'branch-B'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertBranchAccess allows platform admin anywhere', async () => {
    const u = mkUser([{ code: 'PLATFORM_ADMIN', businessId: null, branchId: null }]);
    await expect(
      assertBranchAccess(prismaStub, u, 'branch-anywhere'),
    ).resolves.toBe('biz-1');
  });

  it('resolveBranchIdsForUser returns all tenant branches for owner', async () => {
    const u = mkUser([
      { code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null },
    ]);
    await expect(
      resolveBranchIdsForUser(prismaStub, u, 'biz-1'),
    ).resolves.toEqual(['branch-A', 'branch-B', 'branch-anywhere']);
  });

  it('resolveBranchIdsForUser returns exact branches for branch-scoped roles', async () => {
    const u = mkUser([
      { code: 'STAFF', businessId: 'biz-1', branchId: 'branch-A' },
      { code: 'STAFF', businessId: 'biz-1', branchId: 'branch-B' },
    ]);
    const branches = await resolveBranchIdsForUser(prismaStub, u, 'biz-1');
    expect(branches).toEqual(expect.arrayContaining(['branch-A', 'branch-B']));
  });

  it('tenantScope returns tautology for platform access', () => {
    expect(tenantScope(['__ALL__'])).toEqual({});
  });

  it('resolves a newly created owner business while the JWT scope is still empty', async () => {
    const u = mkUser([{ code: 'BUSINESS_OWNER', businessId: null, branchId: null }]);
    const prisma = {
      ...prismaStub,
      businessOwnerProfile: {
        findUnique: async () => ({ businesses: [{ id: 'biz-new' }] }),
      },
    };
    await expect(resolveBusinessIdsForUser(prisma, u)).resolves.toEqual(['biz-new']);
  });

  it('tenantScope returns safe "no access" filter for users with no scope', () => {
    const where = tenantScope([]) as any;
    expect(where).toEqual({ id: { in: [] } });
  });
});
