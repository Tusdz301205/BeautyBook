import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from './ownership.service';

@Controller('ownership-transfers')
export class OwnershipController {
  constructor(private readonly ownership: OwnershipService, private readonly prisma: PrismaService) {}

  @Post()
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  async create(@Body() body: any, @CurrentUser() user: AuthUser) {
    if (!body.businessId) throw new BadRequestException('businessId là bắt buộc');
    await assertBusinessAccess(this.prisma, user, body.businessId);
    return this.ownership.create(body.businessId, user.id, body);
  }

  @Get('pending-for-me')
  pendingForMe(@CurrentUser() user: AuthUser) {
    return this.ownership.listIncoming(user.id);
  }

  @Get('platform/pending')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  platformPending() {
    return this.ownership.listPlatformQueue();
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ownership.accept(id, user.id);
  }

  @Patch(':id/submit-more-info')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  submitMoreInfo(@Param('id') id: string, @Body() body: { note: string; settlementAgreement?: Record<string, unknown> }, @CurrentUser() user: AuthUser) {
    return this.ownership.submitMoreInfo(id, user.id, body);
  }

  @Get()
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('business:update:tenant', 'business:review:platform')
  async list(@Query('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    if (!businessId) throw new BadRequestException('businessId là bắt buộc');
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.ownership.list(businessId);
  }

  @Patch(':id/cancel')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  cancel(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.ownership.cancel(id, user.id, body.reason);
  }

  @Patch(':id/review')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  review(@Param('id') id: string, @Body() body: { approve: boolean; needMoreInfo?: boolean; reason: string }, @CurrentUser() user: AuthUser) {
    return this.ownership.review(id, user.id, body);
  }

  @Patch('platform/legal-entity/:id/verify')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  verifyLegal(@Param('id') id: string, @Body() body: { approve: boolean; reason: string }, @CurrentUser() user: AuthUser) {
    return this.ownership.verifyVersion('LEGAL_ENTITY', id, user.id, body);
  }

  @Patch('platform/payout-account/:id/verify')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  verifyPayout(@Param('id') id: string, @Body() body: { approve: boolean; reason: string }, @CurrentUser() user: AuthUser) {
    return this.ownership.verifyVersion('PAYOUT_ACCOUNT', id, user.id, body);
  }

  @Post(':id/execute')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  execute(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ownership.execute(id, user.id);
  }

  @Get('business/:businessId/versions')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('business:update:tenant', 'business:review:platform')
  async versions(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.ownership.versions(businessId);
  }

  @Post('business/:businessId/legal-entity')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  async legal(@Param('businessId') businessId: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.ownership.createLegalVersion(businessId, user.id, body);
  }

  @Post('business/:businessId/payout-account')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  async payout(@Param('businessId') businessId: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.ownership.createPayoutVersion(businessId, user.id, body);
  }
}
