import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ScopeGuard } from './scope.guard';
import { PolicyGuard } from './policy.guard';
import type { AuthUser } from '../decorators/current-user.decorator';

function makeContext({ user, params = {}, body = {}, handlerMetadata, classMetadata }: {
  user?: AuthUser;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  handlerMetadata?: Record<string, unknown>;
  classMetadata?: Record<string, unknown>;
}): ExecutionContext {
  const handler = () => undefined;
  class ControllerTarget {}
  for (const [key, value] of Object.entries(handlerMetadata ?? {})) {
    Reflect.defineMetadata(key, value, handler);
  }
  for (const [key, value] of Object.entries(classMetadata ?? {})) {
    Reflect.defineMetadata(key, value, ControllerTarget);
  }
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user, params, body, headers: {} }),
      getResponse: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => ControllerTarget,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => 'http',
  };
  return ctx as unknown as ExecutionContext;
}

const CUSTOMER: AuthUser = {
  id: 'u-1',
  email: 'c@x.com',
  roles: ['CUSTOMER'],
  scopes: [{ code: 'CUSTOMER' }],
  sessionType: 'customer',
};

const STAFF: AuthUser = {
  id: 'u-2',
  email: 's@x.com',
  roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'b-1', branchId: 'br-1' }],
  sessionType: 'salon',
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  beforeEach(() => {
    guard = new RolesGuard(new Reflector());
  });

  test('skips when @Public() is set', () => {
    const ctx = makeContext({
      user: undefined,
      handlerMetadata: { isPublic: true },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('throws when no user attached', () => {
    const ctx = makeContext({ user: undefined });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  test('passes when @Roles matches user', () => {
    const ctx = makeContext({
      user: STAFF,
      handlerMetadata: { roles: ['STAFF', 'BUSINESS_OWNER'] },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('throws when @Roles does not match', () => {
    const ctx = makeContext({
      user: CUSTOMER,
      handlerMetadata: { roles: ['STAFF'] },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  test('enforces @RequireScope new shape (BRANCH)', () => {
    const ctx = makeContext({
      user: STAFF,
      params: { branchId: 'br-1' },
      handlerMetadata: {
        'rbac:scope': { level: 'BRANCH', branchIdParam: 'branchId' },
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('blocks cross-tenant access via @RequireScope', () => {
    const ctx = makeContext({
      user: STAFF,
      params: { branchId: 'br-99' },
      handlerMetadata: {
        'rbac:scope': { level: 'BRANCH', branchIdParam: 'branchId' },
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  test('accepts back-compat @RequireScope with roles[]', () => {
    const ctx = makeContext({
      user: STAFF,
      handlerMetadata: {
        'rbac:scope': {
          roles: ['STAFF', 'BUSINESS_OWNER'],
          scopeLevel: 'branch',
          permissions: ['booking:read:branch'],
        },
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('ScopeGuard', () => {
  let guard: ScopeGuard;
  beforeEach(() => {
    guard = new ScopeGuard(new Reflector());
  });

  test('skips when no metadata', () => {
    const ctx = makeContext({ user: STAFF });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('skips when @Public() is set', () => {
    const ctx = makeContext({
      user: undefined,
      handlerMetadata: { isPublic: true },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('blocks when scope does not match', () => {
    const ctx = makeContext({
      user: STAFF,
      params: { branchId: 'br-99' },
      handlerMetadata: {
        'rbac:scope': { level: 'BRANCH', branchIdParam: 'branchId' },
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('PolicyGuard', () => {
  let guard: PolicyGuard;
  beforeEach(() => {
    guard = new PolicyGuard(new Reflector());
  });

  test('skips when no metadata', () => {
    const ctx = makeContext({ user: STAFF });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('passes when ANY required permission resolves', () => {
    const ctx = makeContext({
      user: STAFF,
      params: { branchId: 'br-1' },
      handlerMetadata: {
        requires_permission: ['booking:update:platform', 'booking:update:branch'],
        'rbac:permission:context': { branchIdParam: 'branchId' },
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('blocks when none of the required permissions resolve', () => {
    const ctx = makeContext({
      user: STAFF,
      params: { branchId: 'br-99' },
      handlerMetadata: {
        requires_permission: ['booking:update:branch'],
        'rbac:permission:context': { branchIdParam: 'branchId' },
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
