import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBranchAccess, assertBusinessAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/reviews/business/:businessId
   * Đánh giá công khai của 1 salon (public).
   */
  @Get('business/:businessId')
  @Public()
  findByBusiness(
    @Param('businessId') businessId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findByBusiness(
      businessId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /api/reviews/manage
   * Đánh giá cho salon quản lý (scoped, mọi trạng thái).
   */
  @Get('manage')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'PLATFORM_ADMIN')
  @RequirePermission('review:moderate:branch', 'review:moderate:tenant', 'review:moderate:platform')
  findForManagement(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reviewsService.findForManagement(user, { status, branchId });
  }

  /**
   * GET /api/reviews/staff/:staffId
   * Đánh giá về 1 nhân viên.
   */
  @Get('staff/:staffId')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'STAFF', 'PLATFORM_ADMIN')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async findByStaff(@Param('staffId') staffId: string, @CurrentUser() user: AuthUser) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: { userId: true, branchId: true },
    });
    if (!staff) throw new BadRequestException('Không tìm thấy nhân viên');
    if (user.roles.includes('STAFF') && staff.userId !== user.id) {
      throw new ForbiddenException('Nhân viên chỉ xem được đánh giá của mình');
    }
    await assertBranchAccess(this.prisma, user, staff.branchId);
    return this.reviewsService.findByStaff(staffId);
  }

  @Get('public/staff/:staffId')
  @Public()
  findPublicByStaff(@Param('staffId') staffId: string) {
    return this.reviewsService.findByStaff(staffId);
  }

  @Get('service/:serviceId')
  @Public()
  findByService(@Param('serviceId') serviceId: string) {
    return this.reviewsService.findByService(serviceId);
  }

  /**
   * POST /api/reviews
   * Customer tạo đánh giá (chỉ sau booking COMPLETED).
   */
  @Post()
  @Roles('CUSTOMER')
  @RequirePermission('review:create:self')
  @Audited({ action: AuditAction.CREATE, entityType: 'Review' })
  async create(
    @Body() body: {
      bookingId: string;
      overallRating: number;
      comment?: string;
      isAnonymous?: boolean;
      serviceRatings?: Array<{
        bookingServiceId: string;
        staffId?: string;
        rating: number;
        comment?: string;
      }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.bookingId || !body.overallRating) {
      throw new BadRequestException('bookingId và overallRating là bắt buộc');
    }
    if (body.overallRating < 1 || body.overallRating > 5) {
      throw new BadRequestException('overallRating phải từ 1 đến 5');
    }

    // Resolve customerId from user
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Không tìm thấy hồ sơ khách hàng');
    }

    return this.reviewsService.create({
      ...body,
      customerId: customer.id,
    });
  }

  @Post(':id/report')
  @Roles('CUSTOMER', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('review:read:public', 'review:report:tenant', 'review:report:branch')
  @Audited({ action: AuditAction.ESCALATION, entityType: 'ReviewReport' })
  report(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewsService.report(id, user.id, body.reason);
  }

  /**
   * POST /api/reviews/:id/reply
   * Salon trả lời đánh giá.
   */
  @Post(':id/reply')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('review:moderate:branch', 'review:moderate:tenant')
  @Audited({ action: AuditAction.CREATE, entityType: 'ReviewReply' })
  async reply(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.content?.trim()) {
      throw new BadRequestException('content và businessId là bắt buộc');
    }
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { booking: { select: { branch: { select: { businessId: true } } } } },
    });
    if (!review) throw new BadRequestException('Đánh giá không tồn tại');
    const businessId = review.booking.branch.businessId;
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.reviewsService.replyToReview(id, businessId, body.content, user);
  }

  /**
   * PATCH /api/reviews/:id/moderate
   * Ẩn/duyệt đánh giá.
   */
  @Patch(':id/moderate')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('review:moderate:platform')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Review' })
  async moderate(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'HIDDEN' },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.status || !['APPROVED', 'HIDDEN'].includes(body.status)) {
      throw new BadRequestException('status phải là APPROVED hoặc HIDDEN');
    }
    return this.reviewsService.moderate(id, body.status, user);
  }
}
