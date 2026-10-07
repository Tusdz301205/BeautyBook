import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../decorators/current-user.decorator';
import { canOnResource } from '../utils/policy';

export const ACTUAL_TIME_CORRECT_PERMISSION = 'booking.actual_time.correct';
type PermissionReader = Pick<Prisma.TransactionClient, 'userRole' | 'bookingActualTimeGrant'>;
export type ActualTimeResource = { businessId: string; branchId: string; staffUserId?: string | null };

export async function assertActualTimeGrantOwner(db: Pick<Prisma.TransactionClient, 'userRole'>, user: AuthUser, businessId: string) {
  if (user.sessionType !== 'salon' || (user.workspace && user.workspace !== 'SALON') ||
      (user.businessId && user.businessId !== businessId) ||
      !canOnResource(user, ACTUAL_TIME_CORRECT_PERMISSION, { businessId })) {
    throw new ForbiddenException('Chỉ chủ doanh nghiệp đúng phạm vi được cấp quyền đính chính');
  }
  const now = new Date();
  const role = await db.userRole.findFirst({ where: { userId: user.id, businessId, branchId: null,
    role: { code: 'BUSINESS_OWNER' }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    include: { role: { select: { code: true } } } });
  if (!role || role.businessId !== businessId || role.branchId || role.role.code !== 'BUSINESS_OWNER' ||
      (role.expiresAt && role.expiresAt <= now)) throw new ForbiddenException('Quyền chủ doanh nghiệp không còn hiệu lực');
}

/** Only this permission consumes scoped direct grants. Global RBAC stays unchanged. */
export async function assertActualTimeCorrectionPermission(db: PermissionReader, user: AuthUser, resource: ActualTimeResource) {
  if (user.sessionType !== 'salon' || (user.workspace && user.workspace !== 'SALON') ||
      (user.businessId && user.businessId !== resource.businessId) ||
      (user.branchId && user.branchId !== resource.branchId) || resource.staffUserId === user.id) {
    throw new ForbiddenException('Không được đính chính thời gian thực tế trong phạm vi này hoặc dịch vụ của chính mình');
  }
  const now = new Date();
  const roles = await db.userRole.findMany({ where: {
    userId: user.id, businessId: resource.businessId,
    role: { code: { in: ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'] } },
    AND: [{ OR: [{ branchId: null }, { branchId: resource.branchId }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  }, include: { role: { select: { code: true } } } });
  // Check the rows as well as the query: role and resource must be one live grant.
  const scoped = roles.filter(role => role.businessId === resource.businessId &&
    (!role.branchId || role.branchId === resource.branchId) &&
    (!role.expiresAt || role.expiresAt > now) &&
    ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'].includes(role.role.code));
  if (scoped.some(role => role.role.code === 'BUSINESS_OWNER' && !role.branchId) &&
      canOnResource(user, ACTUAL_TIME_CORRECT_PERMISSION, resource)) return;
  if (!scoped.length) throw new ForbiddenException('Không có vai trò vận hành còn hiệu lực tại chi nhánh');
  const grant = await db.bookingActualTimeGrant.findFirst({ where: {
    userId: user.id, revokedAt: null,
    businessId: resource.businessId,
    AND: [{ OR: [{ branchId: null }, { branchId: resource.branchId }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  } });
  if (!grant || grant.userId !== user.id ||
      grant.revokedAt || (grant.expiresAt && grant.expiresAt <= now) ||
      grant.businessId !== resource.businessId || (grant.branchId && grant.branchId !== resource.branchId)) {
    throw new ForbiddenException('Yêu cầu quyền booking.actual_time.correct được cấp trong phạm vi còn hiệu lực');
  }
}
