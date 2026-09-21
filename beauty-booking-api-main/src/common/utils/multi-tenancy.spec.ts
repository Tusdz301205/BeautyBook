import type { AuthUser } from '../decorators/current-user.decorator';
import { resolveBranchIdsForUser, resolveBusinessIdsForUser, restrictToRoles, tenantBranchScope } from './multi-tenancy';
import { can, expandRolePermissions } from './policy';

const receptionist: AuthUser = {
  id: 'operator', email: 'operator@example.test', sessionType: 'salon',
  roles: ['RECEPTIONIST'],
  scopes: [{ code: 'RECEPTIONIST', businessId: 'business-a', branchId: 'branch-a' }],
};
const prisma = () => ({
  branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch-a' }, { id: 'branch-b' }]) },
  salonMember: { findMany: jest.fn().mockResolvedValue([{ businessId: 'business-b', branchId: 'branch-b' }]) },
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
});

describe('remaining salon roles preserve branch isolation', () => {
  it('does not import legacy membership scopes or authorize a sibling branch', async () => {
    const db = prisma();
    expect(await resolveBusinessIdsForUser(db as never, receptionist)).toEqual(['business-a']);
    expect(await resolveBranchIdsForUser(db as never, receptionist, 'business-a')).toEqual(['branch-a']);
    expect(await resolveBranchIdsForUser(db as never, receptionist, 'business-b')).toEqual([]);
    expect(await tenantBranchScope(db as never, receptionist)).toEqual({ id: { in: ['branch-a'] } });
    expect(db.salonMember.findMany).not.toHaveBeenCalled();
  });

  it('does not use an owner role in another business to widen receptionist scope', async () => {
    const mixed = { ...receptionist, roles: ['BUSINESS_OWNER', 'RECEPTIONIST'], scopes: [
      ...receptionist.scopes, { code: 'BUSINESS_OWNER', businessId: 'business-b', branchId: null },
    ] };
    expect(await resolveBranchIdsForUser(prisma() as never, mixed, 'business-a')).toEqual(['branch-a']);
    expect(can(mixed, 'branch:update:tenant', { tenantId: 'business-a' })).toBe(false);
  });

  it('allows the owner all branches in their own business, even with another branch role', async () => {
    const owner = { ...receptionist, roles: ['BUSINESS_OWNER', 'RECEPTIONIST'], scopes: [
      ...receptionist.scopes, { code: 'BUSINESS_OWNER', businessId: 'business-a', branchId: null },
    ] };
    expect(await resolveBranchIdsForUser(prisma() as never, owner, 'business-a')).toEqual(['branch-a', 'branch-b']);
  });

  it('preserves the verified owner onboarding fallback without granting other businesses', async () => {
    const db = { ...prisma(), businessOwnerProfile: {
      findUnique: jest.fn().mockResolvedValue({ businesses: [{ id: 'business-a' }] }),
    } };
    const owner = { ...receptionist, roles: ['BUSINESS_OWNER'], scopes: [
      { code: 'BUSINESS_OWNER', businessId: null, branchId: null },
    ] };
    expect(await resolveBranchIdsForUser(db as never, owner, 'business-a')).toEqual(['branch-a', 'branch-b']);
    expect(await resolveBranchIdsForUser(db as never, owner, 'business-other')).toEqual([]);
    expect(await tenantBranchScope(db as never, owner)).toEqual({ id: { in: ['branch-a', 'branch-b'] } });
  });

  it('denies expired and unscoped branch grants, including cached permissions', async () => {
    const expired = { ...receptionist, permissions: expandRolePermissions(['RECEPTIONIST']), scopes: [
      { ...receptionist.scopes[0], expiresAt: new Date(0).toISOString() },
    ] };
    expect(await resolveBranchIdsForUser(prisma() as never, expired, 'business-a')).toEqual([]);
    expect(await resolveBusinessIdsForUser(prisma() as never, expired)).toEqual([]);
    expect(can(expired, 'booking:read:branch')).toBe(false);
    expect(can({ ...receptionist, scopes: [{ code: 'RECEPTIONIST', businessId: 'business-a' }] },
      'booking:read:branch', { tenantId: 'business-a', branchId: 'branch-b' })).toBe(false);
  });

  it('does not promote a separate staff membership through an unscoped onboarding owner', async () => {
    const db = { ...prisma(), businessOwnerProfile: {
      findUnique: jest.fn().mockResolvedValue({ businesses: [{ id: 'owned-business' }] }),
    } };
    const mixed = { ...receptionist, roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [
      { code: 'BUSINESS_OWNER', businessId: null, branchId: null },
      { code: 'STAFF', businessId: 'business-a', branchId: 'branch-a' },
    ] };
    expect(await resolveBusinessIdsForUser(db as never, mixed)).toEqual(['business-a', 'owned-business']);
    expect(await resolveBranchIdsForUser(db as never, mixed, 'business-a')).toEqual(['branch-a']);
    expect(await resolveBranchIdsForUser(db as never, mixed, 'owned-business')).toEqual(['branch-a', 'branch-b']);
    expect(await resolveBusinessIdsForUser(db as never, restrictToRoles(mixed, ['BUSINESS_OWNER']))).toEqual(['owned-business']);
  });

  it('limits a capability principal to matching role assignments without changing the original user', () => {
    const mixed = { ...receptionist, roles: ['BUSINESS_OWNER', 'RECEPTIONIST'], scopes: [
      ...receptionist.scopes, { code: 'BUSINESS_OWNER', businessId: 'business-b', branchId: null },
    ] };
    const scoped = restrictToRoles(mixed, ['BUSINESS_OWNER']);
    expect(scoped.roles).toEqual(['BUSINESS_OWNER']);
    expect(scoped.scopes).toEqual([mixed.scopes[1]]);
    expect(mixed.scopes).toHaveLength(2);
    expect(scoped.id).toBe(mixed.id);
  });

  it.each(['booking:assign:branch', 'booking:cancel:branch', 'booking:reschedule:branch', 'booking:check_in:branch'])(
    'receptionist %s is granted only in the assigned branch', (permission) => {
      expect(can(receptionist, permission, { tenantId: 'business-a', branchId: 'branch-a' })).toBe(true);
      expect(can(receptionist, permission, { tenantId: 'business-a', branchId: 'branch-b' })).toBe(false);
    },
  );
});
