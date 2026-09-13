import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PolicyGuard } from '../src/common/guards/policy.guard';
import { ScopeGuard } from '../src/common/guards/scope.guard';
import { Roles, ROLES_KEY } from '../src/common/decorators/roles.decorator';
import {
  RequirePermission,
  REQUIRES_PERMISSION_KEY,
} from '../src/common/decorators/permission.decorator';
import { RequireScope, SCOPES_KEY } from '../src/common/decorators/scope.decorator';
import type { AuthUser } from '../src/common/decorators/current-user.decorator';

class Target {}

function makeContext({
  roles = [],
  permissions = [],
  scopes = [],
  headers = {},
}: {
  roles?: AuthUser['roles'];
  permissions?: string[];
  scopes?: AuthUser['scopes'];
  headers?: Record<string, string>;
}): ExecutionContext {
  const user: AuthUser = {
    id: 'u-1',
    email: 'a@b.com',
    roles,
    scopes,
    businessId: scopes[0]?.businessId ?? null,
    branchId: scopes[0]?.branchId ?? null,
    sessionType: 'salon',
    permissions,
  };
  const handler = { name: 'm' } as any;
  const cls = Target;
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user, headers }),
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
  } as unknown as ExecutionContext;
}

const reflectorWith = (data: Record<string, unknown>): Reflector =>
  new Proxy(new Reflector(), {
    get: (_t, prop: string) => {
      if (prop === 'getAllAndOverride') {
        return (key: string) => data[key];
      }
      return undefined;
    },
  });

describe('RolesGuard', () => {
  it('returns true when no @Roles is set (coarse opt-out)', () => {
    const guard = new RolesGuard(reflectorWith({}));
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('passes when the principal carries the required role globally', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ['PLATFORM_ADMIN'] }));
    expect(
      guard.canActivate(makeContext({ roles: ['PLATFORM_ADMIN'] })),
    ).toBe(true);
  });

  it('throws ForbiddenException when missing the role', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ['PLATFORM_ADMIN'] }));
    expect(() => guard.canActivate(makeContext({ roles: ['CUSTOMER'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('passes for @Roles(CUSTOMER) when caller is a customer', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ['CUSTOMER'] }));
    expect(guard.canActivate(makeContext({ roles: ['CUSTOMER'] }))).toBe(true);
  });
});

describe('PolicyGuard', () => {
  it('passes when no @RequirePermission is set', () => {
    const guard = new PolicyGuard(reflectorWith({}));
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('passes when the permission is present', () => {
    const guard = new PolicyGuard(
      reflectorWith({ [REQUIRES_PERMISSION_KEY]: ['booking:read:branch'] }),
    );
    expect(
      guard.canActivate(
        makeContext({ permissions: ['booking:read:branch'] }),
      ),
    ).toBe(true);
  });

  it('throws when the permission is missing', () => {
    const guard = new PolicyGuard(
      reflectorWith({ [REQUIRES_PERMISSION_KEY]: ['booking:read:branch'] }),
    );
    expect(() => guard.canActivate(makeContext({ permissions: [] }))).toThrow(
      ForbiddenException,
    );
  });
});

describe('ScopeGuard', () => {
  it('passes when no @RequireScope is set', () => {
    const guard = new ScopeGuard(reflectorWith({}));
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('throws when scopeLevel does not match principal scopes', () => {
    const guard = new ScopeGuard(
      reflectorWith({
        [SCOPES_KEY]: {
          roles: ['BRANCH_MANAGER'],
          scopeLevel: 'branch',
        },
      }),
    );
    // Caller has BUSINESS_OWNER only at tenant scope, not branch scope.
    expect(() =>
      guard.canActivate(
        makeContext({
          roles: ['BUSINESS_OWNER'],
          scopes: [
            { code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null },
          ],
          headers: { 'x-business-id': 'biz-1', 'x-branch-id': 'branch-x' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes when branch-scope role matches declared scope + header', () => {
    const guard = new ScopeGuard(
      reflectorWith({
        [SCOPES_KEY]: {
          roles: ['RECEPTIONIST'],
          scopeLevel: 'branch',
        },
      }),
    );
    expect(
      guard.canActivate(
        makeContext({
          roles: ['RECEPTIONIST'],
          scopes: [
            {
              code: 'RECEPTIONIST',
              businessId: 'biz-1',
              branchId: 'branch-x',
            },
          ],
          headers: { 'x-business-id': 'biz-1', 'x-branch-id': 'branch-x' },
        }),
      ),
    ).toBe(true);
  });

  it('rejects when scope has expired (expiresAt in past)', () => {
    const guard = new ScopeGuard(
      reflectorWith({
        [SCOPES_KEY]: { roles: ['STAFF'], scopeLevel: 'branch' },
      }),
    );
    expect(() =>
      guard.canActivate(
        makeContext({
          roles: ['STAFF'],
          scopes: [
            {
              code: 'STAFF',
              businessId: 'biz-1',
              branchId: 'branch-x',
              expiresAt: new Date(Date.now() - 1000).toISOString(),
            },
          ],
          headers: { 'x-business-id': 'biz-1', 'x-branch-id': 'branch-x' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
