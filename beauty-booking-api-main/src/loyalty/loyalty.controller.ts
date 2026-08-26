import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService, private readonly prisma: PrismaService) {}

  @Get('mine')
  @Roles('CUSTOMER')
  @RequirePermission('user:read:self')
  async mine(@CurrentUser() user: AuthUser) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return this.loyalty.listCustomer(customer.id);
  }

  @Post('rules')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('promotion:manage:tenant')
  async configure(@Body() body: any, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    return this.loyalty.configureRule(body.businessId, user.id, body);
  }

  @Get('liability')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('report:revenue:tenant')
  async liability(@Query('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, businessId);
    const [accounts, rule] = await Promise.all([
      this.prisma.loyaltyAccount.aggregate({ where: { businessId }, _sum: { balance: true }, _count: true }),
      this.prisma.loyaltyRule.findFirst({ where: { businessId, active: true }, orderBy: { version: 'desc' } }),
    ]);
    return {
      accounts: accounts._count,
      pointsOutstanding: accounts._sum.balance ?? 0,
      estimatedLiability: Number(accounts._sum.balance ?? 0) * Number(rule?.redemptionValuePerPoint ?? 0),
      ruleVersion: rule?.version ?? null,
    };
  }
}
