import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import type { ScopedRole } from '../../auth/jwt.strategy';
import type { RoleCode } from '@prisma/client';

/**
 * Marker returned by `resolveBusinessIdsForUser` to mean "ALL tenants".
 * Callers must explicitly opt-in to bypass tenant isolation (admin).
 */
export const ALL_TENANTS = '__ALL__';

/**
 * Multi-tenancy filter cứng — ngăn chặn lổ hổng phân quyền phổ biến:
 *  - Client truyền salon_id bất kỳ lên server, server không lọc → lộ dữ liệu salon khác.
 *
 * Quy tắc (RBAC + Scope aware):
 *  - PLATFORM_* roles: trả marker `__ALL__`.
 *  - BUSINESS_OWNER / BRANCH_MANAGER / RECEPTIONIST / STAFF: BUỘC có
 *    `UserRole` (scoped) cho tenant đó.
 *  - CUSTOMER: không có business scope.
 *
 * Trả về danh sách businessId mà user được phép thao tác.
 */
export async function resolveBusinessIdsForUser(
  prisma: PrismaService,
  user: AuthUser,
): Promise<string[]> {
  const platformRoles = new Set([
    'PLATFORM_ADMIN',
  ]);
  if (user.roles.some((r) => platformRoles.has(r))) {
    return [ALL_TENANTS];
  }

  const tenantRoles = new Set([
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
    'STAFF',
  ]);
  if (user.roles.some((r) => tenantRoles.has(r))) {
    const tenantIds = new Set<string>();
    for (const s of user.scopes ?? []) {
      if (s.businessId) tenantIds.add(s.businessId);
    }
    if (tenantIds.size === 0) {
      // A newly registered owner receives a role before their draft business
      // exists, so the JWT scope is temporarily empty. Resolve ownership from
      // the database as well as legacy memberships; both relations are bound
      // to the authenticated user and therefore preserve tenant isolation.
      const ownerLookup = user.roles.includes('BUSINESS_OWNER')
        ? prisma.businessOwnerProfile.findUnique({
            where: { userId: user.id },
            select: {
              businesses: {
                where: { deletedAt: null },
                select: { id: true },
              },
            },
          })
        : Promise.resolve(null);
      const [memberships, owner] = await Promise.all([
        prisma.salonMember.findMany({
          where: { userId: user.id, isActive: true, deletedAt: null },
          select: { businessId: true },
        }),
        ownerLookup,
      ]);
      return [
        ...new Set([
          ...memberships.map((membership) => membership.businessId),
          ...(owner?.businesses ?? []).map((business) => business.id),
        ]),
      ];
    }
    return [...tenantIds];
  }

  return [];
}

/**
 * Verify user có quyền thao tác trên businessId.
 * Throw ForbiddenException nếu không hợp lệ.
 */
export async function assertBusinessAccess(
  prisma: PrismaService,
  user: AuthUser,
  businessId: string,
): Promise<void> {
  const allowedIds = await resolveBusinessIdsForUser(prisma, user);

  if (allowedIds.includes(ALL_TENANTS)) {
    return; // admin
  }
  if (!allowedIds.includes(businessId)) {
    throw new ForbiddenException(
      'Bạn không có quyền truy cập dữ liệu của cơ sở này',
    );
  }
}

/**
 * Tìm businessId từ branchId (helper phổ biến khi filter booking theo branch).
 */
export async function resolveBusinessIdByBranch(
  prisma: PrismaService,
  branchId: string,
): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { businessId: true },
  });
  if (!branch) {
    throw new NotFoundException('Chi nhánh không tồn tại');
  }
  return branch.businessId;
}

// ============================================================
// New helpers (RBAC + Scope)
// ============================================================

/**
 * Returns a Prisma `where` clause that limits results to the user's
 * tenant scope. Use in service-layer queries:
 *
 *   await prisma.booking.findMany({
 *     where: tenantScope(allowedIds, { branchId, status }),
 *   });
 *
 * @param allowedIds   businessIds the user can access (from resolveBusinessIdsForUser)
 * @param extra        other filters to merge
 */
export function tenantScope(
  allowedIds: string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...extra };
  if (allowedIds.includes(ALL_TENANTS)) {
    return base;
  }
  if (allowedIds.length === 0) {
    // User has no tenant scope → return a clause that always matches nothing.
    return { ...base, id: { in: [] } };
  }
  // Caller must wire `branch: { businessId: { in: allowedIds } }` themselves
  // because Prisma where shapes differ per model.
  return { ...base, _allowedBusinessIds: allowedIds } as Record<string, unknown>;
}

/**
 * Convenience: returns a Prisma `where` fragment for branches accessible
 * to the user. Use `branch: tenantBranchScope(prisma, user)` on booking
 * queries.
 */
export async function tenantBranchScope(
  prisma: PrismaService,
  user: AuthUser,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const allowed = await resolveBusinessIdsForUser(prisma, user);
  if (allowed.includes(ALL_TENANTS)) return extra;
  if (allowed.length === 0) return { ...extra, id: { in: [] } };
  const branches = await prisma.branch.findMany({
    where: { businessId: { in: allowed }, deletedAt: null },
    select: { id: true },
  });
  return { ...extra, id: { in: branches.map((b) => b.id) } };
}

/**
 * Resolve the list of branch IDs the user can touch within a specific
 * tenant (business). Used by tenant-scoped controllers that pre-filter
 * branch lists before forwarding to service queries.
 */
export async function resolveBranchIdsForUser(
  prisma: PrismaService,
  user: AuthUser,
  businessId: string,
): Promise<string[] | null> {
  const platformRoles = new Set([
    'PLATFORM_ADMIN',
  ]);
  if (user.roles.some((r) => platformRoles.has(r))) {
    return null; // null = no filter (full access)
  }
  const branchScoped = new Set(['BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF']);
  const tenantWide = new Set(['BUSINESS_OWNER']);
  if (user.roles.some((r) => branchScoped.has(r))) {
    const userBranches = new Set<string>();
    for (const s of user.scopes ?? []) {
      if (s.branchId && s.businessId === businessId) userBranches.add(s.branchId);
    }
    // Merge current database scopes so a newly granted branch assignment is
    // effective immediately, without waiting for the access token to rotate.
    const [roleScopes, memberships] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          userId: user.id,
          businessId,
          branchId: { not: null },
          role: { code: { in: [...branchScoped] as RoleCode[] } },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { branchId: true },
      }),
      prisma.salonMember.findMany({
        where: {
          userId: user.id,
          businessId,
          isActive: true,
          deletedAt: null,
          branchId: { not: null },
        },
        select: { branchId: true },
      }),
    ]);
    for (const scope of roleScopes) if (scope.branchId) userBranches.add(scope.branchId);
    for (const membership of memberships) if (membership.branchId) userBranches.add(membership.branchId);
    return [...userBranches];
  }
  if (user.roles.some((r) => tenantWide.has(r))) {
    const branches = await prisma.branch.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true },
    });
    return branches.map((b) => b.id);
  }
  return [];
}

/**
 * Throw if `entity.businessId` is not in `allowedIds`. Used after the
 * service fetches an entity to confirm the user can see it.
 */
export function assertSameTenant(
  entity: { businessId?: string | null } | null | undefined,
  allowedIds: string[],
  resource: string,
): void {
  if (!entity) throw new NotFoundException(`${resource} không tồn tại`);
  if (allowedIds.includes(ALL_TENANTS)) return;
  if (!entity.businessId || !allowedIds.includes(entity.businessId)) {
    throw new ForbiddenException(
      `Bạn không có quyền truy cập ${resource} này`,
    );
  }
}

/**
 * Resolve the tenant/branch scope that matches a user-role assignment.
 * Returns the first role assignment whose `code` matches `roleCode`,
 * or `null` if none.
 */
export function pickScope(
  user: AuthUser,
  roleCode: string,
): ScopedRole | null {
  return user.scopes?.find((s) => s.code === roleCode) ?? null;
}

/**
 * Does the user hold `roleCode` for the given tenant (business)?
 */
export function hasRoleAtTenant(
  user: AuthUser,
  roleCode: string,
  tenantId: string,
): boolean {
  return !!user.scopes?.some(
    (s) => s.code === roleCode && s.businessId === tenantId,
  );
}

/**
 * Does the user hold `roleCode` for the given branch?
 */
export function hasRoleAtBranch(
  user: AuthUser,
  roleCode: string,
  branchId: string,
): boolean {
  return !!user.scopes?.some(
    (s) => s.code === roleCode && s.branchId === branchId,
  );
}

/**
 * Verify the user has access to a specific branch. Used as the service
 * layer second-defense for branch-scoped reads/writes. Resolves the
 * branch's tenant first to ensure tenant-wide roles (e.g. owner) can
 * pass for any branch in their business.
 */
export async function assertBranchAccess(
  prisma: PrismaService,
  user: AuthUser,
  branchId: string,
): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { businessId: true },
  });
  if (!branch) {
    throw new NotFoundException('Chi nhánh không tồn tại');
  }
  await assertBusinessAccess(prisma, user, branch.businessId);
  const allowedBranchIds = await resolveBranchIdsForUser(
    prisma,
    user,
    branch.businessId,
  );
  if (allowedBranchIds !== null && !allowedBranchIds.includes(branchId)) {
    throw new ForbiddenException(
      'Bạn không có quyền truy cập chi nhánh này',
    );
  }
  return branch.businessId;
}
