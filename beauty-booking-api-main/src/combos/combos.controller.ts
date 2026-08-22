import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Audited } from '../common/decorators/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { CombosService } from './combos.service';
import { CreateComboDto, UpdateComboDto } from './dto/combos.dto';

@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Public()
  @Get('public')
  publicList(@Query('branchId') branchId?: string) {
    return this.combos.publicList(branchId);
  }

  @Get()
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')
  @RequirePermission('combo:manage:tenant', 'combo:read:platform')
  list(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string, @Query('businessId') businessId?: string) {
    return this.combos.list(user, { branchId, businessId });
  }

  @Get(':id')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'CUSTOMER')
  @RequirePermission('combo:read:public', 'combo:manage:tenant', 'combo:read:platform')
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.combos.detail(id, user);
  }

  @Post()
  @Roles('BUSINESS_OWNER')
  @RequirePermission('combo:manage:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'Combo' })
  create(@Body() body: CreateComboDto, @CurrentUser() user: AuthUser) {
    return this.combos.create(body, user);
  }

  @Patch(':id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('combo:manage:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Combo' })
  update(@Param('id') id: string, @Body() body: UpdateComboDto, @CurrentUser() user: AuthUser) {
    return this.combos.update(id, body, user);
  }

  @Delete(':id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('combo:manage:tenant')
  @Audited({ action: AuditAction.DELETE, entityType: 'Combo' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.combos.remove(id, user);
  }
}
