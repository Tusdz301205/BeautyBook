import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBranchAccess, assertBusinessAccess, resolveBranchIdsForUser, resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { ImpactService } from './impact.service';

@Controller('operational-impacts')
@Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'PLATFORM_ADMIN')
@RequirePermission('booking:update:tenant', 'booking:update:branch', 'booking:read:platform')
export class ImpactController {
  constructor(private readonly impacts: ImpactService, private readonly prisma: PrismaService) {}

  private async assertImpactAccess(id: string, user: AuthUser) {
    const impact = await this.prisma.operationalImpactCase.findUniqueOrThrow({
      where: { id },
      select: { businessId: true, branchId: true },
    });
    const branchOnly = user.roles.includes('BRANCH_MANAGER') && !user.roles.includes('BUSINESS_OWNER') && !user.roles.includes('PLATFORM_ADMIN');
    if (branchOnly) {
      if (!impact.branchId) throw new BadRequestException('Impact case cấp doanh nghiệp chỉ dành cho chủ doanh nghiệp');
      await assertBranchAccess(this.prisma, user, impact.branchId);
    } else {
      await assertBusinessAccess(this.prisma, user, impact.businessId);
    }
    return impact;
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = user.roles.includes('BRANCH_MANAGER')
      ? (await Promise.all(businessIds.map((id) => resolveBranchIdsForUser(this.prisma, user, id)))).flatMap((ids) => ids ?? [])
      : undefined;
    return this.impacts.list(businessIds, branchIds);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.assertImpactAccess(id, user);
    return this.impacts.detail(id);
  }

  @Patch(':id/items/:itemId')
  async resolve(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    await this.assertImpactAccess(id, user);
    return this.impacts.resolveItem(id, itemId, user, body);
  }

  @Patch(':id/items')
  async resolveBatch(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    await this.assertImpactAccess(id, user);
    return this.impacts.resolveBatch(id, user, body);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.assertImpactAccess(id, user);
    return this.impacts.complete(id, user.id);
  }
}
