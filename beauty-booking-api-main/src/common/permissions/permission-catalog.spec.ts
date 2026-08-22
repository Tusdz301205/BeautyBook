import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSION_CODE_SET, ROLE_PERMISSIONS } from './permission-catalog';
import { REQUIRES_PERMISSION_KEY } from '../decorators/permission.decorator';
import { BookingsController } from '../../bookings/bookings.controller';

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? typescriptFiles(path)
      : entry.endsWith('.ts') && !entry.endsWith('.spec.ts')
        ? [path]
        : [];
  });
}

describe('permission catalog contract', () => {
  test('keeps branch creation and schedule management fail-closed by default', () => {
    expect(ROLE_PERMISSIONS.BUSINESS_OWNER).toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.BRANCH_MANAGER).not.toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.STAFF).not.toContain('branch:create:tenant');
    expect(ROLE_PERMISSIONS.RECEPTIONIST).toContain('staff_schedule:read:branch');
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain('staff_schedule:manage:branch');
    expect(ROLE_PERMISSIONS.STAFF).toContain('staff_schedule:read:self');
    expect(ROLE_PERMISSIONS.STAFF).not.toContain('staff_schedule:manage:self');
  });

  test('every @RequirePermission code exists in the catalog', () => {
    const unknown = new Set<string>();
    const decoratorPattern = /@RequirePermission\(([\s\S]*?)\)/g;
    const scopePermissionsPattern = /@RequireScope\([\s\S]*?permissions\s*:\s*\[([\s\S]*?)\][\s\S]*?\)/g;
    const stringPattern = /'([^']+)'/g;

    for (const file of typescriptFiles(join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const decorator of source.matchAll(decoratorPattern)) {
        for (const literal of decorator[1].matchAll(stringPattern)) {
          if (!PERMISSION_CODE_SET.has(literal[1])) unknown.add(literal[1]);
        }
      }
      for (const decorator of source.matchAll(scopePermissionsPattern)) {
        for (const literal of decorator[1].matchAll(stringPattern)) {
          if (!PERMISSION_CODE_SET.has(literal[1])) unknown.add(literal[1]);
        }
      }
    }

    expect([...unknown].sort()).toEqual([]);
  });

  test('customer booking creation is guarded by booking:create:self', () => {
    const permissions = Reflect.getMetadata(
      REQUIRES_PERMISSION_KEY,
      BookingsController.prototype.create,
    ) as string[];

    expect(permissions).toContain('booking:create:self');
  });

  test('every declared role can satisfy at least one permission on its route', () => {
    const mismatches: string[] = [];
    const directGrantExceptions = new Set([
      'BRANCH_MANAGER:branch:create:tenant',
      'STAFF:staff_schedule:manage:self',
    ]);
    const routePattern = /@(Get|Post|Patch|Delete|Put)\([^)]*\)([\s\S]*?)(?=\n\s*(?:async\s+)?([A-Za-z_]\w*)\s*\()/g;
    const rolesPattern = /@Roles\(([^)]*)\)/;
    const permissionsPattern = /@RequirePermission\(([^)]*)\)/;
    const stringPattern = /'([^']+)'/g;

    for (const file of typescriptFiles(join(process.cwd(), 'src')).filter((path) => path.endsWith('.controller.ts'))) {
      const source = readFileSync(file, 'utf8');
      for (const route of source.matchAll(routePattern)) {
        const rolesSource = rolesPattern.exec(route[2])?.[1];
        const permissionsSource = permissionsPattern.exec(route[2])?.[1] ??
          /@RequireScope\([\s\S]*?permissions\s*:\s*\[([^\]]*)\]/.exec(route[2])?.[1];
        if (!rolesSource || !permissionsSource) continue;
        const roles = [...rolesSource.matchAll(stringPattern)].map((match) => match[1]);
        const permissions = [...permissionsSource.matchAll(stringPattern)].map((match) => match[1]);
        for (const role of roles) {
          // PLATFORM_ADMIN receives sensitive platform permissions through
          // revocable UserPermission grants rather than the static role
          // catalog. ADMIN is retained only as a migration compatibility enum.
          if (role === 'ADMIN' || role === 'PLATFORM_ADMIN' || !ROLE_PERMISSIONS[role]) continue;
          const hasStaticOrDirectGrant = permissions.some((permission) =>
            ROLE_PERMISSIONS[role].includes(permission) ||
            directGrantExceptions.has(`${role}:${permission}`),
          );
          if (!hasStaticOrDirectGrant) {
            mismatches.push(`${file.split(/[\\/]/).pop()}:${route[3]} role=${role} permissions=${permissions.join('|')}`);
          }
        }
      }
    }

    expect(mismatches.sort()).toEqual([]);
  });

  test('role-restricted routes also declare an explicit permission', () => {
    const missing: string[] = [];
    const routePattern = /@(Get|Post|Patch|Delete|Put)\([^)]*\)([\s\S]*?)(?=\n\s*(?:async\s+)?([A-Za-z_]\w*)\s*\()/g;
    for (const file of typescriptFiles(join(process.cwd(), 'src')).filter((path) => path.endsWith('.controller.ts'))) {
      const source = readFileSync(file, 'utf8');
      for (const route of source.matchAll(routePattern)) {
        const scopeCarriesPermissions = route[2].includes('@RequireScope(') && route[2].includes('permissions:');
        if (route[2].includes('@Roles(') && !route[2].includes('@RequirePermission(') && !scopeCarriesPermissions) {
          missing.push(`${file.split(/[\\/]/).pop()}:${route[3]}`);
        }
      }
    }
    expect(missing.sort()).toEqual([]);
  });
});
