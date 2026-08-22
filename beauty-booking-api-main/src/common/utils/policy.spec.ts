import {
  can,
  cannot,
  canOnResource,
  ensureCanOnResource,
  roleGrantsPermission,
  expandRolePermissions,
  allPermissionCodes,
  CannotError,
} from './policy';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  findPermission,
} from '../permissions/permission-catalog';
import type { AuthUser } from '../decorators/current-user.decorator';

const CUSTOMER_USER: AuthUser = {
  id: 'u-1',
  email: 'cust@x.com',
  roles: ['CUSTOMER'],
  scopes: [{ code: 'CUSTOMER' }],
  sessionType: 'customer',
};

const STAFF_USER: AuthUser = {
  id: 'u-2',
  email: 'staff@x.com',
  roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'b-1', branchId: 'br-1' }],
  sessionType: 'salon',
};

const OWNER_USER: AuthUser = {
  id: 'u-3',
  email: 'owner@x.com',
  roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'b-1' }],
  sessionType: 'salon',
};

const PLATFORM_USER: AuthUser = {
  id: 'u-4',
  email: 'admin@x.com',
  roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN' }],
  sessionType: 'admin',
  permissions: [
    'booking:read:platform',
    'booking:cancel:platform',
    'audit:read:platform',
    'health_record:read:sensitive',
  ],
};

const OTHER_TENANT_OWNER: AuthUser = {
  id: 'u-5',
  email: 'owner2@x.com',
  roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'b-99' }],
  sessionType: 'salon',
};

describe('policy.can — matrix', () => {
  test('Customer may read their own booking but not others', () => {
    expect(can(CUSTOMER_USER, 'booking:read:self', { ownerId: 'u-1' })).toBe(true);
    expect(can(CUSTOMER_USER, 'booking:read:self', { ownerId: 'someone-else' })).toBe(false);
    expect(can(CUSTOMER_USER, 'booking:read:tenant', { tenantId: 'b-1' })).toBe(false);
  });

  test('Customer may cancel own booking only', () => {
    expect(can(CUSTOMER_USER, 'booking:cancel:self', { ownerId: 'u-1' })).toBe(true);
    expect(can(CUSTOMER_USER, 'booking:cancel:self', { ownerId: 'u-99' })).toBe(false);
    expect(can(CUSTOMER_USER, 'booking:cancel:branch', { branchId: 'br-1' })).toBe(false);
  });

  test('Staff may read/update bookings in their branch', () => {
    expect(can(STAFF_USER, 'booking:read:branch', { branchId: 'br-1' })).toBe(true);
    expect(can(STAFF_USER, 'booking:read:branch', { branchId: 'br-99' })).toBe(false);
    expect(can(STAFF_USER, 'booking:update:branch', { branchId: 'br-1' })).toBe(true);
  });

  test('Staff cannot read a different tenant\'s branch bookings', () => {
    expect(can(STAFF_USER, 'booking:read:tenant', { tenantId: 'b-99' })).toBe(false);
  });

  test('Business owner may read/update any branch in their tenant', () => {
    expect(can(OWNER_USER, 'booking:read:tenant', { tenantId: 'b-1' })).toBe(true);
    expect(can(OWNER_USER, 'booking:update:tenant', { tenantId: 'b-1' })).toBe(true);
    expect(can(OWNER_USER, 'booking:read:tenant', { tenantId: 'b-99' })).toBe(false);
    expect(can(OWNER_USER, 'booking:cancel:platform')).toBe(false);
  });

  test('catalog ownership is fail-closed for manager and platform administration', () => {
    const manager: AuthUser = {
      id: 'manager-1', email: 'manager@x.com', roles: ['BRANCH_MANAGER'],
      scopes: [{ code: 'BRANCH_MANAGER', businessId: 'b-1', branchId: 'br-1' }],
      sessionType: 'salon',
    };
    expect(can(OWNER_USER, 'business_service:create:tenant', { tenantId: 'b-1' })).toBe(true);
    expect(can(OWNER_USER, 'branch_service_offering:pricing:tenant', { tenantId: 'b-1' })).toBe(true);
    expect(can(manager, 'business_service:create:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(manager, 'business_service:update:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(manager, 'branch_service_offering:pricing:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(manager, 'service_category:manage:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(manager, 'branch_service_offering:status:branch', { tenantId: 'b-1', branchId: 'br-1' })).toBe(true);
    expect(can(PLATFORM_USER, 'business_service:update:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(PLATFORM_USER, 'branch_service_offering:pricing:tenant', { tenantId: 'b-1' })).toBe(false);
  });

  test('Cross-tenant owner blocked from another tenant', () => {
    expect(can(OTHER_TENANT_OWNER, 'booking:read:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(OTHER_TENANT_OWNER, 'booking:read:tenant', { tenantId: 'b-99' })).toBe(true);
  });

  test('Platform admin may use explicitly granted platform capabilities', () => {
    expect(can(PLATFORM_USER, 'booking:read:platform')).toBe(true);
    expect(can(PLATFORM_USER, 'booking:update:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(PLATFORM_USER, 'booking:cancel:platform', { tenantId: 'b-1' })).toBe(true);
    expect(can(PLATFORM_USER, 'audit:read:platform')).toBe(true);
  });

  test('Platform administrator has governance read/refund but not tenant operation update', () => {
    const support: AuthUser = {
      id: 's-1',
      email: 's@x.com',
      roles: ['PLATFORM_ADMIN'],
      scopes: [{ code: 'PLATFORM_ADMIN' }],
      sessionType: 'admin',
      permissions: ['booking:read:platform', 'payment:refund:platform'],
    };
    expect(can(support, 'booking:read:platform')).toBe(true);
    expect(can(support, 'payment:refund:platform')).toBe(true);
    expect(can(support, 'booking:update:tenant', { tenantId: 'b-1' })).toBe(false);
  });

  test('Platform administrator role supplies the audited exceptional refund capability', () => {
    const finance: AuthUser = {
      id: 'f-1',
      email: 'f@x.com',
      roles: ['PLATFORM_ADMIN'],
      scopes: [{ code: 'PLATFORM_ADMIN' }],
      sessionType: 'admin',
      permissions: ['payment:read:platform', 'report:revenue:platform'],
    };
    expect(can(finance, 'payment:read:platform')).toBe(true);
    expect(can(finance, 'report:revenue:platform')).toBe(true);
    expect(can(finance, 'booking:update:tenant', { tenantId: 'b-1' })).toBe(false);
    expect(can(finance, 'payment:refund:platform')).toBe(true);
  });

  test('Health record: separate ACL with sensitive permission', () => {
    expect(can(STAFF_USER, 'health_record:read:branch', { branchId: 'br-1', tenantId: 'b-1' })).toBe(true);
    expect(can(STAFF_USER, 'health_record:read:branch', { branchId: 'br-99' })).toBe(false);
    expect(can(PLATFORM_USER, 'health_record:read:sensitive')).toBe(true);
    expect(can(OWNER_USER, 'health_record:read:sensitive')).toBe(false);
    expect(can(CUSTOMER_USER, 'health_record:read:self', { ownerId: 'u-1' })).toBe(true);
    expect(can(CUSTOMER_USER, 'health_record:read:sensitive')).toBe(false);
  });

  test('Unknown permission is denied (fail-closed)', () => {
    expect(can(PLATFORM_USER, 'this:does:not:exist')).toBe(false);
  });

  test('Expired scope is skipped', () => {
    const expired: AuthUser = {
      id: 'u-6',
      email: 'e@x.com',
      roles: ['STAFF'],
      scopes: [
        {
          code: 'STAFF',
          businessId: 'b-1',
          branchId: 'br-1',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      sessionType: 'salon',
    };
    expect(can(expired, 'booking:read:branch', { branchId: 'br-1' })).toBe(false);
  });

  test('Public permissions pass for everyone', () => {
    const guest: AuthUser = {
      id: 'g-1',
      email: 'g@x.com',
      roles: ['GUEST'],
      scopes: [{ code: 'GUEST' }],
      sessionType: 'customer',
    };
    expect(can(guest, 'branch:read:public')).toBe(true);
    expect(can(guest, 'service:read:public')).toBe(true);
  });
});

describe('policy.cannot', () => {
  test('throws CannotError when denied', () => {
    expect(() => cannot(CUSTOMER_USER, 'booking:read:tenant', { tenantId: 'b-1' })).toThrow(CannotError);
  });

  test('does not throw when allowed', () => {
    expect(() => cannot(PLATFORM_USER, 'booking:read:platform')).not.toThrow();
  });
});

describe('canOnResource / ensureCanOnResource', () => {
  test('canOnResource maps businessId/branchId/ownerUserId', () => {
    expect(
      canOnResource(STAFF_USER, 'booking:read:branch', {
        businessId: 'b-1',
        branchId: 'br-1',
      }),
    ).toBe(true);
    expect(
      canOnResource(STAFF_USER, 'booking:read:branch', {
        businessId: 'b-99',
        branchId: 'br-99',
      }),
    ).toBe(false);
  });

  test('ensureCanOnResource throws ForbiddenException', () => {
    const { ForbiddenException } = require('@nestjs/common');
    expect(() =>
      ensureCanOnResource(CUSTOMER_USER, 'booking:read:tenant', {
        businessId: 'b-1',
      }),
    ).toThrow(ForbiddenException);
  });
});

describe('role / permission catalog helpers', () => {
  test('roleGrantsPermission matches the ROLE_PERMISSIONS matrix', () => {
    expect(roleGrantsPermission('CUSTOMER', 'booking:create:self')).toBe(true);
    expect(roleGrantsPermission('CUSTOMER', 'booking:create:tenant')).toBe(false);
    expect(roleGrantsPermission('PLATFORM_ADMIN', 'booking:cancel:platform')).toBe(true);
    expect(roleGrantsPermission('STAFF', 'health_record:create:branch')).toBe(true);
  });

  test('expandRolePermissions returns the union', () => {
    const perms = expandRolePermissions(['CUSTOMER']);
    expect(perms).toContain('booking:create:self');
    expect(perms).toContain('health_record:consent:manage:self');
  });

  test('every catalog code has at least one role grant', () => {
    const codes = allPermissionCodes();
    expect(codes.length).toBeGreaterThan(30);
    const allRoles = Object.keys(ROLE_PERMISSIONS);
    const directOnlyPermissions = new Set(['staff_schedule:manage:self']);
    const orphan = codes.find((c) => {
      // Platform capabilities may intentionally be direct-only grants.
      if (findPermission(c)?.defaultScope === 'PLATFORM') return false;
      if (directOnlyPermissions.has(c)) return false;
      return !allRoles.some((r) => roleGrantsPermission(r, c));
    });
    expect(orphan).toBeUndefined();
  });

  test('every role has at least one permission', () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(perms.length).toBeGreaterThan(0);
      // sanity: each permission code must exist in the catalog
      for (const p of perms) {
        expect(PERMISSIONS.find((entry) => entry.code === p)).toBeDefined();
      }
    }
  });
});
