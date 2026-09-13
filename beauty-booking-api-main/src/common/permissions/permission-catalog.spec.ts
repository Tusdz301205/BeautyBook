import { PERMISSION_CODE_SET, ROLE_PERMISSIONS } from './permission-catalog';
import { REQUIRES_PERMISSION_KEY } from '../decorators/permission.decorator';
import { BookingsController } from '../../bookings/bookings.controller';

// Static AST inventory: no controller imports or application startup required.
const { scanControllers, routeKey, permissionCoverageGaps } = require('../../../scripts/controller-metadata.cjs');
const exceptions: Record<string, string> = require('../../../scripts/permission-exceptions.cjs');
const inventory = scanControllers(process.cwd());

describe('permission catalog contract', () => {
  test('keeps branch creation fail-closed by default', () => {
    expect(ROLE_PERMISSIONS.BUSINESS_OWNER).toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.BRANCH_MANAGER).not.toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.STAFF).not.toContain('branch:create:tenant');
  });

  test('every permission declared on a class, method or scope exists in the catalog', () => {
    const unknown = new Set<string>();
    for (const declaration of inventory.declarations) {
      for (const code of [...(declaration.permissions ?? []), ...(declaration.scope?.permissions ?? [])]) {
        if (!PERMISSION_CODE_SET.has(code)) unknown.add(code);
      }
    }
    expect([...unknown].sort()).toEqual([]);
  });

  test('customer booking creation is guarded by booking:create:self', () => {
    expect(Reflect.getMetadata(REQUIRES_PERMISSION_KEY, BookingsController.prototype.create))
      .toContain('booking:create:self');
  });

  test('every effective role can satisfy at least one enforced permission', () => {
    const mismatches: string[] = [];
    const directGrantExceptions = new Set(['BRANCH_MANAGER:branch:create:tenant']);
    for (const route of inventory.routes) {
      if (route.isPublic || route.permissions.length === 0) continue;
      const roles = route.roles.length ? route.roles : route.scope?.roles ?? [];
      for (const role of roles) {
        // Platform permissions may be revocable direct grants.
        if (role === 'ADMIN' || role === 'PLATFORM_ADMIN' || !ROLE_PERMISSIONS[role]) continue;
        if (!route.permissions.some((code: string) =>
          ROLE_PERMISSIONS[role].includes(code) || directGrantExceptions.has(role + ':' + code),
        )) {
          mismatches.push(routeKey(route) + ' role=' + role + ' permissions=' + route.permissions.join('|'));
        }
      }
    }
    expect(mismatches.sort()).toEqual([]);
  });

  test('every authenticated route has enforced permission metadata or a reviewed resource-authorization exception', () => {
    expect(permissionCoverageGaps(inventory.routes, exceptions)).toEqual([]);
  });

  test('exceptions stay narrow, documented and attached to a real authenticated route', () => {
    for (const [key, reason] of Object.entries(exceptions)) {
      const matches = inventory.routes.filter((route) => routeKey(route) === key);
      expect(matches).toHaveLength(1);
      expect(matches[0].isPublic).toBe(false);
      expect(matches[0].permissions).toEqual([]);
      expect(reason.length).toBeGreaterThan(40);
    }
  });

  test('legacy RequireScope permission hints must also be enforced by RequirePermission', () => {
    const missing = inventory.routes.filter((route) =>
      (route.scope?.permissions ?? []).some((code: string) => !route.permissions.includes(code)),
    ).map(routeKey);
    expect(missing).toEqual([]);
  });
});
