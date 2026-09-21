import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPE_KEY, ScopeRequirement } from '../decorators/scope.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { isCustomerPrincipal } from '../../auth/account-separation';

/**
 * Composite coarse-grained guard that:
 *  - skips when @Public()
 *  - enforces @Roles() if present (back-compat)
 *  - enforces @RequireScope() if present — this is the new RBAC+Scope
 *    coarse-grained layer (supports both the new `{ level }` shape and
 *    the back-compat `{ roles, scopeLevel, permissions }` shape).
 *
 * Services are still expected to perform the second-layer ownership
 * checks (e.g. `BookingsAccessService.assertWrite(...)`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Không xác định được người dùng');
    }

    // ----- @Roles() -----
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => role === 'CUSTOMER'
        ? isCustomerPrincipal(user) : user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException(
          `Yêu cầu quyền: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // ----- @RequireScope() -----
    const scopeRequirement = this.reflector.getAllAndOverride<ScopeRequirement>(
      SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (scopeRequirement) {
      // Back-compat shape: { roles, scopeLevel, permissions }
      if (scopeRequirement.roles || scopeRequirement.permissions) {
        const hasRole =
          !scopeRequirement.roles ||
          scopeRequirement.roles.length === 0 ||
          scopeRequirement.roles.some((r) => r === 'CUSTOMER'
            ? isCustomerPrincipal(user) : user.roles.includes(r));
        if (!hasRole) {
          throw new ForbiddenException(
            `Yêu cầu role: ${scopeRequirement.roles?.join(', ')}`,
          );
        }
        // The PermissionGuard (PolicyGuard) will further verify the
        // permission codes — at the gateway we accept the role check.
        return true;
      }
      // NEW shape: { level, tenantIdParam, branchIdParam }
      this.enforceScope(user, scopeRequirement, request);
    }

    return true;
  }

  /**
   * Enforce scope: a user's `scopes[]` must contain at least one role
   * matching the route's required scope.
   */
  private enforceScope(
    user: AuthUser,
    requirement: ScopeRequirement,
    request: { params: Record<string, string>; body: Record<string, unknown> },
  ): void {
    const tenantId =
      requirement.tenantId ??
      (requirement.tenantIdParam
        ? request.params[requirement.tenantIdParam] ??
          (request.body?.[requirement.tenantIdParam] as string | undefined)
        : undefined);

    const branchId =
      requirement.branchId ??
      (requirement.branchIdParam
        ? request.params[requirement.branchIdParam] ??
          (request.body?.[requirement.branchIdParam] as string | undefined)
        : undefined);

    const matching = user.scopes.find((s) => {
      if (!user.roles.includes(s.code)) return false;
      if (s.expiresAt && !(new Date(s.expiresAt).getTime() > Date.now())) return false;
      if (requirement.roles?.length && !requirement.roles.includes(s.code)) return false;
      switch (requirement.level) {
        case 'PLATFORM':
          return s.code === 'PLATFORM_ADMIN';
        case 'TENANT':
          if (!tenantId) return false;
          if (s.businessId === tenantId) return true;
          return ['PLATFORM_ADMIN'].includes(s.code);
        case 'BRANCH':
          if (!branchId) return false;
          if (s.branchId === branchId) return true;
          if (s.code === 'BUSINESS_OWNER' && s.businessId && !s.branchId) {
            return !!tenantId && s.businessId === tenantId;
          }
          return ['PLATFORM_ADMIN'].includes(s.code);
        case 'SELF':
          return s.code === 'CUSTOMER' && isCustomerPrincipal(user);
        case 'PUBLIC':
          return true;
        default:
          return false;
      }
    });

    if (!matching) {
      throw new ForbiddenException(
        `Yêu cầu scope ${requirement.level}` +
          (tenantId ? ` cho tenant ${tenantId}` : '') +
          (branchId ? ` / branch ${branchId}` : ''),
      );
    }
  }
}
