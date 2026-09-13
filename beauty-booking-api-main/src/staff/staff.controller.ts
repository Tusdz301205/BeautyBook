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
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBusinessAccess,
  assertBranchAccess,
} from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { StaffInvitationsService } from './staff-invitations.service';
import {
  AcceptExistingStaffInvitationDto,
  AcceptStaffInvitationDto,
  ChangeStaffInvitationEmailDto,
  InviteStaffDto,
} from './dto/staff-invitation.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly prisma: PrismaService,
    private readonly invitations: StaffInvitationsService,
  ) {}

  private async assertStaffResourceAccess(user: AuthUser, staffId: string, requestedBranchId?: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: { branchId: true, userId: true },
    });
    if (!staff) {
      return this.staffService.getBranchIdByStaff(staffId);
    }
    const staffOnly =
      user.roles.includes('STAFF') &&
      !user.roles.some((role) =>
        ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'PLATFORM_ADMIN'].includes(role),
      );
    if (staffOnly && staff.userId !== user.id) {
      throw new ForbiddenException('Nhân viên chỉ được xem dữ liệu của chính mình');
    }
    const targetBranchId = requestedBranchId || staff.branchId;
    await assertBranchAccess(this.prisma, user, targetBranchId);
    return targetBranchId;
  }

  private async assertInvitationAccess(user: AuthUser, invitationId: string) {
    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { id: invitationId },
      select: { businessId: true, branchId: true },
    });
    if (!invitation) throw new BadRequestException('Lời mời không tồn tại');
    await assertBusinessAccess(this.prisma, user, invitation.businessId);
    if (invitation.branchId) await assertBranchAccess(this.prisma, user, invitation.branchId);
  }

  @Post('invitations')
  @Audited({ action: AuditAction.CREATE, entityType: 'StaffInvitation' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  async invite(
    @Body() body: InviteStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    if (body.branchId) await assertBranchAccess(this.prisma, user, body.branchId);
    return this.invitations.invite({ ...body, invitedBy: user.id });
  }

  @Get('invitations')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:read:tenant', 'user:read:branch')
  async listInvitations(
    @Query('businessId') businessId: string,
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!businessId) throw new BadRequestException('businessId là bắt buộc');
    await assertBusinessAccess(this.prisma, user, businessId);
    if (branchId) await assertBranchAccess(this.prisma, user, branchId);
    return this.invitations.list({ businessId, branchId });
  }

  @Get('invitations/context')
  @Public()
  invitationContext(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token là bắt buộc');
    return this.invitations.getContext(token);
  }

  @Post('invitations/accept')
  @Public()
  acceptInvitation(
    @Body() body: AcceptStaffInvitationDto,
  ) {
    return this.invitations.accept(body);
  }

  @Post('invitations/accept-existing')
  acceptExistingInvitation(
    @Body() body: AcceptExistingStaffInvitationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitations.acceptExisting(body.token, user.id);
  }

  @Post('invitations/:invitationId/resend')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  async resendInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertInvitationAccess(user, invitationId);
    return this.invitations.resend(invitationId, user.id);
  }

  @Patch('invitations/:invitationId/email')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  async changeInvitationEmail(
    @Param('invitationId') invitationId: string,
    @Body() body: ChangeStaffInvitationEmailDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertInvitationAccess(user, invitationId);
    return this.invitations.changeEmail(invitationId, body.email, user.id);
  }

  @Delete('invitations/:invitationId')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertInvitationAccess(user, invitationId);
    return this.invitations.revoke(invitationId, user.id);
  }

  // ============================================================
  // CRUD
  // ============================================================

  @Get('public')
  @Public()
  findPublic(@Query('branchId') branchId: string, @Query('serviceIds') serviceIds?: string) {
    if (!branchId) throw new BadRequestException('branchId là bắt buộc');
    return this.staffService.findPublic(branchId, serviceIds?.split(',').filter(Boolean));
  }

  @Get('public/:id')
  @Public()
  findPublicOne(@Param('id') id: string) {
    return this.staffService.findPublicOne(id);
  }

  @Get('me')
  @Roles('STAFF', 'BRANCH_MANAGER', 'RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('user:read:self')
  findMine(@CurrentUser() user: AuthUser) {
    return this.staffService.findMine(user.id);
  }

  /**
   * GET /api/staff
   * Danh sách nhân viên — filtered theo scope user.
   * Query: ?branchId=xxx
   */
  @Get()
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'PLATFORM_ADMIN')
  @RequirePermission('user:read:tenant', 'user:read:branch', 'user:read:platform')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    // If branchId specified, verify access
    if (branchId) {
      await assertBranchAccess(this.prisma, user, branchId);
    }
    return this.staffService.findAll(user, branchId);
  }

  /**
   * GET /api/staff/:id
   * Chi tiết nhân viên.
   */
  @Get(':id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('user:read:tenant', 'user:read:branch', 'user:read:self', 'user:read:platform')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertStaffResourceAccess(user, id);
    return this.staffService.findOne(id);
  }

  /**
   * POST /api/staff
   * Thêm nhân viên mới vào chi nhánh.
   */
  @Post()
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  @Audited({ action: AuditAction.CREATE, entityType: 'StaffProfile' })
  async create(
    @Body() body: {
      branchId: string;
      fullName: string;
      position?: string;
      bio?: string;
      userId?: string;
      hiredAt?: string;
      publicVisible?: boolean;
      isBookable?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.branchId || !body.fullName) {
      throw new BadRequestException('branchId và fullName là bắt buộc');
    }
    await assertBranchAccess(this.prisma, user, body.branchId);
    return this.staffService.create(body);
  }

  /**
   * PATCH /api/staff/:id
   * Cập nhật hồ sơ nhân viên.
   */
  @Patch(':id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  @Audited({ action: AuditAction.UPDATE, entityType: 'StaffProfile' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      fullName?: string;
      position?: string;
      bio?: string;
      status?: 'PROFILE_ONLY' | 'INVITED' | 'ACTIVE' | 'LOCKED' | 'INACTIVE';
      publicVisible?: boolean;
      isBookable?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.staffService.getBranchIdByStaff(id);
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.update(id, body);
  }

  @Post(':id/branch-assignments')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  @Audited({ action: AuditAction.CREATE, entityType: 'StaffBranchAssignment' })
  async assignBranch(
    @Param('id') id: string,
    @Body() body: {
      branchId: string;
      startDate: string;
      endDate?: string;
      jobTitle?: string;
      isPrimary?: boolean;
      isBookable?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const currentBranchId = await this.staffService.getBranchIdByStaff(id);
    await assertBranchAccess(this.prisma, user, currentBranchId);
    await assertBranchAccess(this.prisma, user, body.branchId);
    return this.staffService.assignBranch(id, body);
  }

  /**
   * DELETE /api/staff/:id
   * Khóa nhân viên (deactivate, không xóa cứng).
   */
  @Delete(':id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:role_assign:tenant', 'user:role_assign:branch')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'StaffProfile' })
  async deactivate(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.staffService.getBranchIdByStaff(id);
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.deactivate(id, body, user.id);
  }

  @Get(':id/offboarding-impact')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('user:read:tenant', 'user:read:branch')
  async offboardingImpact(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.staffService.getBranchIdByStaff(id);
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.offboardingImpact(id);
  }

  @Patch('branches/:branchId/holidays')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchHoliday', idParam: 'branchId' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:update:tenant', 'branch:update:branch')
  async upsertHoliday(
    @Param('branchId') branchId: string,
    @Body() body: { date: string; name: string; isClosed?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.upsertHoliday(branchId, body);
  }

  @Post('branches/:branchId/special-days')
  @Audited({ action: AuditAction.CREATE, entityType: 'SpecialWorkingDay', idParam: 'branchId' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:update:tenant', 'branch:update:branch')
  async createSpecialDay(
    @Param('branchId') branchId: string,
    @Body() body: { date: string; startTime: string; endTime: string },
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.createSpecialDay(branchId, body);
  }

  // ============================================================
  // SERVICE ASSIGNMENT
  // ============================================================

  /**
   * GET /api/staff/:id/services
   * Danh sách dịch vụ đã gán.
   */
  @Get(':id/services')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('user:read:tenant', 'user:read:branch', 'user:read:self', 'user:read:platform')
  async getAssignedServices(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertStaffResourceAccess(user, id);
    return this.staffService.getAssignedServices(id);
  }

  /**
   * PUT /api/staff/:id/services
   * Gán dịch vụ cho nhân viên (replace all).
   */
  @Patch(':id/services')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('staff_service:assign:branch', 'staff_service:assign:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'StaffService' })
  async assignServices(
    @Param('id') id: string,
    @Body() body: { serviceIds: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.serviceIds || !Array.isArray(body.serviceIds)) {
      throw new BadRequestException('serviceIds phải là một mảng');
    }
    const branchId = await this.staffService.getBranchIdByStaff(id);
    await assertBranchAccess(this.prisma, user, branchId);
    return this.staffService.assignServices(id, body.serviceIds);
  }

  // ============================================================
  // COMMISSION
  // ============================================================

  /**
   * GET /api/staff/:id/commission
   * Xem hoa hồng nhân viên.
   * Staff chỉ xem của mình, Manager/Owner xem được team.
   */
  @Get(':id/commission')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async getCommission(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.assertStaffResourceAccess(user!, id);
    return this.staffService.getCommission(id, { startDate, endDate });
  }
}
