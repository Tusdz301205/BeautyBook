import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBranchAccess, restrictToRoles } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from './waitlist.service';
import { canOnResource } from '../common/utils/policy';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService, private readonly prisma: PrismaService) {}

  private assertCounterAccess(user: AuthUser, businessId: string, branchId: string, action: 'read' | 'update') {
    const principal = restrictToRoles(user, ['BUSINESS_OWNER', 'RECEPTIONIST']);
    if (!['branch', 'tenant'].some((scope) =>
      canOnResource(principal, `booking:${action}:${scope}`, { businessId, branchId }),
    )) throw new ForbiddenException('Bạn không có quyền vận hành danh sách chờ tại chi nhánh này');
  }

  private async customer(userId: string) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return customer.id;
  }

  @Post()
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  async join(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.waitlist.join(await this.customer(user.id), body);
  }

  @Get('mine')
  @Roles('CUSTOMER')
  @RequirePermission('booking:read:self')
  async mine(@CurrentUser() user: AuthUser) {
    return this.waitlist.listCustomer(await this.customer(user.id));
  }

  @Patch(':id/cancel')
  @Roles('CUSTOMER')
  @RequirePermission('booking:update:self')
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.waitlist.cancel(id, await this.customer(user.id));
  }

  @Patch(':id/accept')
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  async accept(@Param('id') id: string, @Body() body: { token: string }, @CurrentUser() user: AuthUser) {
    return this.waitlist.accept(id, await this.customer(user.id), body.token, user.id);
  }

  @Get('branch')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:read:branch', 'booking:read:tenant')
  async branch(@Query('branchId') branchId: string, @CurrentUser() user: AuthUser) {
    if (!branchId) throw new BadRequestException('branchId là bắt buộc');
    const businessId = await assertBranchAccess(this.prisma, user, branchId);
    this.assertCounterAccess(user, businessId, branchId, 'read');
    return this.waitlist.listBranch(branchId);
  }

  @Post(':id/offer')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async offer(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const entry = await this.prisma.waitlistEntry.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    const businessId = await assertBranchAccess(this.prisma, user, entry.branchId);
    this.assertCounterAccess(user, businessId, entry.branchId, 'update');
    return this.waitlist.offer(id, user.id, body);
  }
}
