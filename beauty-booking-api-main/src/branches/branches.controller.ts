import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { RequireScope } from '../common/decorators/scope.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBranchAccess,
  assertBusinessAccess,
  resolveBusinessIdByBranch,
} from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import {
  CreateBranchDraftDto,
  SaveBranchOnboardingDto,
  UpdateBranchDto,
} from './dto/branch.dto';
import { BranchStateService, BranchTransitionAction } from './branch-state.service';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly branchStateService: BranchStateService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public — customer app cần list chi nhánh mà không cần đăng nhập.
   */
  @Get()
  @Public()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('districtId') districtId?: string,
    @Query('area') area?: string,
    @Query('serviceQuery') serviceQuery?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.branchesService.findAll({ search, status, categoryId, districtId, area, serviceQuery, minPrice, maxPrice, sort, page, limit });
  }

  @Get('manage')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:read:platform')
  findAllForManagement(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.branchesService.findAll({ search, status, categoryId, page, limit }, true);
  }

  @Get('locations/districts')
  @Public()
  listDistricts() {
    return this.branchesService.listDistricts();
  }

  @Get('accessible')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('branch:read:tenant', 'branch:read:branch', 'branch:read:platform')
  findAccessible(@CurrentUser() user: AuthUser) {
    return this.branchesService.findAccessible(user);
  }

  @Get('accessible/:id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('branch:read:tenant', 'branch:read:branch', 'branch:read:platform')
  async findAccessibleOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.findOne(id);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.branchesService.findPublic(id);
  }

  /**
   * PATCH /api/branches/:id/status
   * Compliance / Platform-side onboarding updates.
   */
  @Patch(':id/status')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:status:platform')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Branch' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.status) throw new BadRequestException('status required');
    if (['REJECTED', 'REQUEST_INFO'].includes(body.status) && !body.reason?.trim()) {
      throw new BadRequestException('reason required for this branch review action');
    }
    const decision =
      body.status === 'ACTIVE' || body.status === 'APPROVED' || body.status === 'Hoạt động'
        ? 'APPROVE'
        : body.status === 'REQUEST_INFO' || body.status === 'NEED_MORE_INFO' || body.status === 'PENDING' || body.status === 'Chờ duyệt'
          ? 'REQUEST_INFO'
          : 'REJECT';
    return this.branchesService.review(id, decision, body.reason, user.id);
  }

  /**
   * POST /api/branches — create a new branch inside an existing business.
   * Tenant-scoped: BUSINESS_OWNER may create branches in their own business.
   */
  @Post()
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:create:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'Branch' })
  async create(
    @Body() body: CreateBranchDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    const assignCreatorAsManager =
      user.roles.includes('BRANCH_MANAGER') &&
      (user.permissions ?? []).includes('branch:create:tenant');
    return this.branchesService.create(body, user.id, assignCreatorAsManager);
  }

  @Patch(':id/onboarding')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:update:tenant', 'branch:update:branch', 'branch:create:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchOnboarding' })
  async saveOnboarding(
    @Param('id') id: string,
    @Body() body: SaveBranchOnboardingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.saveOnboarding(id, body);
  }

  @Post(':id/copy-services')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:create:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'BranchServiceCopy' })
  async copyServices(
    @Param('id') id: string,
    @Body() body: { sourceBranchId: string; serviceIds: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    await assertBranchAccess(this.prisma, user, body.sourceBranchId);
    return this.branchesService.copyServices(id, body.sourceBranchId, body.serviceIds ?? []);
  }

  @Post(':id/documents')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:update:tenant', 'branch:update:branch')
  @Audited({ action: AuditAction.CREATE, entityType: 'BranchDocument' })
  async attachDocument(
    @Param('id') id: string,
    @Body() body: {
      mediaId: string;
      documentType: 'OPERATING_LICENSE' | 'LOCATION_DOCUMENT' | 'SERVICE_LICENSE' | 'FIRE_SAFETY' | 'OTHER';
      documentName: string;
      documentNumber?: string;
      issuedAt?: string;
      expiresAt?: string;
      note?: string;
      replaceDocumentId?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.attachDocument(id, user.id, body);
  }

  @Delete(':id/documents/:documentId')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:update:tenant', 'branch:update:branch')
  @Audited({ action: AuditAction.DELETE, entityType: 'BranchDocument', idParam: 'documentId' })
  async archiveDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.archiveDocument(id, documentId, user.id);
  }

  @Post(':id/submit')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:create:tenant', 'branch:update:tenant', 'branch:update:branch')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'BranchReview' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.submit(id, user.id);
  }

  @Post(':id/review')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:status:platform')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'BranchReview' })
  review(
    @Param('id') id: string,
    @Body() body: {
      decision: 'APPROVE' | 'REQUEST_INFO' | 'REJECT';
      reason?: string;
      targetStep?: number;
      deadline?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.review(
      id,
      body.decision,
      body.reason,
      user.id,
      body.targetStep,
      body.deadline,
    );
  }

  @Post(':id/publish')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch:update:tenant')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'BranchOperationalStatus' })
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.publish(id, user.id);
  }

  @Post(':id/transition')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch:status:platform', 'branch:update:tenant', 'branch:update:branch')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Branch' })
  async transition(
    @Param('id') id: string,
    @Body() body: { action: BranchTransitionAction; reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchStateService.transition(id, body.action, user.id, body.reason);
  }

  /**
   * PATCH /api/branches/:id — edit tenant/branch address/contact.
   */
  @Patch(':id')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequireScope({
    roles: ['BUSINESS_OWNER', 'BRANCH_MANAGER'],
    scopeLevel: 'branch',
    permissions: ['branch:update:branch', 'branch:update:tenant'],
  })
  @Audited({ action: AuditAction.UPDATE, entityType: 'Branch' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBranchAccess(this.prisma, user, id);
    return this.branchesService.update(id, body);
  }
}
