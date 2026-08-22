import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ScopedRole } from '../../auth/jwt.strategy';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  /** Plain role codes — back-compat for JwtAuthGuard. */
  roles: string[];
  /**
   * RBAC+Scope: each role carries the tenant (business) / branch scope
   * it was granted at. Missing scope = platform/tenant-wide.
   */
  scopes: ScopedRole[];
  sessionType: 'admin' | 'salon' | 'customer';
  /** Server-validated workspace bound to this login session. */
  workspace?: 'CUSTOMER' | 'SALON' | 'PLATFORM';
  businessId?: string | null;
  branchId?: string | null;
  /** Optional — populated by services that resolve the full permission set. */
  permissions?: string[];
  /** Current revocable login session. */
  sessionId?: string;
}

/**
 * Extract the authenticated user attached by JwtStrategy.
 * Usage: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
