import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../src/common/decorators/current-user.decorator';
import type { ScopedRole } from '../src/auth/jwt.strategy';
import {
  can,
  canOnResource,
  ensureCanOnResource,
  expandRolePermissions,
  roleGrantsPermission,
} from '../src/common/utils/policy';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../src/common/permissions/permission-catalog';

function mkUser(
  roles: Array<string | ScopedRole>,
  id = 'user-1',
): AuthUser {
  const scopes = roles.map((role) =>
    typeof role === 'string'
      ? { code: role, businessId: null, branchId: null }
      : role,
  );
  const roleCodes = [...new Set(scopes.map((scope) => scope.code))];
  return {
    id,
    email: `${id}@example.com`,
    roles: roleCodes,
    scopes,
    sessionType: roleCodes.length === 1 && roleCodes[0] === 'CUSTOMER' ? 'customer' : 'salon',
    permissions: expandRolePermissions(roleCodes),
  };
}

describe('policy engine integration', () => {
  test('coarse checks use the catalog role grant', () => {
    expect(can(mkUser(['RECEPTIONIST']), 'booking:read:branch')).toBe(true);
    expect(can(mkUser(['CUSTOMER']), 'booking:read:branch')).toBe(false);
  });

  test('retired Manager role grants no permissions even with a valid branch scope', () => {
    const retired = mkUser([
      { code: 'BRANCH_MANAGER', businessId: 'biz-1', branchId: 'branch-1' },
    ]);
    expect(retired.permissions).toEqual([]);
    expect(can(retired, 'booking:read:branch', { tenantId: 'biz-1', branchId: 'branch-1' })).toBe(false);
    expect(ROLE_PERMISSIONS).not.toHaveProperty('BRANCH_MANAGER');
  });

  test('tenant checks reject another business', () => {
    const owner = mkUser([
      { code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null },
    ]);
    expect(can(owner, 'booking:read:tenant', { tenantId: 'biz-1' })).toBe(true);
    expect(can(owner, 'booking:read:tenant', { tenantId: 'biz-2' })).toBe(false);
  });

  test('self checks require the resource owner', () => {
    const customer = mkUser(['CUSTOMER'], 'customer-1');
    expect(
      canOnResource(customer, 'booking:read:self', {
        ownerUserId: 'customer-1',
      }),
    ).toBe(true);
    expect(
      canOnResource(customer, 'booking:read:self', {
        ownerUserId: 'customer-2',
      }),
    ).toBe(false);
  });

  test('ensureCanOnResource fails closed', () => {
    expect(() =>
      ensureCanOnResource(mkUser(['CUSTOMER']), 'booking:read:branch', {
        businessId: 'biz-1',
        branchId: 'branch-1',
      }),
    ).toThrow(ForbiddenException);
  });

  test('role matrix contains only catalog permissions', () => {
    const catalog = new Set(PERMISSIONS.map((permission) => permission.code));
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(permissions.length).toBeGreaterThan(0);
      for (const permission of permissions) {
        expect(catalog.has(permission)).toBe(true);
        expect(roleGrantsPermission(role, permission)).toBe(true);
      }
    }
  });
});
