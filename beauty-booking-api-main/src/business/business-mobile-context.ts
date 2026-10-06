import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { assertBusinessAccess, restrictToRoles } from '../common/utils/multi-tenancy';

export async function readMobileBusinessContext(prisma: PrismaService, user: AuthUser) {
  if (user.workspace !== 'SALON' || user.sessionType !== 'salon' || !user.roles.includes('BUSINESS_OWNER')) {
    throw new ForbiddenException('Chỉ chủ doanh nghiệp trong phiên vận hành được đọc ngữ cảnh này');
  }
  const principal = restrictToRoles(user, ['BUSINESS_OWNER']);
  const select = { id: true, name: true, status: true, bookingRestrictedAt: true } as const;
  if (user.businessId) {
    await assertBusinessAccess(prisma, principal, user.businessId);
    const value = await prisma.business.findFirst({ where: { id: user.businessId, deletedAt: null }, select });
    return value ? { id: value.id, name: value.name, status: value.status, bookingRestricted: Boolean(value.bookingRestrictedAt) } : null;
  }
  if (!(principal.scopes ?? []).some(scope => scope.code === 'BUSINESS_OWNER' && !scope.businessId &&
    (!scope.expiresAt || Date.parse(scope.expiresAt) > Date.now()))) throw new ForbiddenException('Không còn quyền tạo hồ sơ doanh nghiệp');
  const owner = await prisma.businessOwnerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!owner) return null;
  const value = await prisma.business.findFirst({ where: { ownerId: owner.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, select });
  return value ? { id: value.id, name: value.name, status: value.status, bookingRestricted: Boolean(value.bookingRestrictedAt) } : null;
}
