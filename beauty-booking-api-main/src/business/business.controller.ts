import { BadRequestException, Controller, Get, Patch, Post, Body, UseGuards, Param } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { CancellationPoliciesService } from './cancellation-policies.service';
import { UpdateCancellationPolicyDto } from './dto/cancellation-policy.dto';
import { SalonMembersService } from './salon-members.service';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { BusinessOnboardingService } from './business-onboarding.service';
import type { BusinessDraftInput } from './business-onboarding.service';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditAction, Prisma } from '@prisma/client';
import { ensureCanOnResource } from '../common/utils/policy';

@Controller('business')
@UseGuards(RolesGuard)
@Roles('BUSINESS_OWNER', 'STAFF')
export class BusinessController {
  constructor(
    private readonly cancellationPoliciesService: CancellationPoliciesService,
    private readonly salonMembersService: SalonMembersService,
    private readonly prisma: PrismaService,
    private readonly onboarding: BusinessOnboardingService,
  ) {}

  @Post('onboarding/draft')
  @Audited({ action: AuditAction.CREATE, entityType: 'BusinessOnboarding' })
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:create:self')
  createDraft(@Body() body: BusinessDraftInput, @CurrentUser() user: AuthUser) {
    return this.onboarding.createDraft(user, body);
  }

  @Get('onboarding/mine')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:create:self', 'business:update:tenant')
  findMine(@CurrentUser() user: AuthUser) {
    return this.onboarding.findMine(user);
  }

  @Patch(':businessId/onboarding')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BusinessOnboarding', idParam: 'businessId' })
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  updateDraft(
    @Param('businessId') businessId: string,
    @Body() body: BusinessDraftInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onboarding.updateDraft(businessId, user, body);
  }

  @Post(':businessId/submit')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'BusinessOnboarding', idParam: 'businessId' })
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  submit(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onboarding.submit(businessId, user);
  }

  @Patch(':businessId/review')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'BusinessOnboarding', idParam: 'businessId' })
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('business:review:platform')
  review(
    @Param('businessId') businessId: string,
    @Body() body: { decision: 'APPROVE' | 'REQUEST_INFO' | 'REJECT'; note?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.onboarding.review(businessId, body.decision, body.note, user.id);
  }

  @Get(':businessId/detail')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('branch:read:platform')
  async getPlatformDetail(@Param('businessId') businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true },
            },
          },
        },
        branches: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            publicName: true,
            status: true,
            reviewStatus: true,
            operationalStatus: true,
            addressLine: true,
            createdAt: true,
            _count: { select: { bookings: true, staff: true, services: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          include: { versions: { orderBy: { version: 'desc' }, take: 5 } },
          orderBy: { createdAt: 'desc' },
        },
        members: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, fullName: true, email: true, isActive: true } }, branch: { select: { id: true, name: true } } },
        },
        serviceCatalog: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            basePrice: true,
            baseDurationMinutes: true,
            status: true,
            canonicalService: { select: { id: true, name: true } },
            _count: { select: { branchServices: { where: { deletedAt: null } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        trustSnapshot: true,
        trustActions: { orderBy: { createdAt: 'desc' }, take: 50 },
        reviewEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
        vouchers: { select: { id: true, code: true, status: true, startDate: true, endDate: true }, orderBy: { createdAt: 'desc' } },
        ownedPromotions: { select: { id: true, name: true, status: true, startDate: true, endDate: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!business) throw new BadRequestException('Doanh nghiệp không tồn tại');
    const branchIds = business.branches.map((branch) => branch.id);
    const [auditTrail, bookingCount, ratingRows] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entityId: { in: [business.id, ...branchIds] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.booking.count({ where: { branchId: { in: branchIds }, deletedAt: null } }),
      branchIds.length
        ? this.prisma.$queryRaw<Array<{ rating: unknown; reviewCount: bigint }>>(Prisma.sql`
            SELECT AVG(review.overall_rating)::numeric(4,2) AS rating, COUNT(review.id)::bigint AS "reviewCount"
            FROM bookings booking
            JOIN reviews review ON review.booking_id = booking.id
            WHERE booking.branch_id IN (${Prisma.join(branchIds)})
              AND booking.deleted_at IS NULL
              AND review.deleted_at IS NULL
              AND review.status = 'APPROVED'
          `)
        : Promise.resolve([]),
    ]);
    const rating = ratingRows[0];
    return {
      ...business,
      auditTrail,
      summary: {
        branchCount: business.branches.length,
        activeBranchCount: business.branches.filter((branch) => branch.status === 'ACTIVE').length,
        serviceCount: business.serviceCatalog.length,
        bookingCount,
        averageRating: rating?.rating == null ? null : Math.round(Number(rating.rating) * 10) / 10,
        reviewCount: Number(rating?.reviewCount ?? 0),
      },
    };
  }

  /**
   * GET /api/business/:businessId/members
   */
  @Get(':businessId/members')
  @Roles('BUSINESS_OWNER')
  @RequirePermission('user:read:tenant')
  async listMembers(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBusinessAccess(this.prisma, user, businessId);
    ensureCanOnResource(user, 'user:read:tenant', { businessId });
    return this.salonMembersService.listByBusiness(businessId);
  }

  /**
   * GET /api/business/:businessId/cancellation-policy
   */
  @Get(':businessId/cancellation-policy')
  @RequirePermission('branch:read:tenant', 'branch:read:branch')
  async getPolicy(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.cancellationPoliciesService.getOrCreate(businessId);
  }

  /**
   * PATCH /api/business/:businessId/cancellation-policy
   */
  @Patch(':businessId/cancellation-policy')
  @Audited({ action: AuditAction.POLICY_OVERRIDE, entityType: 'CancellationPolicy', idParam: 'businessId' })
  @Roles('BUSINESS_OWNER')
  @RequirePermission('business:update:tenant')
  async updatePolicy(
    @Param('businessId') businessId: string,
    @Body() body: UpdateCancellationPolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.cancellationPoliciesService.update(businessId, user.id, body);
  }
}
