import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

/**
 * Gửi notification đến đúng người theo booking.
 *
 * Quy tắc QUAN TRỌNG (đã chốt trong review nghiệp vụ):
 *  - Status thay đổi ảnh hưởng khách → noti đến customerId của booking (KHÔNG PHẢI account salon).
 *  - Admin ép can thiệp → noti đến CẢ customer lẫn salon members (để 2 bên cùng biết).
 *  - Salon confirm/reject → noti đến customer.
 *
 * Tạo cả 1 row notification (in-app) + email nếu cần.
 */
export async function notifyBookingCustomer(
  prisma: PrismaService,
  bookingId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { include: { user: { select: { id: true } } } },
    },
  });
  if (!booking) return;

  await prisma.notification.create({
    data: {
      userId: booking.customer.user.id,
      type,
      title,
      body,
      relatedBookingId: bookingId,
      targetType: 'BOOKING',
      targetId: bookingId,
      actionUrl: `/customer/appointments?bookingId=${bookingId}`,
    },
  });
}

/**
 * Noti đến tất cả salon members của business (owner/manager/receptionist active).
 * Dùng khi admin can thiệp ép buộc.
 */
export async function notifySalonMembers(
  prisma: PrismaService,
  businessId: string,
  type: NotificationType,
  title: string,
  body: string,
  relatedBookingId?: string,
): Promise<void> {
  const members = await prisma.salonMember.findMany({
    where: { businessId, isActive: true, deletedAt: null },
    select: { userId: true },
  });
  if (members.length === 0) return;

  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type,
      title,
      body,
      relatedBookingId,
      targetType: relatedBookingId ? 'BOOKING' : 'BUSINESS',
      targetId: relatedBookingId ?? businessId,
      actionUrl: relatedBookingId ? `/salon/appointments?bookingId=${relatedBookingId}` : '/salon/notifications',
    })),
  });
}

/**
 * Noti đến cả customer và salon members — dùng cho thay đổi status nghiệp vụ quan trọng
 * (CONFIRMED, COMPLETED, REFUNDED, v.v.).
 */
export async function notifyBookingBothParties(
  prisma: PrismaService,
  bookingId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { branch: { select: { businessId: true } } },
  });
  if (!booking) return;

  await Promise.all([
    notifyBookingCustomer(prisma, bookingId, type, title, body),
    notifySalonMembers(
      prisma,
      booking.branch.businessId,
      type,
      title,
      body,
      bookingId,
    ),
  ]);
}
