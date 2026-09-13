import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import {
  PERMISSIONS,
  PERMISSION_CODE_SET,
  findPermission,
  ROLE_PERMISSIONS,
} from '../permissions/permission-catalog';

// ============================================================
// Cancellation policy (kept from the previous skeleton)
// ============================================================

export interface CancellationDecision {
  policy: 'allowed' | 'warn_late_cancel' | 'too_late';
  feePercent: number; // 0..100
  hoursBeforeStart: number;
  feeAmount: number | null; // decimal khi áp dụng
  notes?: string;
}

/**
 * Resolve cancellation timing policy. Cancellation/no-show fees are retired;
 * this helper only determines whether the request is within the cutoff.
 */
export async function resolveCancellationPolicy(
  prisma: PrismaService,
  businessId: string,
  bookingTotalAmount: number,
  appointmentStartTime: Date,
  now: Date = new Date(),
  defaultFreeCancelHours = 2,
): Promise<CancellationDecision> {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { businessId },
  });

  const freeHours = policy?.freeCancelHours ?? defaultFreeCancelHours;
  const rescheduleHours = policy?.rescheduleAllowedHours ?? 1;

  const diffMs = appointmentStartTime.getTime() - now.getTime();
  const hoursBeforeStart = diffMs / (60 * 60 * 1000);

  if (diffMs < 0) {
    return {
      policy: 'too_late',
      feePercent: 0,
      hoursBeforeStart,
      feeAmount: 0,
      notes: 'Không thể huỷ sau giờ hẹn. Vui lòng liên hệ cơ sở.',
    };
  }

  if (hoursBeforeStart < freeHours) {
    return {
      policy: 'warn_late_cancel',
      feePercent: 0,
      hoursBeforeStart,
      feeAmount: 0,
      notes: `Huỷ trong vòng ${freeHours}h trước giờ hẹn. Vui lòng liên hệ cơ sở để được hỗ trợ. Reschedule phải trước ${rescheduleHours}h.`,
    };
  }

  return {
    policy: 'allowed',
    feePercent: 0,
    hoursBeforeStart,
    feeAmount: 0,
    notes:
      policy?.notes ??
      `Huỷ miễn phí (trước ${freeHours}h). Reschedule phải trước ${rescheduleHours}h.`,
  };
}

/**
 * Resolve thời gian tối thiểu để cho phép đổi lịch.
 */
export async function resolveRescheduleCutoffHours(
  prisma: PrismaService,
  businessId: string,
): Promise<number> {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { businessId },
  });
  return policy?.rescheduleAllowedHours ?? 1;
}

// ============================================================
// RBAC + Scope — `can` / `cannot`
// ============================================================

export interface PolicyContext {
  /** Tenant (business) the resource belongs to. */
  tenantId?: string;
  /** Branch the resource belongs to. */
  branchId?: string;
  /** Owner userId (for `OWN` scope — typically the booking customer). */
  ownerId?: string;
}

/** Thrown by `can` callers that want a structured error rather than a boolean. */
export class CannotError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CannotError';
  }
}

const PLATFORM_LIKE = new Set([
  'PLATFORM_ADMIN',
]);

/**
 * Returns true if the principal has any scope variant of `code` that
 * also satisfies the resource's tenant/branch context.
 *
 * Logic:
 *  - Resolve the catalog entry for `code`.
 *  - Walk the principal's `scopes[]` and check that at least one role
 *    grants `code` AND matches the tenant/branch requirements derived
 *    from `defaultScope` and the runtime context.
 *  - For `SELF` scope, the principal must be the resource owner (e.g.
 *    the booking's customer).
 */
export function can(user: AuthUser, code: string, ctx: PolicyContext = {}): boolean {
  if (!user) return false;
  if (!PERMISSION_CODE_SET.has(code)) {
    // Unknown permission: deny by default (fail closed).
    return false;
  }

  const entry = findPermission(code);
  if (!entry) return false;

  const hasContext = !!(ctx.tenantId || ctx.branchId || ctx.ownerId);
  // Direct user grants are intentionally restricted to PLATFORM permissions.
  // Never use the flattened `permissions` list to bypass TENANT/BRANCH/SELF
  // checks because that list also contains permissions expanded from roles.
  if (
    (!hasContext || entry.defaultScope === 'PLATFORM') &&
    user.permissions?.includes(code)
  ) {
    return true;
  }
  if (!user.scopes || user.scopes.length === 0) return false;

  const now = Date.now();
  const activeGrants = user.scopes.filter((sr) => {
    if (sr.expiresAt && new Date(sr.expiresAt).getTime() <= now) return false;
    return roleGrantsPermission(sr.code, code);
  });

  // Guards frequently perform a coarse permission check before a controller
  // has loaded the resource. In that case ownership/scope is enforced by the
  // service once tenantId/branchId/ownerId is known. Denying here would make
  // every valid SELF/TENANT/BRANCH permission return 403 prematurely.
  if (!hasContext) {
    return activeGrants.length > 0;
  }

  for (const sr of activeGrants) {

    switch (entry.defaultScope) {
      case 'PLATFORM':
        if (PLATFORM_LIKE.has(sr.code)) return true;
        break;
      case 'TENANT':
        if (PLATFORM_LIKE.has(sr.code)) return true;
        if (sr.businessId && sr.businessId === ctx.tenantId) return true;
        break;
      case 'BRANCH':
        if (PLATFORM_LIKE.has(sr.code)) return true;
        if (sr.branchId && sr.branchId === ctx.branchId) return true;
        // Tenant-wide role on the same tenant still grants branch scope.
        if (sr.businessId && sr.businessId === ctx.tenantId && !sr.branchId) return true;
        break;
      case 'SELF':
        if (ctx.ownerId && ctx.ownerId === user.id) return true;
        break;
      case 'PUBLIC':
        return true;
    }
  }
  return false;
}

/** Inverse — throws a `CannotError` when denied. */
export function cannot(user: AuthUser, code: string, ctx: PolicyContext = {}): never | void {
  if (!can(user, code, ctx)) {
    throw new CannotError(code, `Bạn không có quyền thực hiện hành động "${code}"`);
  }
}

/**
 * Pure catalog lookup: does `roleCode` grant `permissionCode`?
 */
export function roleGrantsPermission(roleCode: string, permissionCode: string): boolean {
  const perms = ROLE_PERMISSIONS[roleCode];
  if (!perms) return false;
  return perms.includes(permissionCode);
}

/**
 * List all permissions granted by a set of role codes (catalog only,
 * does not consider tenant/branch scope).
 */
export function expandRolePermissions(roleCodes: readonly string[]): string[] {
  const out = new Set<string>();
  for (const code of roleCodes) {
    const perms = ROLE_PERMISSIONS[code];
    if (perms) perms.forEach((p) => out.add(p));
  }
  return [...out];
}

/**
 * List all permission codes known to the system.
 */
export function allPermissionCodes(): string[] {
  return PERMISSIONS.map((p) => p.code);
}

// ============================================================
// canOnResource / ensureCanOnResource — back-compat with the
// `BookingsAccessService` introduced in the earlier draft.
// ============================================================

export interface ResourceContext {
  businessId?: string | null;
  branchId?: string | null;
  /** Owner user id (e.g. customer for bookings). */
  ownerUserId?: string | null;
  /** Staff user id assigned to the resource (used by `OWN` scope). */
  staffUserId?: string | null;
}

/**
 * Like `can()` but accepts a resource context (used by services that
 * already loaded the row). Maps the resource fields to PolicyContext.
 */
export function canOnResource(
  user: AuthUser,
  code: string,
  resource: ResourceContext,
): boolean {
  return can(user, code, {
    tenantId: resource.businessId ?? undefined,
    branchId: resource.branchId ?? undefined,
    ownerId: resource.ownerUserId ?? undefined,
  });
}

/**
 * Throws ForbiddenException if denied. Convenience wrapper used by
 * service-layer access guards.
 */
export function ensureCanOnResource(
  user: AuthUser,
  code: string,
  resource: ResourceContext,
): void {
  if (!canOnResource(user, code, resource)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ForbiddenException } = require('@nestjs/common');
    throw new ForbiddenException(
      `Bạn không có quyền thực hiện hành động "${code}" trên tài nguyên này`,
    );
  }
}
