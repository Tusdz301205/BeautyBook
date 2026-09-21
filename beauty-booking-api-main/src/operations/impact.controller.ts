import { ForbiddenException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBusinessAccess, resolveBusinessIdsForUser, restrictToRoles } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { ImpactService } from './impact.service';

@Controller('operational-impacts')
@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
@RequirePermission('booking:update:tenant', 'booking:read:platform')
export class ImpactController {
  constructor(private readonly impacts: ImpactService, private readonly prisma: PrismaService) {}

  private async assertImpactAccess(id: string, user: AuthUser) {
    if (!user.roles.some((role) => ['BUSINESS_OWNER', 'PLATFORM_ADMIN'].includes(role))) {
      throw new ForbiddenException('Chỉ chủ doanh nghiệp hoặc quản trị nền tảng được quản lý ảnh hưởng vận hành');
    }
    const impact = await this.prisma.operationalImpactCase.findUniqueOrThrow({
      where: { id },
      select: { businessId: true, branchId: true },
    });
    await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), impact.businessId);
    return impact;
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']));
    return this.impacts.list(businessIds);
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
