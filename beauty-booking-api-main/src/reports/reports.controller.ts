import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService, ReportScope } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { isPlatformRole } from '../common/utils/scope-helpers';
import {
  assertBranchAccess,
  resolveBusinessIdsForUser,
} from '../common/utils/multi-tenancy';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'report:overview:platform',
    'report:overview:tenant',
    'report:overview:branch',
  )
  async getDashboardOverview(@CurrentUser() user: AuthUser) {
    return this.reportsService.getDashboardOverview(await this.scopeFor(user));
  }

  @Get('owner-dashboard')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission(
    'report:overview:tenant',
    'report:overview:branch',
    'report:overview:platform',
  )
  async getOwnerDashboard(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from || !to) throw new BadRequestException('from và to là bắt buộc');
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Khoảng ngày không hợp lệ');
    }
    if (branchId) await assertBranchAccess(this.prisma, user, branchId);
    return this.reportsService.getOwnerDashboard({
      scope: await this.scopeFor(user),
      branchId,
      from: start,
      to: end,
    });
  }

  @Get('revenue')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')
  @RequirePermission(
    'report:revenue:platform',
    'report:revenue:tenant',
  )
  async getRevenue(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.reportsService.getRevenue(
      year ? parseInt(year, 10) : undefined,
      await this.scopeFor(user),
    );
  }

  @Get('categories')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('report:overview:platform', 'report:overview:tenant', 'report:overview:branch')
  async getCategoryStats(@CurrentUser() user: AuthUser) {
    return this.reportsService.getCategoryStats(await this.scopeFor(user));
  }

  @Get('services')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('report:overview:platform', 'report:overview:tenant', 'report:overview:branch')
  async getServiceStats(@CurrentUser() user: AuthUser) {
    return this.reportsService.getServiceStats(await this.scopeFor(user));
  }

  @Get('top-salons')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('report:overview:platform')
  getTopBranches(@Query('limit') limit?: string) {
    return this.reportsService.getTopBranches(
      limit ? parseInt(limit, 10) : 5,
    );
  }

  @Get('user-growth')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('report:user_growth:platform')
  getUserGrowth(@Query('year') year?: string) {
    return this.reportsService.getUserGrowth(year ? parseInt(year, 10) : undefined);
  }

  @Get('staff-performance')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('report:overview:platform', 'report:overview:tenant', 'report:overview:branch')
  async getStaffPerformance(@CurrentUser() user: AuthUser) {
    return this.reportsService.getStaffPerformance(await this.scopeFor(user));
  }

  private async scopeFor(user: AuthUser): Promise<ReportScope> {
    if (isPlatformRole(user)) return {};

    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = [...new Set(
      (user.scopes ?? [])
        .filter((scope) =>
          !scope.expiresAt || new Date(scope.expiresAt).getTime() > Date.now(),
        )
        .map((scope) => scope.branchId)
        .filter((branchId): branchId is string => !!branchId),
    )];

    return branchIds.length > 0
      ? { businessIds, branchIds }
      : { businessIds };
  }
}
