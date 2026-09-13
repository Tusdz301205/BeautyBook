import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationSeverity, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách thông báo của user (phân trang).
   */
  async findByUser(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      state?: 'all' | 'unread' | 'read';
      type?: string;
      severity?: string;
      search?: string;
    },
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options?.unreadOnly) where.isRead = false;
    if (options?.state === 'unread') where.isRead = false;
    if (options?.state === 'read') where.isRead = true;
    const notificationTypes: readonly string[] = [
      'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'PROMOTION', 'SYSTEM',
      'PAYMENT', 'BOOKING_RESCHEDULE_REQUEST', 'BOOKING_RESCHEDULE_APPROVED',
      'BOOKING_RESCHEDULE_REJECTED', 'BOOKING_PAYMENT_RECEIVED', 'BOOKING_COMPLETED',
      'REVIEW_REMINDER', 'SALON_VIOLATION_ALERT',
    ];
    const severities: readonly string[] = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'];
    if (options?.type && notificationTypes.includes(options.type)) where.type = options.type;
    if (options?.severity && severities.includes(options.severity)) where.severity = options.severity;
    const search = options?.search?.trim().slice(0, 120);
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          relatedBooking: {
            select: {
              id: true,
              bookingCode: true,
              status: true,
              appointmentDate: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Đánh dấu 1 thông báo đã đọc.
   */
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc.
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Tạo thông báo mới (internal — gọi từ service khác).
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    relatedBookingId?: string;
    severity?: NotificationSeverity;
    targetType?: string;
    targetId?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        relatedBookingId: data.relatedBookingId ?? null,
        severity: data.severity ?? 'INFO',
        targetType: data.targetType ?? (data.relatedBookingId ? 'BOOKING' : null),
        targetId: data.targetId ?? data.relatedBookingId ?? null,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata as any,
      },
    });
  }

  /**
   * Tạo thông báo hàng loạt (gửi đến nhiều user).
   */
  async createBulk(
    userIds: string[],
    data: {
      type: NotificationType;
      title: string;
      body?: string;
      relatedBookingId?: string;
      severity?: NotificationSeverity;
      targetType?: string;
      targetId?: string;
      actionUrl?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        relatedBookingId: data.relatedBookingId ?? null,
        severity: data.severity ?? 'INFO',
        targetType: data.targetType ?? (data.relatedBookingId ? 'BOOKING' : null),
        targetId: data.targetId ?? data.relatedBookingId ?? null,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata as any,
      })),
    });
  }

  /**
   * Đếm thông báo chưa đọc.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  // ============================================================
  // DEVICE TOKEN (cho push notification)
  // ============================================================

  /**
   * Đăng ký device token (FCM/APNS).
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  /**
   * Xóa device token (khi đăng xuất).
   */
  async removeDeviceToken(token: string, userId: string) {
    return this.prisma.deviceToken.deleteMany({ where: { token, userId } });
  }

  /**
   * Lấy device tokens của user (để gửi push).
   */
  async getDeviceTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });
  }
}
