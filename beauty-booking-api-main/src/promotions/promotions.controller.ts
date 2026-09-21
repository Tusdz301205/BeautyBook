import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBranchAccess, assertBusinessAccess, restrictToRoles } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/campaign.dto';

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/promotions
   * Danh sách khuyến mãi (scoped theo user).
   */
  @Get()
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('promotion:manage:tenant', 'promotion:manage:platform')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('businessId') businessId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    if (businessId) {
      await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), businessId);
    }
    if (branchId) {
      await assertBranchAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), branchId);
    }
    return this.promotionsService.findAll(user, { businessId, branchId, status });
  }

  /**
   * GET /api/promotions/service/:serviceId
   * Khuyến mãi đang active cho 1 dịch vụ (public — booking flow).
   */
  @Get('service/:serviceId')
  @Public()
  getActiveForService(@Param('serviceId') serviceId: string) {
    return this.promotionsService.getActiveForService(serviceId);
  }

  /**
   * POST /api/promotions
   * Tạo khuyến mãi mới.
   * - Owner: tạo cho salon mình.
   * - Marketing/Admin: tạo toàn platform.
   */
  @Post()
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('promotion:manage:tenant', 'promotion:manage:platform')
  @Audited({ action: AuditAction.CREATE, entityType: 'Promotion' })
  async create(
    @Body() body: CreatePromotionDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.name || !body.discountType || !body.startDate || !body.endDate) {
      throw new BadRequestException('name, discountType, startDate, endDate là bắt buộc');
    }
    if (isPlatformRole(user) && (
      body.businessIds?.length || body.branchIds?.length || body.serviceIds?.length || body.comboIds?.length
    )) {
      throw new ForbiddenException('Platform không được tạo campaign vận hành cho doanh nghiệp');
    }
    // Verify business access for each linked business
    if (body.businessIds) {
      for (const bizId of body.businessIds) {
        await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), bizId);
      }
    }
    for (const branchId of body.branchIds ?? []) {
      await assertBranchAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), branchId);
    }
    for (const serviceId of body.serviceIds ?? []) {
      const service = await this.prisma.branchServiceOffering.findUnique({
        where: { id: serviceId },
        select: { branchId: true },
      });
      if (!service) throw new BadRequestException('Dịch vụ không tồn tại');
      await assertBranchAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), service.branchId);
    }
    for (const comboId of body.comboIds ?? []) {
      const combo = await this.prisma.combo.findUnique({ where: { id: comboId }, select: { businessId: true } });
      if (!combo) throw new BadRequestException('Combo không tồn tại');
      await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), combo.businessId);
    }
    const ownerBusinessId = isPlatformRole(user) ? null : body.businessIds?.[0];
    if (!isPlatformRole(user) && !ownerBusinessId) {
      throw new BadRequestException('Tenant promotion phải có businessIds');
    }
    return this.promotionsService.create(
      body,
      ownerBusinessId ?? null,
      isPlatformRole(user),
      user,
    );
  }

  /**
   * PATCH /api/promotions/:id
   * Cập nhật khuyến mãi.
   */
  @Patch(':id')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('promotion:manage:tenant', 'promotion:manage:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Promotion' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePromotionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.promotionsService.update(id, body, user);
  }

  /**
   * DELETE /api/promotions/:id
   * Xóa mềm khuyến mãi.
   */
  @Delete(':id')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('promotion:manage:tenant', 'promotion:manage:platform')
  @Audited({ action: AuditAction.DELETE, entityType: 'Promotion' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.promotionsService.softDelete(id, user);
  }
}
