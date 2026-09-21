import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPE_KEY, ScopeRequirement } from '../decorators/scope.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Standalone ScopeGuard — use when a route requires scope but NOT
 * a specific role code (rare). Most routes should keep using
 * RolesGuard which delegates here internally.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requirement = this.reflector.getAllAndOverride<ScopeRequirement>(
      SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Không xác định được người dùng');

    if (requirement.roles?.length) {
      const hasRequiredRole = requirement.roles.some((role) =>
        user.roles.includes(role),
      );
      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Yêu cầu role: ${requirement.roles.join(', ')}`,
        );
      }
    }

    const tenantId =
      requirement.tenantId ??
      (requirement.tenantIdParam ? request.params[requirement.tenantIdParam] : undefined) ??
      request.headers?.['x-business-id'] ??
      request.params?.businessId ??
      request.body?.businessId;
    const branchId =
      requirement.branchId ??
      (requirement.branchIdParam ? request.params[requirement.branchIdParam] : undefined) ??
      request.headers?.['x-branch-id'] ??
      request.params?.branchId ??
      request.params?.id ??
      request.body?.branchId;

    const level =
      requirement.level ?? requirement.scopeLevel?.toUpperCase();

    const ok = user.scopes.some((s) => {
      if (requirement.roles?.length && !requirement.roles.includes(s.code)) return false;
      if (!user.roles.includes(s.code)) return false;
      if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) {
        return false;
      }
      switch (level) {
        case 'PLATFORM':
          return s.code === 'PLATFORM_ADMIN';
        case 'TENANT':
          return !!tenantId && (s.businessId === tenantId || s.code === 'PLATFORM_ADMIN');
        case 'BRANCH':
          if (!branchId) return false;
          if (s.branchId === branchId || s.code === 'PLATFORM_ADMIN') return true;
          // A tenant-wide role is allowed through this coarse guard only when
          // the request also identifies the matching tenant. The service must
          // still verify that the branch belongs to that tenant.
          return s.code === 'BUSINESS_OWNER' && !!tenantId && s.businessId === tenantId && !s.branchId;
        case 'SELF':
          return ['CUSTOMER'].includes(s.code);
        case 'PUBLIC':
          return true;
        default:
          return false;
      }
    });

    if (!ok) {
      throw new ForbiddenException(
        `Yêu cầu scope ${level}` +
          (tenantId ? ` cho tenant ${tenantId}` : '') +
          (branchId ? ` / branch ${branchId}` : ''),
      );
    }
    return true;
  }
}
