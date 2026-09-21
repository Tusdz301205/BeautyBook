import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';
import { AuditAction } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/profile')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')
  @RequirePermission('user:read:self')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getSelf(user.id);
  }

  @Patch('me/profile')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')
  @RequirePermission('user:update:self')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: {
      fullName?: string;
      phone?: string;
      gender?: 'MALE' | 'FEMALE' | 'OTHER';
      dateOfBirth?: string;
      avatarMediaId?: string;
      address?: string;
      staffBio?: string;
      experienceYears?: number;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    },
  ) {
    return this.usersService.updateSelf(user.id, body);
  }

  /**
   * GET /api/users — list users. Platform roles only.
   */
  @Get()
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('user:read:platform')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    if (!can(user, 'user:read:platform')) {
      throw new ForbiddenException('Permission required: user:read:platform');
    }
    return this.usersService.findAll({
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      role,
      status,
    });
  }

  /**
   * GET /api/users/:id — read a single user.
   *   - Customers can only read themselves.
   *   - Salon roles can read users in their tenant (customer/employees).
   *   - Platform roles can read anyone.
   */
  @Get(':id')
  @Roles(
    'PLATFORM_ADMIN',
    
    
    'BUSINESS_OWNER',
    'RECEPTIONIST',
    'STAFF',
    'CUSTOMER',
    
  )
  @RequirePermission('user:read:self', 'user:read:platform')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    // Coarse role-only access; fine-grained ownership in service.
    return this.usersService.findOne(id, user);
  }

  /**
   * POST /api/users/:id/suspend — platform-side suspension.
   */
  @Post(':id/suspend')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('user:suspend:platform')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'User' })
  async suspend(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.suspend(id, user.id, body.reason);
  }

  @Get(':id/permissions')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('user:role_assign:platform')
  listDirectPermissions(@Param('id') userId: string) {
    return this.usersService.listDirectPermissions(userId);
  }

  @Post(':id/permissions')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('user:role_assign:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'UserPermission' })
  grantDirectPermission(
    @Param('id') userId: string,
    @Body() body: {
      permissionCode: string;
      bundleCode?: string;
      expiresAt?: string;
    },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.grantDirectPermission(userId, body, actor);
  }

  @Delete(':id/permissions/:permissionCode')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('user:role_assign:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'UserPermission' })
  revokeDirectPermission(
    @Param('id') userId: string,
    @Param('permissionCode') permissionCode: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.revokeDirectPermission(
      userId,
      permissionCode,
      actor,
    );
  }

  @Post(':id/roles')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')
  @RequirePermission('user:role_assign:platform', 'user:role_assign:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'UserRole' })
  assignRole(
    @Param('id') userId: string,
    @Body() body: {
      roleCode: string;
      businessId?: string;
      branchId?: string;
      expiresAt?: string;
    },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.assignRole(userId, body, actor);
  }

  @Delete(':id/roles/:roleCode')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')
  @RequirePermission('user:role_assign:platform', 'user:role_assign:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'UserRole' })
  revokeRole(
    @Param('id') userId: string,
    @Param('roleCode') roleCode: string,
    @Query('businessId') businessId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.revokeRole(
      userId,
      { roleCode, businessId, branchId },
      actor,
    );
  }
}
