import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { combineAppointmentDateTime } from '../common/utils/booking-datetime';

@Injectable()
export class PolicyNotificationCron implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(PolicyNotificationCron.name);
  constructor(private readonly prisma: PrismaService, private readonly settings: PlatformSettingsService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch(() => this.logger.error('Policy notification tick failed')), 5 * 60 * 1000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(now = new Date()) {
    const policy = await this.settings.getEffective();
    const dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const missingCheckout = await this.prisma.staffAttendance.updateMany({
      where: { workDate: { lt: dateFrom }, checkInAt: { not: null }, checkOutAt: null, status: { notIn: ['ABSENT', 'MISSING_CHECKOUT'] } },
      data: { status: 'MISSING_CHECKOUT' },
    });
    const dateTo = new Date(dateFrom.getTime() + 2 * 24 * 60 * 60 * 1000);
    const bookings = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED', appointmentDate: { gte: dateFrom, lt: dateTo }, deletedAt: null },
      select: { id: true, appointmentDate: true, appointmentStartTime: true, customer: { select: { userId: true } }, notifications: { where: { type: 'BOOKING_REMINDER' }, select: { id: true } } },
      take: 2000,
    });
    const reminderTarget = now.getTime() + policy.appointmentReminderBeforeHours * 60 * 60 * 1000;
    const appointmentRows = bookings.filter((booking) => {
      if (booking.notifications.length) return false;
      const start = combineAppointmentDateTime(booking.appointmentDate, booking.appointmentStartTime).getTime();
      return start >= reminderTarget && start < reminderTarget + 5 * 60 * 1000;
    }).map((booking) => ({ userId: booking.customer.userId, type: 'BOOKING_REMINDER' as const, title: 'Sắp đến giờ hẹn', body: `Lịch hẹn của bạn bắt đầu sau ${policy.appointmentReminderBeforeHours} giờ.`, relatedBookingId: booking.id }));

    const completed = await this.prisma.booking.findMany({
      where: { status: 'COMPLETED', updatedAt: { lte: new Date(now.getTime() - policy.reviewReminderAfterHours * 60 * 60 * 1000) }, review: null, notifications: { none: { type: 'REVIEW_REMINDER' } }, deletedAt: null },
      select: { id: true, customer: { select: { userId: true } } }, take: 500,
    });
    const reviewRows = completed.map((booking) => ({ userId: booking.customer.userId, type: 'REVIEW_REMINDER' as const, title: 'Bạn thấy dịch vụ hôm nay thế nào?', body: 'Hãy chia sẻ đánh giá sau khi hoàn thành dịch vụ.', relatedBookingId: booking.id }));
    if (appointmentRows.length || reviewRows.length) await this.prisma.notification.createMany({ data: [...appointmentRows, ...reviewRows] });
    const birthdayIssued = await this.issueBirthdayVouchers(now);
    return { appointmentReminders: appointmentRows.length, reviewReminders: reviewRows.length, birthdayVouchers: birthdayIssued, missingCheckout: missingCheckout.count };
  }

  private async issueBirthdayVouchers(now: Date) {
    const vouchers = await this.prisma.voucher.findMany({
      where: { audience: 'BIRTHDAY', autoIssue: true, status: 'ACTIVE', deletedAt: null, startDate: { lte: now }, endDate: { gte: now } },
    });
    let issued = 0;
    for (const voucher of vouchers) {
      const issuedCount = await this.prisma.customerVoucher.count({ where: { voucherId: voucher.id } });
      const remaining = Math.max(0, voucher.totalQuantity - issuedCount);
      if (!remaining) continue;
      const customers = await this.prisma.customerProfile.findMany({
        where: {
          user: { dateOfBirth: { not: null }, isActive: true, deletedAt: null },
          customerVouchers: { none: { voucherId: voucher.id } },
          ...(voucher.businessId ? { bookings: { some: { branch: { businessId: voucher.businessId }, deletedAt: null } } } : {}),
        },
        include: { user: { select: { id: true, dateOfBirth: true } } },
      });
      const birthdayCustomers = customers.filter((customer) => customer.user.dateOfBirth?.getUTCMonth() === now.getUTCMonth() && customer.user.dateOfBirth?.getUTCDate() === now.getUTCDate()).slice(0, remaining);
      if (!birthdayCustomers.length) continue;
      const result = await this.prisma.customerVoucher.createMany({
        data: birthdayCustomers.map((customer) => ({ voucherId: voucher.id, customerId: customer.id, expiresAt: voucher.endDate })), skipDuplicates: true,
      });
      issued += result.count;
      if (result.count) await this.prisma.notification.createMany({ data: birthdayCustomers.map((customer) => ({ userId: customer.user.id, type: 'PROMOTION' as const, severity: 'SUCCESS' as const, title: 'Quà sinh nhật dành cho bạn', body: `Bạn vừa nhận voucher ${voucher.code}.`, targetType: 'VOUCHER', targetId: voucher.id, actionUrl: '/customer/appointments' })) });
    }
    return issued;
  }
}
