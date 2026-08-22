import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/current-user.decorator';
import { can, CannotError } from '../utils/policy';
import { REQUIRES_PERMISSION_KEY } from '../decorators/permission.decorator';

/**
 * Optional: a path that, when present, supplies the resource id for
 * OWN-scope checks. Sets metadata via `@PermissionContext({ ownerIdParam: 'userId' })`.
 */
export const PERMISSION_CONTEXT_KEY = 'rbac:permission:context';

export interface PermissionContextSpec {
  tenantIdParam?: string;
  branchIdParam?: string;
  ownerIdParam?: string;
}

export const PermissionContext = (spec: PermissionContextSpec) =>
  // Reuse the PERMISSION_KEY metadata slot; the guard merges it with the
  // base permission codes.
  (target: any, key?: any, descriptor?: any) => {
    Reflect.defineMetadata(PERMISSION_CONTEXT_KEY, spec, descriptor?.value ?? target);
  };

/**
 * Guard that invokes `policy.can(user, code, context)`. Runs after
 * JwtAuthGuard so `req.user` is populated.
 *
 * The list of required permission codes is read from `@RequirePermission(...)`
 * (variadic). For OWN-scope checks, additionally decorate with
 * `@PermissionContext({ ownerIdParam: 'userId' })` to specify where to
 * resolve the owner.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const codes = this.reflector.getAllAndOverride<string[]>(
      REQUIRES_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!codes || codes.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Không xác định được người dùng');

    const spec = this.reflector.getAllAndOverride<PermissionContextSpec>(
      PERMISSION_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? {};

    const ctx = {
      tenantId: spec.tenantIdParam
        ? request.params?.[spec.tenantIdParam] ??
          (request.body?.[spec.tenantIdParam] as string | undefined)
        : undefined,
      branchId: spec.branchIdParam
        ? request.params?.[spec.branchIdParam] ??
          (request.body?.[spec.branchIdParam] as string | undefined)
        : undefined,
      ownerId: spec.ownerIdParam
        ? request.params?.[spec.ownerIdParam] ??
          (request.body?.[spec.ownerIdParam] as string | undefined)
        : undefined,
    };

    // Allow if ANY of the codes resolves to true.
    let ok = false;
    for (const code of codes) {
      try {
        if (can(user, code, ctx)) {
          ok = true;
          break;
        }
      } catch (err) {
        if (err instanceof CannotError) {
          continue;
        }
        throw err;
      }
    }
    if (!ok) {
      throw new ForbiddenException(`Yêu cầu một trong các quyền: ${codes.join(', ')}`);
    }
    return true;
  }
}