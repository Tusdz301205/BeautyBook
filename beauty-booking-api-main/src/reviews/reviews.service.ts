import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertCustomerPrincipal } from '../auth/account-separation';
import {
  resolveBusinessIdsForUser,
  restrictToRoles,
  resolveBranchIdsForUser,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { can } from '../common/utils/policy';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { auditLog } from '../common/utils/audit';
import { businessOwnerRecipientIds } from '../common/utils/notify';

type ReviewerIdentity = {
  isAnonymous: boolean;
  customer?: {
    user?: {
      fullName?: string | null;
      avatarMedia?: { url: string; visibility: string } | null;
    } | null;
  } | null;
};

function publicReviewerIdentity(review: ReviewerIdentity) {
  const user = review.customer?.user;
  return {
    customerName: review.isAnonymous ? 'Ẩn danh' : user?.fullName || 'Ẩn danh',
    customerAvatar: !review.isAnonymous && user?.avatarMedia?.visibility === 'PUBLIC'
      ? user.avatarMedia.url
      : null,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Lấy đánh giá của 1 salon (public).
   */
  async findByBusiness(businessId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      status: 'APPROVED',
      booking: {
        branch: { businessId },
      },
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          customer: {
            select: {
              user: { select: { fullName: true, avatarMedia: { select: { url: true, visibility: true } } } },
            },
          },
          serviceRatings: {
            include: {
              staff: { select: { fullName: true } },
              bookingService: {
                include: { service: { select: { name: true } } },
              },
            },
          },
          booking: {
            select: {
              appointmentDate: true,
              branch: { select: { name: true } },
            },
          },
          businessReply: { select: { id: true, content: true, createdAt: true, updatedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    // Tính average rating
    const avgResult = await this.prisma.review.aggregate({
      where,
      _avg: { overallRating: true },
      _count: true,
    });

    return {
      data: reviews.map((r) => ({
        id: r.id,
        overallRating: r.overallRating,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        ...publicReviewerIdentity(r),
        branchName: r.booking?.branch?.name,
        appointmentDate: r.booking?.appointmentDate,
        serviceRatings: r.serviceRatings.map((sr) => ({
          serviceName: sr.bookingService?.service?.name,
          staffName: sr.staff?.fullName,
          rating: sr.rating,
          comment: sr.comment,
        })),
        businessReply: r.businessReply,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        averageRating: avgResult._avg.overallRating ?? 0,
        totalReviews: avgResult._count,
      },
    };
  }

  /**
   * Lấy đánh giá cho salon quản lý (tất cả trạng thái, scoped).
   */
  async findForManagement(user: AuthUser, filters?: { status?: string; branchId?: string }) {
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']));
    let allowedBranchIds: string[] | null = null;

    const where: any = { deletedAt: null };
    if (filters?.status) where.status = filters.status;

    if (!allowedIds.includes(ALL_TENANTS)) {
      allowedBranchIds = (await Promise.all(
        allowedIds.map((businessId) => resolveBranchIdsForUser(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']), businessId)),
      )).flatMap((ids) => ids ?? []);
      where.booking = {
        branch: { businessId: { in: allowedIds } },
        branchId: { in: allowedBranchIds },
      };
    }

    if (filters?.branchId) {
      if (allowedBranchIds && !allowedBranchIds.includes(filters.branchId)) {
        throw new ForbiddenException('Không có quyền xem review của chi nhánh này');
      }
      where.booking = { ...where.booking, branchId: filters.branchId };
    }

    const reviews = await this.prisma.review.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        booking: {
          select: {
            bookingCode: true,
            appointmentDate: true,
            branch: { select: { id: true, name: true } },
          },
        },
        serviceRatings: {
          include: {
            staff: { select: { fullName: true } },
            bookingService: {
              include: { service: { select: { name: true } } },
            },
          },
        },
        businessReply: { select: { id: true, content: true, createdAt: true, updatedAt: true } },
        reports: { select: { id: true, reason: true, createdAt: true, reporterId: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!reviews.length) return reviews;
    const reviewIds = reviews.map((review) => review.id);
    const [appeals, moderationEvents] = await Promise.all([
      this.prisma.reviewAppeal.findMany({
        where: { reviewId: { in: reviewIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewModerationEvent.findMany({
        where: { reviewId: { in: reviewIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return reviews.map((review) => ({
      ...review,
      appeals: appeals.filter((appeal) => appeal.reviewId === review.id),
      moderationEvents: moderationEvents.filter((event) => event.reviewId === review.id),
    }));
  }

  /**
   * Xem đánh giá công khai về 1 nhân viên, giữ nguyên lựa chọn ẩn danh.
   */
  async findByStaff(staffId: string) {
    const ratings = await this.prisma.reviewServiceRating.findMany({
      where: { staffId, review: { status: 'APPROVED', deletedAt: null } },
      include: {
        review: {
          select: {
            overallRating: true,
            comment: true,
            status: true,
            createdAt: true,
            isAnonymous: true,
            customer: {
              select: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
        bookingService: {
          include: { service: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

    return {
      averageRating: Math.round(avgRating * 10) / 10,
      totalRatings: ratings.length,
      ratings: ratings.map((r) => ({
          rating: r.rating,
          comment: r.comment,
          serviceName: r.bookingService?.service?.name,
          customerName: publicReviewerIdentity(r.review).customerName,
          createdAt: r.createdAt,
        })),
    };
  }

  async findByService(serviceId: string) {
    const where = {
      bookingService: { serviceId },
      review: { status: 'APPROVED' as const, deletedAt: null },
    };
    const [ratings, summary] = await Promise.all([
      this.prisma.reviewServiceRating.findMany({
        where,
        select: {
          rating: true, comment: true, createdAt: true,
          staff: { select: { id: true, fullName: true } },
          review: { select: { isAnonymous: true, customer: { select: { user: { select: { fullName: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.reviewServiceRating.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      averageRating: Math.round((summary._avg.rating ?? 0) * 10) / 10,
      totalRatings: summary._count,
      ratings: ratings.map((row) => ({
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        staff: row.staff,
        customerName: publicReviewerIdentity(row.review).customerName,
      })),
    };
  }

  /**
   * Tạo đánh giá (customer, chỉ sau khi booking COMPLETED).
   */
  async create(data: {
    bookingId: string;
    customerId: string;
    overallRating: number;
    comment?: string;
    isAnonymous?: boolean;
    serviceRatings?: Array<{
      bookingServiceId: string;
      staffId?: string;
      rating: number;
      comment?: string;
    }>;
  }, actor: AuthUser) {
    assertCustomerPrincipal(actor);
    const policy = await this.platformSettings.getEffective();
    const comment = data.comment?.trim() ?? '';
    if (comment.length < policy.reviewMinLength) {
      throw new BadRequestException(`Nội dung đánh giá cần ít nhất ${policy.reviewMinLength} ký tự.`);
    }
    if (data.isAnonymous && !policy.allowAnonymousReview) {
      throw new BadRequestException('Nền tảng hiện không cho phép đánh giá ẩn danh.');
    }
    // Verify booking exists, is COMPLETED, belongs to this customer, not yet reviewed
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        review: { select: { id: true } },
        customer: { select: { userId: true } },
        bookingServices: { select: { id: true, staffId: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking không tồn tại');
    if (booking.customerId !== data.customerId || booking.customer.userId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền đánh giá booking này');
    }
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Chỉ có thể đánh giá sau khi dịch vụ hoàn thành');
    }
    if (booking.review) {
      throw new BadRequestException('Booking này đã được đánh giá');
    }
    if (data.serviceRatings?.length) {
      const bookingServices = new Map(booking.bookingServices.map((item) => [item.id, item]));
      const seen = new Set<string>();
      for (const rating of data.serviceRatings) {
        const bookingService = bookingServices.get(rating.bookingServiceId);
        if (!bookingService || seen.has(rating.bookingServiceId)) {
          throw new BadRequestException('Dịch vụ đánh giá không thuộc booking hoặc bị trùng');
        }
        if (rating.rating < 1 || rating.rating > 5) {
          throw new BadRequestException('Điểm dịch vụ phải từ 1 đến 5');
        }
        if (rating.staffId && rating.staffId !== bookingService.staffId) {
          throw new BadRequestException('Nhân viên đánh giá không khớp booking');
        }
        seen.add(rating.bookingServiceId);
      }
    }

    return this.prisma.review.create({
      data: {
        bookingId: data.bookingId,
        customerId: data.customerId,
        overallRating: data.overallRating,
        comment: comment || null,
        isAnonymous: Boolean(data.isAnonymous),
        status: 'APPROVED',
        serviceRatings: data.serviceRatings?.length
          ? {
              createMany: {
                data: data.serviceRatings.map((sr) => ({
                  bookingServiceId: sr.bookingServiceId,
                  staffId: sr.staffId ?? null,
                  rating: sr.rating,
                  comment: sr.comment ?? null,
                })),
              },
            }
          : undefined,
      },
      include: {
        serviceRatings: true,
      },
    });
  }

  async report(reviewId: string, reporterId: string, input: { reason: string; category?: string; severity?: string }) {
    const reason = input.reason;
    if (!reason?.trim()) throw new BadRequestException('Lý do báo cáo là bắt buộc');
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true, status: true, customer: { select: { userId: true } },
        booking: { select: { branch: { select: { businessId: true } } } },
      },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');
    const duplicate = await this.prisma.reviewReport.findUnique({
      where: { reviewId_reporterId: { reviewId, reporterId } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('Bạn đã báo cáo đánh giá này');
    const severity = (input.severity || 'MEDIUM').toUpperCase();
    const category = (input.category || 'OTHER').toUpperCase();
    const quarantine = ['HIGH', 'CRITICAL'].includes(severity) || ['PII', 'THREAT', 'HATE', 'SEXUAL'].includes(category);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reviewReport.create({ data: { reviewId, reporterId, reason: reason.trim() } });
      const reportCount = await tx.reviewReport.count({ where: { reviewId } });
      if (review.status !== 'HIDDEN') {
        await tx.review.update({ where: { id: reviewId }, data: { status: quarantine ? 'HIDDEN' : 'REPORTED' } });
      }
      const nextStatus = review.status === 'HIDDEN' ? 'HIDDEN' : quarantine ? 'HIDDEN' : 'REPORTED';
      await tx.reviewModerationEvent.create({
        data: {
          reviewId,
          actorId: reporterId,
          action: quarantine ? 'QUARANTINE' : 'REPORT',
          fromStatus: review.status,
          toStatus: nextStatus,
          reasonCode: category,
          reason: reason.trim(),
          reportCategory: category,
          severity,
        },
      });
      const ownerIds = await businessOwnerRecipientIds(tx, review.booking.branch.businessId);
      const recipients = [...new Set([review.customer.userId, ...ownerIds])];
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((userId) => ({
        userId,
        type: 'SYSTEM',
        severity: quarantine ? 'WARNING' : 'INFO',
        title: quarantine ? 'Đánh giá tạm ẩn để kiểm duyệt' : 'Đánh giá đã được báo cáo',
        body: `Phân loại: ${category} — mức độ: ${severity}`,
        targetType: 'REVIEW',
        targetId: reviewId,
        actionUrl: '/reviews',
      })) });
      return { reportCount, status: nextStatus, quarantined: quarantine };
    });
    await auditLog(this.prisma, {
      userId: reporterId, action: 'STATUS_CHANGE', entityType: 'Review', entityId: reviewId,
      oldData: { status: review.status }, newData: { status: result.status, reportCount: result.reportCount },
      reason: 'review reported for platform moderation',
    });
    return result;
  }

  /**
   * Salon trả lời đánh giá (thông qua BusinessComment).
   */
  async replyToReview(
    reviewId: string,
    businessId: string,
    content: string,
    user: AuthUser,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        booking: {
          include: { branch: { select: { id: true, businessId: true } } },
        },
      },
    });

    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    // Verify salon ownership
    if (review.booking.branch.businessId !== businessId) {
      throw new ForbiddenException('Bạn không có quyền trả lời đánh giá này');
    }
    const context = { tenantId: businessId, branchId: review.booking.branch.id };
    if (!can(user, 'review:moderate:tenant', context)) {
      throw new ForbiddenException('Không có quyền trả lời đánh giá của chi nhánh này');
    }

    const normalized = content?.trim();
    if (!normalized) throw new BadRequestException('Nội dung phản hồi là bắt buộc');
    return this.prisma.businessComment.upsert({
      where: { reviewId },
      create: {
        reviewId,
        businessId,
        customerId: review.customerId,
        content: normalized,
        parentCommentId: null,
      },
      update: { content: normalized, status: 'VISIBLE', deletedAt: null },
    });
  }

  /**
   * Moderate review — ẩn/duyệt (Owner hoặc Admin).
   */
  async moderate(
    reviewId: string,
    status: 'APPROVED' | 'HIDDEN',
    reasonCode: string,
    reason: string,
    user: AuthUser,
  ) {
    if (!reasonCode?.trim() || !reason?.trim()) throw new BadRequestException('Mã lý do và nội dung quyết định là bắt buộc');
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true, customer: { select: { userId: true } }, booking: { select: { branch: { select: { id: true, businessId: true } } } } },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');
    if (!can(user, 'review:moderate:platform')) {
      throw new ForbiddenException('Không có quyền kiểm duyệt đánh giá này');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({ where: { id: reviewId }, data: { status } });
      await tx.reviewModerationEvent.create({ data: {
        reviewId,
        actorId: user.id,
        action: status === 'APPROVED' ? (review.status === 'HIDDEN' ? 'RESTORE' : 'APPROVE') : 'HIDE',
        fromStatus: review.status,
        toStatus: status,
        reasonCode: reasonCode.trim(),
        reason: reason.trim(),
      } });
      await tx.notification.create({ data: {
        userId: review.customer.userId,
        type: 'SYSTEM',
        severity: status === 'HIDDEN' ? 'WARNING' : 'INFO',
        title: status === 'HIDDEN' ? 'Đánh giá đã bị ẩn' : 'Đánh giá đã được hiển thị',
        body: reason.trim(),
        targetType: 'REVIEW',
        targetId: reviewId,
        actionUrl: '/customer/reviews',
      } });
      return updated;
    });
  }

  async appeal(reviewId: string, appellantId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do khiếu nại là bắt buộc');
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true, customer: { select: { userId: true } }, booking: { select: { branch: { select: { businessId: true } } } } },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');
    const businessAccess = await this.prisma.userRole.findFirst({
      where: { userId: appellantId, businessId: review.booking.branch.businessId, role: { code: { in: ['BUSINESS_OWNER'] } } },
      select: { id: true },
    });
    if (review.customer.userId !== appellantId && !businessAccess) throw new ForbiddenException('Không có quyền khiếu nại đánh giá này');
    const pending = await this.prisma.reviewAppeal.findFirst({ where: { reviewId, status: 'PENDING' }, select: { id: true } });
    if (pending) throw new BadRequestException('Đánh giá đã có khiếu nại đang chờ xử lý');
    return this.prisma.$transaction(async (tx) => {
      const appeal = await tx.reviewAppeal.create({ data: { reviewId, appellantId, reason: reason.trim() } });
      await tx.reviewModerationEvent.create({ data: {
        reviewId, actorId: appellantId, action: 'APPEAL_SUBMITTED',
        fromStatus: review.status, toStatus: review.status,
        reasonCode: 'APPEAL', reason: reason.trim(),
      } });
      return appeal;
    });
  }

  async resolveAppeal(appealId: string, approve: boolean, resolution: string, user: AuthUser) {
    if (!resolution?.trim()) throw new BadRequestException('Kết luận khiếu nại là bắt buộc');
    if (!can(user, 'review:moderate:platform')) throw new ForbiddenException('Không có quyền xử lý khiếu nại');
    return this.prisma.$transaction(async (tx) => {
      const appeal = await tx.reviewAppeal.findUnique({ where: { id: appealId } });
      if (!appeal || appeal.status !== 'PENDING') throw new BadRequestException('Khiếu nại không còn chờ xử lý');
      const review = await tx.review.findUniqueOrThrow({ where: { id: appeal.reviewId } });
      const nextStatus = approve ? 'APPROVED' : review.status;
      if (approve) await tx.review.update({ where: { id: review.id }, data: { status: 'APPROVED' } });
      const updated = await tx.reviewAppeal.update({ where: { id: appealId }, data: {
        status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: user.id, resolution: resolution.trim(), reviewedAt: new Date(),
      } });
      await tx.reviewModerationEvent.create({ data: {
        reviewId: review.id, actorId: user.id, action: approve ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED',
        fromStatus: review.status, toStatus: nextStatus, reasonCode: 'APPEAL_DECISION', reason: resolution.trim(),
      } });
      return updated;
    });
  }
}
