import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { ServicesService } from './services.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBranchAccess,
  assertBusinessAccess,
  resolveBranchIdsForUser,
  resolveBusinessIdsForUser,
} from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessServiceDto,
  CreateCanonicalServiceDto,
  CreateServiceCategoryDto,
  CreateServiceDto,
  UpdateBranchOfferingPricingDto,
  UpdateBranchOfferingStatusDto,
  UpdateBusinessServiceDto,
  UpdateCanonicalServiceDto,
  UpdateServiceDto,
} from './dto/service.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly prisma: PrismaService,
  ) {}

  private async accessibleBranchIds(user: AuthUser): Promise<string[]> {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const resolved = await Promise.all(
      businessIds.map(async (businessId) => {
        const ids = await resolveBranchIdsForUser(this.prisma, user, businessId);
        if (ids) return ids;
        const branches = await this.prisma.branch.findMany({
          where: { businessId, deletedAt: null },
          select: { id: true },
        });
        return branches.map((branch) => branch.id);
      }),
    );
    return [...new Set(resolved.flat())];
  }

  @Get('search')
  @Public()
  search(
    @Query('query') query?: string,
    @Query('location') location?: string,
    @Query('canonicalServiceId') canonicalServiceId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('date') date?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.servicesService.search({
      query,
      location,
      canonicalServiceId,
      minPrice: minPrice === undefined ? undefined : Number(minPrice),
      maxPrice: maxPrice === undefined ? undefined : Number(maxPrice),
      minRating: minRating === undefined ? undefined : Number(minRating),
      date,
      sort,
      page: page === undefined ? undefined : Number(page),
      limit: limit === undefined ? undefined : Number(limit),
    });
  }

  @Get('canonical')
  @Public()
  canonicalCatalog() {
    return this.servicesService.listCanonical(true);
  }

  @Get('canonical/manage')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('canonical_service:manage:platform')
  canonicalManagement() {
    return this.servicesService.listCanonical(false);
  }

  @Post('canonical')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('canonical_service:manage:platform')
  @Audited({ action: AuditAction.CREATE, entityType: 'CanonicalService' })
  createCanonical(@Body() body: CreateCanonicalServiceDto) {
    return this.servicesService.createCanonical(body);
  }

  @Patch('canonical/:id')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('canonical_service:manage:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'CanonicalService' })
  updateCanonical(@Param('id') id: string, @Body() body: UpdateCanonicalServiceDto) {
    return this.servicesService.updateCanonical(id, body);
  }

  /** Public filter taxonomy. Salon menu categories live at /categories/manage. */
  @Get('categories')
  @Public()
  getPublicCategories() {
    return this.servicesService.listCanonical(true);
  }

  @Get('categories/manage')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('service_category:manage:tenant', 'branch_service_offering:status:branch')
  async getBusinessCategories(@CurrentUser() user: AuthUser) {
    return this.servicesService.getBusinessCategories(
      await resolveBusinessIdsForUser(this.prisma, user),
    );
  }

  @Post('categories')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('service_category:manage:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'ServiceCategory' })
  async createCategory(@Body() body: CreateServiceCategoryDto, @CurrentUser() user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    return this.servicesService.createCategory(body);
  }

  @Get()
  @Public()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.servicesService.findAll(branchId, true, undefined, { page, limit });
  }

  @Get('manage')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('business_service:update:tenant', 'branch_service_offering:status:branch')
  async findAllForManagement(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    if (branchId) {
      await assertBranchAccess(this.prisma, user, branchId);
      return this.servicesService.findAll(branchId);
    }
    return this.servicesService.findAll(undefined, false, await this.accessibleBranchIds(user));
  }

  @Get('workspace/manage')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('business_service:update:tenant', 'branch_service_offering:status:branch')
  async workspace(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    const allowedBranchIds = await this.accessibleBranchIds(user);
    if (branchId && !allowedBranchIds.includes(branchId)) {
      await assertBranchAccess(this.prisma, user, branchId);
    }
    return this.servicesService.findWorkspace(allowedBranchIds, branchId);
  }

  @Post('catalog')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:create:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'BusinessService' })
  async createCatalog(@Body() body: CreateBusinessServiceDto, @CurrentUser() user: AuthUser) {
    const targets = [...new Set([body.branchId, ...(body.branchIds ?? [])])];
    for (const branchId of targets) await assertBranchAccess(this.prisma, user, branchId);
    return this.servicesService.createCatalog(body);
  }

  @Patch('catalog/:id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:update:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BusinessService' })
  async updateCatalog(
    @Param('id') id: string,
    @Body() body: UpdateBusinessServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const catalog = await this.prisma.businessService.findUniqueOrThrow({
      where: { id },
      select: { businessId: true },
    });
    await assertBusinessAccess(this.prisma, user, catalog.businessId);
    return this.servicesService.updateCatalog(id, body);
  }

  @Delete('catalog/:id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:archive:tenant')
  @Audited({ action: AuditAction.DELETE, entityType: 'BusinessService' })
  async archiveCatalog(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const catalog = await this.prisma.businessService.findUniqueOrThrow({
      where: { id },
      select: { businessId: true },
    });
    await assertBusinessAccess(this.prisma, user, catalog.businessId);
    return this.servicesService.archiveCatalog(id);
  }

  @Post('catalog/:id/branches/:branchId/:action')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch_service_offering:status:tenant', 'branch_service_offering:status:branch')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchServiceOffering' })
  async setBranchAvailability(
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Param('action') action: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!['apply', 'pause', 'reactivate'].includes(action)) {
      throw new BadRequestException('Action phải là apply, pause hoặc reactivate');
    }
    await assertBranchAccess(this.prisma, user, branchId);
    return this.servicesService.setBranchAvailability(
      id,
      branchId,
      action as 'apply' | 'pause' | 'reactivate',
    );
  }

  @Patch('offerings/:id/status')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('branch_service_offering:status:tenant', 'branch_service_offering:status:branch')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchServiceOfferingStatus' })
  async updateOfferingStatus(
    @Param('id') id: string,
    @Body() body: UpdateBranchOfferingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({
      where: { id },
      select: { branchId: true },
    });
    await assertBranchAccess(this.prisma, user, offering.branchId);
    return this.servicesService.updateOfferingStatus(id, body);
  }

  @Patch('offerings/:id/pricing')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch_service_offering:pricing:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchServiceOfferingPricing' })
  async updateOfferingPricing(
    @Param('id') id: string,
    @Body() body: UpdateBranchOfferingPricingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({
      where: { id },
      select: { branch: { select: { businessId: true } } },
    });
    await assertBusinessAccess(this.prisma, user, offering.branch.businessId);
    return this.servicesService.updateOfferingPricing(id, body);
  }

  @Get('admin-curated/all')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('service:read:platform')
  listAllForPlatform() {
    return this.servicesService.findAllForMarketing();
  }

  @Get(':id/variants')
  @Public()
  listVariants(@Param('id') id: string) {
    return this.servicesService.listVariants(id, true);
  }

  @Post(':id/variants')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch_service_offering:pricing:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'ServiceVariant' })
  async createVariant(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, offering.branchId);
    return this.servicesService.createVariant(id, body);
  }

  @Patch('variants/:variantId')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch_service_offering:pricing:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'ServiceVariant', idParam: 'variantId' })
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    const variant = await this.prisma.serviceVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { serviceId: true },
    });
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({ where: { id: variant.serviceId }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, offering.branchId);
    return this.servicesService.updateVariant(variantId, body);
  }

  @Post(':id/dependencies')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:update:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'ServiceDependency' })
  async addDependency(
    @Param('id') id: string,
    @Body() body: { requiredServiceId: string; dependencyType: 'REQUIRED' | 'ADD_ON' | 'INCOMPATIBLE' },
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, offering.branchId);
    return this.servicesService.addDependency(id, body.requiredServiceId, body.dependencyType);
  }

  @Post(':id/price-rules')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch_service_offering:pricing:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'ServicePriceRule' })
  async createPriceRule(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({ where: { id }, select: { branchId: true } });
    await assertBranchAccess(this.prisma, user, offering.branchId);
    return this.servicesService.createPriceRule(id, body);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id, true);
  }

  /** Legacy compatibility: only Owner may create a new business service. */
  @Post()
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:create:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'BranchServiceOffering' })
  async create(@Body() body: CreateServiceDto, @CurrentUser() user: AuthUser) {
    await assertBranchAccess(this.prisma, user, body.branchId);
    return this.servicesService.create(body);
  }

  /** Legacy compatibility: pricing is still Owner-only. */
  @Patch(':id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('branch_service_offering:pricing:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BranchServiceOffering' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({
      where: { id },
      select: { branch: { select: { businessId: true } } },
    });
    await assertBusinessAccess(this.prisma, user, offering.branch.businessId);
    if (body.price !== undefined || body.durationMinutes !== undefined) {
      await this.servicesService.updateOfferingPricing(id, body);
    }
    if (body.status !== undefined || body.bookable !== undefined) {
      return this.servicesService.updateOfferingStatus(id, body);
    }
    return this.prisma.branchServiceOffering.findUniqueOrThrow({ where: { id } });
  }

  @Delete(':id')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business_service:archive:tenant')
  @Audited({ action: AuditAction.DELETE, entityType: 'BranchServiceOffering' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const offering = await this.prisma.branchServiceOffering.findUniqueOrThrow({
      where: { id },
      select: { branch: { select: { businessId: true } } },
    });
    await assertBusinessAccess(this.prisma, user, offering.branch.businessId);
    return this.servicesService.softDelete(id);
  }
}
