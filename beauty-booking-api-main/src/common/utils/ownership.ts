import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import { can, cannot } from './policy';
import { resolveBusinessIdByBranch } from './multi-tenancy';

/**
 * Booking row carrying enough fields to verify ownership/scope.
 * We intentionally do not require the full Prisma type — services may
 * project a subset of fields.
 */
export interface BookingScopeHint {
  id: string;
  customerId: string;
  branchId: string;
}

/**
 * Verify the principal can access a specific booking. Used as the
 * second-layer (service-layer) ownership check after the gateway guard
 * has passed.
 *
 * Rules:
 *  - Customer: own booking only.
 *  - Staff/Receptionist: branch-scoped role AND branch belongs
 *    to a tenant the user has access to.
 *  - Owner: tenant-scoped role covering the booking's branch.
 *  - Platform roles: always allowed (PLATFORM_ADMIN etc).
 */
export async function assertCanAccessBooking(
  prisma: PrismaService,
  user: AuthUser,
  bookingId: string,
): Promise<{ booking: BookingScopeHint; businessId: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      branchId: true,
      deletedAt: true,
    },
  });
  if (!booking || booking.deletedAt) {
    throw new NotFoundException('Booking không tồn tại');
  }
  const businessId = await resolveBusinessIdByBranch(prisma, booking.branchId);

  // Customer: own booking.
  if (
    user.roles.includes('CUSTOMER') &&
    !user.roles.some((r) =>
      ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'].includes(
        r,
      ),
    )
  ) {
    // Look up the customer profile to confirm ownership.
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { id: booking.customerId },
      select: { userId: true },
    });
    if (!customerProfile || customerProfile.userId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền truy cập booking này');
    }
    return { booking, businessId };
  }

  // Platform roles: always allowed.
  if (
    user.roles.includes('PLATFORM_ADMIN')
  ) {
    return { booking, businessId };
  }

  // Salon roles: scope must include this branch/tenant.
  const platformLike = new Set([
    'PLATFORM_ADMIN',
  ]);
  const ok = user.scopes.some((s) => {
    if (platformLike.has(s.code)) return true;
    if (s.branchId === booking.branchId) return true;
    // Tenant-wide role
    if (!s.branchId && s.businessId === businessId) return true;
    return false;
  });
  if (!ok) {
    throw new ForbiddenException('Bạn không có quyền truy cập booking này');
  }
  return { booking, businessId };
}

/**
 * Convenience wrapper around `can()` for the bookings module.
 */
export function assertCan(
  user: AuthUser,
  code:
    | 'booking:update:self'
    | 'booking:cancel:self'
    | 'booking:read:self'
    | 'booking:reschedule:self',
  ownerId: string,
): void {
  if (!can(user, code, { ownerId })) {
    throw new ForbiddenException(`Bạn không có quyền thực hiện hành động "${code}"`);
  }
}

/**
 * Service-layer assertion: principal may mutate the booking. Wraps
 * `policy.cannot` for the standard write actions.
 */
export function assertCanMutateBooking(
  user: AuthUser,
  action:
    | 'booking:update:branch'
    | 'booking:update:tenant'
    | 'booking:cancel:branch'
    | 'booking:cancel:tenant'
    | 'booking:assign:branch'
    | 'booking:assign:tenant'
    | 'booking:check_in:branch'
    | 'booking:complete:branch'
    | 'booking:reschedule:branch',
  ctx: { tenantId?: string; branchId?: string; ownerId?: string },
): void {
  cannot(user, action, ctx);
}
