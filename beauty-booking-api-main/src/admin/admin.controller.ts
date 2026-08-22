import { Body, Controller, Get, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { TrustSnapshotService } from './trust-snapshot.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { UpdatePlatformSettingsDto } from './dto/platform-settings.dto';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditAction, Prisma } from '@prisma/client';
import { FinancialMetricsService } from '../payments/financial-metrics.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

/**
 * Platform governance endpoints. Every route is gated by PLATFORM_ADMIN and
 * an explicit permission.
 */
@Controller('admin')
@UseGuards(RolesGuard)
@UseInterceptors(AuditInterceptor)
export class AdminController {
  constructor(
    private readonly trustSnapshotService: TrustSnapshotService,
    private readonly prisma: PrismaService,
    private readonly financialMetrics: FinancialMetricsService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @Get('settings')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('platform_setting:manage:platform')
  async settings() {
    return this.platformSettings.getView();
  }

  @Patch('settings')
  @Audited({ action: AuditAction.UPDATE, entityType: 'PlatformSetting' })
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('platform_setting:manage:platform')
  async updateSettings(@Body() body: UpdatePlatformSettingsDto, @CurrentUser() user: AuthUser) {
    return this.platformSettings.update(body.settings, user.id);
  }

  @Post('settings/reset')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('platform_setting:manage:platform')
  async resetSettings(@CurrentUser() user: AuthUser) {
    return this.platformSettings.reset(user.id);
  }

  /**
   * Trust snapshots — PLATFORM_ADMIN governance only.
   */
  @Get('trust-snapshots')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('admin:trust_snapshot:read')
  async snapshots() {
    return this.trustSnapshotService.listAllSnapshots();
  }

  @Post('trust-snapshots/rebuild')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('admin:trust_snapshot:manage')
  async rebuildSnapshots(@CurrentUser() user: AuthUser) {
    return this.trustSnapshotService.rebuildAll(user.id);
  }

  @Get('trust-actions')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('admin:trust_snapshot:read')
  async trustActions() {
    return this.trustSnapshotService.listActions();
  }

  @Post('trust-actions')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('admin:trust_snapshot:manage')
  async trustAction(
    @Body() body: { businessId: string; branchId?: string; action: any; reason: string; internalNote?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.trustSnapshotService.performAction({ ...body, actorId: user.id });
  }

  /**
   * Global audit log — PLATFORM_ADMIN globally; tenant roles see own actions.
   */
  @Get('audit-logs')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('audit:read:platform', 'audit:read:tenant', 'audit:read:branch')
  async auditLogs(@CurrentUser() user: AuthUser) {
    const isPlatform = user.roles.some((role) => ['PLATFORM_ADMIN'].includes(role));
    return this.prisma.auditLog.findMany({
      // AuditLog hiện chưa có businessId/branchId. Với tài khoản salon, chỉ trả
      // chính thao tác của người đang đăng nhập để tuyệt đối không lộ tenant khác.
      where: isPlatform ? undefined : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  @Get('business-directory')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:read:platform')
  async businessDirectory(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') requestedPage?: string,
    @Query('limit') requestedLimit?: string,
  ) {
    const page = Math.max(1, Number(requestedPage) || 1);
    const limit = Math.min(50, Math.max(1, Number(requestedLimit) || 10));
    const allowedStatuses = ['DRAFT', 'PENDING', 'PENDING_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED'];
    const where: Prisma.BusinessWhereInput = {
      deletedAt: null,
      ...(status && allowedStatuses.includes(status) ? { status: status as any } : {}),
      ...(search?.trim() ? {
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { contactEmail: { contains: search.trim(), mode: 'insensitive' } },
          { contactPhone: { contains: search.trim(), mode: 'insensitive' } },
          { owner: { user: { fullName: { contains: search.trim(), mode: 'insensitive' } } } },
          { owner: { user: { email: { contains: search.trim(), mode: 'insensitive' } } } },
        ],
      } : {}),
    };
    const [total, businesses] = await Promise.all([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          contactEmail: true,
          contactPhone: true,
          createdAt: true,
          owner: { select: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
          branches: { where: { deletedAt: null }, select: { id: true, status: true } },
          _count: { select: { serviceCatalog: { where: { deletedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const branches = businesses.flatMap((business) => business.branches.map((branch) => ({ ...branch, businessId: business.id })));
    const bookingRows = branches.length
      ? await this.prisma.booking.groupBy({
          by: ['branchId'],
          where: { branchId: { in: branches.map((branch) => branch.id) }, deletedAt: null },
          _count: { _all: true },
        })
      : [];
    const bookingsByBranch = new Map(bookingRows.map((row) => [row.branchId, row._count._all]));

    return {
      data: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        status: business.status,
        contactEmail: business.contactEmail,
        contactPhone: business.contactPhone,
        createdAt: business.createdAt,
        owner: business.owner?.user ?? null,
        branchCount: business.branches.length,
        activeBranchCount: business.branches.filter((branch) => branch.status === 'ACTIVE').length,
        serviceCount: business._count.serviceCatalog,
        bookingCount: business.branches.reduce((sum, branch) => sum + (bookingsByBranch.get(branch.id) ?? 0), 0),
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get('branch-directory')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:read:platform')
  async branchDirectory(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') requestedPage?: string,
    @Query('limit') requestedLimit?: string,
  ) {
    const page = Math.max(1, Number(requestedPage) || 1);
    const limit = Math.min(50, Math.max(1, Number(requestedLimit) || 10));
    const branchStatuses = ['PENDING', 'ACTIVE', 'INACTIVE'];
    const reviewStatuses = ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'REJECTED'];
    const where: Prisma.BranchWhereInput = {
      deletedAt: null,
      ...(status && branchStatuses.includes(status) ? { status: status as any } : {}),
      ...(status && reviewStatuses.includes(status) ? { reviewStatus: status as any } : {}),
      ...(search?.trim() ? {
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { publicName: { contains: search.trim(), mode: 'insensitive' } },
          { addressLine: { contains: search.trim(), mode: 'insensitive' } },
          { business: { name: { contains: search.trim(), mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [total, branches] = await Promise.all([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        select: {
          id: true,
          businessId: true,
          name: true,
          publicName: true,
          addressLine: true,
          status: true,
          reviewStatus: true,
          operationalStatus: true,
          createdAt: true,
          business: { select: { id: true, name: true, status: true } },
          district: { select: { name: true, province: { select: { name: true } } } },
          _count: {
            select: {
              services: { where: { deletedAt: null } },
              bookings: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const ratings = branches.length
      ? await this.prisma.$queryRaw<Array<{ branchId: string; rating: unknown }>>(Prisma.sql`
          SELECT booking.branch_id AS "branchId", AVG(review.overall_rating)::numeric(4,2) AS rating
          FROM bookings booking
          JOIN reviews review ON review.booking_id = booking.id
          WHERE booking.branch_id IN (${Prisma.join(branches.map((branch) => branch.id))})
            AND booking.deleted_at IS NULL
            AND review.deleted_at IS NULL
            AND review.status = 'APPROVED'
          GROUP BY booking.branch_id
        `)
      : [];
    const ratingsByBranch = new Map(ratings.map((row) => [row.branchId, Number(row.rating) || 0]));

    return {
      data: branches.map((branch) => ({
        ...branch,
        services: branch._count.services,
        bookings: branch._count.bookings,
        rating: Math.round((ratingsByBranch.get(branch.id) ?? 0) * 10) / 10,
        location: [branch.addressLine, branch.district?.name, branch.district?.province?.name].filter(Boolean).join(', '),
        _count: undefined,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /**
   * Compliance queue — branches awaiting approval + businesses pending
   * KYC review.
   */
  @Get('compliance-queue')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:read:platform')
  async complianceQueue() {
    const [pendingBranches, businesses] = await Promise.all([
      this.prisma.branch.findMany({
        where: {
          reviewStatus: { in: ['SUBMITTED', 'PENDING_REVIEW', 'NEED_MORE_INFO', 'REJECTED', 'APPROVED'] },
          deletedAt: null,
        },
        include: {
          business: { select: { id: true, name: true, status: true } },
          documents: { select: { id: true, documentType: true, status: true } },
          reviewEvents: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { actor: { select: { fullName: true, email: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.business.findMany({
        where: { status: { in: ['PENDING', 'PENDING_REVIEW', 'NEED_MORE_INFO', 'REJECTED', 'APPROVED', 'ACTIVE'] }, deletedAt: null },
        include: {
          owner: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
          branches: { where: { deletedAt: null }, select: { id: true, name: true, reviewStatus: true } },
          documents: { select: { id: true, documentType: true, status: true } },
          reviewEvents: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { actor: { select: { fullName: true, email: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);
    return { pendingBranches, pendingBusinesses: businesses };
  }

  /**
   * Finance reconciliation — read-only bookings + payments summary.
   */
  @Get('finance-overview')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('payment:read:platform')
  async financeOverview() {
    const [totals, pending] = await Promise.all([
      this.financialMetrics.totals(),
      this.prisma.payment.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      grossRevenue: totals.grossRevenue,
      refundAmount: totals.refundAmount,
      netRevenue: totals.netRevenue,
      paid: { total: totals.grossRevenue, count: totals.paymentCount },
      refunded: { total: totals.refundAmount },
      pending: { total: pending._sum.amount, count: pending._count },
    };
  }

  /**
   * Marketing overview — voucher / promotion snapshot.
   */
  @Get('marketing-overview')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('voucher:read:platform')
  async marketingOverview() {
    const vouchers = await this.prisma.voucher.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    const promotions = await this.prisma.promotion.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { vouchers, promotions };
  }
}
