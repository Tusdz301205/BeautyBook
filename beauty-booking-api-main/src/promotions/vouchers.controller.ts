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
} from '@nestjs/common';
import { VouchersAdminService } from './vouchers-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { AuditAction } from '@prisma/client';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/campaign.dto';

@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class VouchersController {
  constructor(private readonly vouchersService: VouchersAdminService) {}

  /** GET /api/vouchers/mine — voucher đã cấp cho customer hiện tại. */
  @Get('mine')
  @Roles('CUSTOMER')
  @RequirePermission('voucher:read:self')
  findMine(@CurrentUser() user: AuthUser) {
    return this.vouchersService.findMine(user.id);
  }

  /**
   * GET /api/vouchers
   * Danh sách voucher.
   */
  @Get()
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('voucher:manage:tenant', 'voucher:manage:platform', 'voucher:read:platform')
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.vouchersService.findAll(user, { status });
  }

  /**
   * POST /api/vouchers
   * Tạo voucher mới.
   */
  @Post()
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')
  @Audited({ action: AuditAction.CREATE, entityType: 'Voucher' })
  create(
    @Body() body: CreateVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.code || !body.name || !body.discountType || !body.totalQuantity) {
      throw new BadRequestException('code, name, discountType, totalQuantity là bắt buộc');
    }
    if (!isPlatformRole(user) && !body.businessId) {
      throw new BadRequestException('Tenant voucher phải có businessId');
    }
    return this.vouchersService.create(
      body,
      isPlatformRole(user) ? null : body.businessId!,
      isPlatformRole(user),
      user,
    );
  }

  /**
   * PATCH /api/vouchers/:id
   * Cập nhật voucher.
   */
  @Patch(':id')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Voucher' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vouchersService.update(id, body, user);
  }

  /**
   * POST /api/vouchers/:id/grant
   * Phát voucher cho khách.
   */
  @Post(':id/grant')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')
  @Audited({ action: AuditAction.CREATE, entityType: 'CustomerVoucher' })
  grant(
    @Param('id') id: string,
    @Body() body: { customerId: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.customerId?.trim()) {
      throw new BadRequestException('Thông tin khách hàng là bắt buộc');
    }
    return this.vouchersService.grantToCustomer(id, body.customerId, user);
  }

  /**
   * DELETE /api/vouchers/:id
   * Xóa mềm voucher (revoke).
   */
  @Delete(':id')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')
  @Audited({ action: AuditAction.DELETE, entityType: 'Voucher' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vouchersService.softDelete(id, user);
  }
}
