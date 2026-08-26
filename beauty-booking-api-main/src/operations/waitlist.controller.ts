import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBranchAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService, private readonly prisma: PrismaService) {}

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
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('booking:read:branch', 'booking:read:tenant')
  async branch(@Query('branchId') branchId: string, @CurrentUser() user: AuthUser) {
    await assertBranchAccess(this.prisma, user, branchId);
    return this.waitlist.listBranch(branchId);
  }

  @Post(':id/offer')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async offer(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const entry = await this.prisma.waitlistEntry.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, entry.branchId);
    return this.waitlist.offer(id, user.id, body);
  }
}
