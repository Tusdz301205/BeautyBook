import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  resolveBusinessIdsForUser,
  resolveBranchIdsForUser,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { can } from '../common/utils/policy';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { auditLog } from '../common/utils/audit';

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
      status: { in: ['APPROVED', 'REPORTED'] },
      booking: {
        branch: { businessId },
      },
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          customer: {
            include: {
              user: { select: { fullName: true, avatarMedia: { select: { url: true } } } },
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
        customerName: r.isAnonymous ? 'Ẩn danh' : r.customer?.user?.fullName ?? 'Ẩn danh',
        customerAvatar: r.isAnonymous ? null : r.customer?.user?.avatarMedia?.url ?? null,
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
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, user);
    let allowedBranchIds: string[] | null = null;

    const where: any = { deletedAt: null };
    if (filters?.status) where.status = filters.status;

    if (!allowedIds.includes(ALL_TENANTS)) {
      allowedBranchIds = (await Promise.all(
        allowedIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
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

    return this.prisma.review.findMany({
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
  }

  /**
   * Xem đánh giá về 1 nhân viên (staff xem về mình).
   */
  async findByStaff(staffId: string) {
    const ratings = await this.prisma.reviewServiceRating.findMany({
      where: { staffId, review: { status: { in: ['APPROVED', 'REPORTED'] }, deletedAt: null } },
      include: {
        review: {
          select: {
            overallRating: true,
            comment: true,
            status: true,
            createdAt: true,
            customer: {
              include: {
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
          customerName: r.review.customer?.user?.fullName ?? 'Ẩn danh',
          createdAt: r.createdAt,
        })),
    };
  }

  async findByService(serviceId: string) {
    const ratings = await this.prisma.reviewServiceRating.findMany({
      where: {
        bookingService: { serviceId },
        review: { status: { in: ['APPROVED', 'REPORTED'] }, deletedAt: null },
      },
      select: {
        rating: true, comment: true, createdAt: true,
        staff: { select: { id: true, fullName: true } },
        review: { select: { customer: { select: { user: { select: { fullName: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const averageRating = ratings.length
      ? Math.round((ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length) * 10) / 10
      : 0;
    return {
      averageRating,
      totalRatings: ratings.length,
      ratings: ratings.map((row) => ({
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        staff: row.staff,
        customerName: row.review.customer.user.fullName || 'Ẩn danh',
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
  }) {
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
        bookingServices: { select: { id: true, staffId: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking không tồn tại');
    if (booking.customerId !== data.customerId) {
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

  async report(reviewId: string, reporterId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do báo cáo là bắt buộc');
    const review = await this.prisma.review.findUnique({ where: { id: reviewId }, select: { id: true, status: true } });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reviewReport.create({ data: { reviewId, reporterId, reason: reason.trim() } });
      const reportCount = await tx.reviewReport.count({ where: { reviewId } });
      if (review.status !== 'HIDDEN') {
        await tx.review.update({ where: { id: reviewId }, data: { status: 'REPORTED' } });
      }
      return { reportCount, status: review.status === 'HIDDEN' ? 'HIDDEN' : 'REPORTED' };
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
    if (!can(user, 'review:moderate:branch', context) &&
        !can(user, 'review:moderate:tenant', context)) {
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
  async moderate(reviewId: string, status: 'APPROVED' | 'HIDDEN', user: AuthUser) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, booking: { select: { branch: { select: { id: true, businessId: true } } } } },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');
    if (!can(user, 'review:moderate:platform')) {
      throw new ForbiddenException('Không có quyền kiểm duyệt đánh giá này');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });
  }
}
