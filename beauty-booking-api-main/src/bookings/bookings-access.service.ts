import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  canOnResource,
  ensureCanOnResource,
} from '../common/utils/policy';
import {
  assertBusinessAccess,
  resolveBusinessIdByBranch,
} from '../common/utils/multi-tenancy';
import { PLATFORM_ROLE_CODES } from '../common/utils/scope-helpers';

interface BookingRow {
  id: string;
  branchId: string;
  customerId: string;
  businessId?: string | null;
}

/**
 * Service-level enforcement for booking reads/writes — the second defense
 * layer described in plan §0. Guard-level checks (RolesGuard/PolicyGuard)
 * are coarse-grained; ownership and exact scope is decided here.
 *
 * Matrix mapping (extended §3.1):
 *   Customer       → :self    (their own bookings)
 *   Staff          → :own     (bookings where assigned staffUserId == user.id)
 *   Receptionist   → :branch  (any booking of their branch)
 *   Branch Mgr     → :tenant  (any booking of any branch in their business)
 *   Owner          → :tenant
 *   Support/Finance→ :platform (read-only by default; writes need booking:refund:platform)
 *   PLATFORM_ADMIN → :platform
 */
@Injectable()
export class BookingsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load a booking + verify the caller is allowed to see it. Returns the
   * enriched row (incl. businessId, customerUserId, staffUserId) so callers
   * don't have to re-query.
   */
  async loadAndAssert(
    user: AuthUser,
    bookingId: string,
    permissionCode:
      | 'booking:read:self'
      | 'booking:read:branch'
      | 'booking:read:tenant'
      | 'booking:read:platform',
  ): Promise<{
    bookingId: string;
    businessId: string;
    branchId: string;
    customerUserId: string;
    staffUserId: string | null;
  }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        customer: { select: { userId: true } },
        bookingServices: { select: { staffId: true } },
        branch: { select: { businessId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const customerUserId = booking.customer.userId;
    const staffAssignments = booking.bookingServices
      .map((bs) => bs.staffId)
      .filter(Boolean) as string[];

    let staffUserId: string | null = null;
    if (staffAssignments.length > 0) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { id: { in: staffAssignments }, userId: { not: null } },
        select: { userId: true },
      });
      staffUserId = staff?.userId ?? null;
    }

    ensureCanOnResource(user, permissionCode, {
      businessId: booking.branch.businessId,
      branchId: booking.branchId,
      ownerUserId: customerUserId,
      staffUserId,
    });

    return {
      bookingId,
      businessId: booking.branch.businessId,
      branchId: booking.branchId,
      customerUserId,
      staffUserId,
    };
  }

  /**
   * Same as loadAndAssert but only used for write actions. Pick the matching
   * update/cancel permission code automatically:
   *   - self → booking:update:self
   *   - own  → booking:update:own
   *   - branch → booking:update:branch
   *   - tenant → booking:update:tenant
   *   - platform → booking:update:platform
   */
  async assertWrite(
    user: AuthUser,
    bookingId: string,
  ): Promise<{
    bookingId: string;
    businessId: string;
    branchId: string;
    customerUserId: string;
    staffUserId: string | null;
  }> {
    const staffOnly = user.roles.includes('STAFF') && !user.roles.some((role) =>
      ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role),
    );
    if (staffOnly) {
      const info = await this.loadAndAssert(user, bookingId, 'booking:read:branch');
      if (info.staffUserId !== user.id) {
        throw new ForbiddenException('Nhân viên chỉ được thao tác lịch được phân công cho mình');
      }
      ensureCanOnResource(user, 'booking:update:branch', {
        businessId: info.businessId,
        branchId: info.branchId,
        staffUserId: info.staffUserId,
      });
      return info;
    }
    const isPlatform = user.scopes?.some((s) =>
      PLATFORM_ROLE_CODES.has(s.code),
    );
    if (isPlatform) {
      throw new ForbiddenException(
        'Platform chỉ được quan sát lịch hẹn; thao tác vận hành phải do workspace SALON thực hiện',
      );
    }

    // Try the most specific read-level permission first.
    const attempts: Array<Parameters<typeof this.loadAndAssert>[2]> = [
      'booking:read:self',
      'booking:read:branch',
      'booking:read:tenant',
    ];
    let lastErr: unknown = null;
    for (const code of attempts) {
      try {
        const info = await this.loadAndAssert(user, bookingId, code);
        // Translate read→write permission check explicitly:
        const writeCode = code.replace(':read:', ':update:') as
          | 'booking:update:self'
          | 'booking:update:own'
          | 'booking:update:branch'
          | 'booking:update:tenant';
        ensureCanOnResource(user, writeCode, {
          businessId: info.businessId,
          branchId: info.branchId,
          ownerUserId: info.customerUserId,
          staffUserId: info.staffUserId,
        });
        return info;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new ForbiddenException('Forbidden');
  }

  /**
   * Customer-only helper: a customer may create their own booking for any
   * branch. The service layer validates that branchId belongs to a real
   * branch and applies ownership at read time.
   */
  async assertCustomerCreate(
    user: AuthUser,
    branchId: string,
  ): Promise<string> {
    const businessId = await resolveBusinessIdByBranch(this.prisma, branchId);
    if (isPlatformRole(user)) {
      throw new ForbiddenException(
        'Platform chỉ được quan sát lịch hẹn; không được tạo lịch vận hành cho doanh nghiệp',
      );
    }
    const customerOnly = user.roles.includes('CUSTOMER') && !user.roles.some((role) =>
      ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role),
    );
    if (customerOnly) {
      // No explicit business access needed to BOOK, but verify branch exists
      // (already done by resolveBusinessIdByBranch). Customer role holders
      // are allowed to create their own bookings by definition.
      const profile = await this.prisma.customerProfile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile) {
        throw new ForbiddenException('Customer profile not found');
      }
    } else {
      await assertBusinessAccess(this.prisma, user, businessId);
    }
    return businessId;
  }

  /**
   * Manual platform guard for SALON/OWNER forces cancel/refund.
   */
  async assertForceCancel(user: AuthUser, bookingId: string) {
    return this.loadAndAssert(user, bookingId, 'booking:read:platform').then(
      (info) => {
        ensureCanOnResource(user, 'booking:cancel:platform', {
          businessId: info.businessId,
          branchId: info.branchId,
          ownerUserId: info.customerUserId,
          staffUserId: info.staffUserId,
        });
        return info;
      },
    );
  }

  /** Platform refund authorization is independent from force-cancel. */
  async assertRefund(user: AuthUser, bookingId: string) {
    const info = await this.loadAndAssert(
      user,
      bookingId,
      'booking:read:platform',
    );
    ensureCanOnResource(user, 'payment:refund:platform', {
      businessId: info.businessId,
      branchId: info.branchId,
      ownerUserId: info.customerUserId,
      staffUserId: info.staffUserId,
    });
    return info;
  }
}

function isPlatformRole(user: AuthUser) {
  return user.scopes?.some((s) => PLATFORM_ROLE_CODES.has(s.code)) ?? false;
}

export const BookingsAccessServiceToken = Symbol('BookingsAccessService');
