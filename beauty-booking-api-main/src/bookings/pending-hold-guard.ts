import { ConflictException } from '@nestjs/common';

type PendingHoldScope = {
  status: string;
  pendingExpiresAt?: Date | null;
  bookingServices: readonly { status: string }[];
};

/** Check the parent and all current items after the parent lock/fresh read.
 * Callers may also reject an already expired pretransaction snapshot early,
 * but that check cannot replace the transaction check. Prisma Dates are UTC
 * instants; null legacy deadlines do not imply an invented hold duration.
 * Current execution status remains evidence even with UNKNOWN corrected times.
 */
export function assertPendingHoldAllowsScheduling(booking: PendingHoldScope): void {
  if (booking.status !== 'PENDING' || booking.pendingExpiresAt == null) return;
  if (booking.bookingServices.some(item => ['IN_PROGRESS', 'COMPLETED'].includes(item.status))) return;
  if (booking.pendingExpiresAt.getTime() <= new Date().getTime()) {
    throw new ConflictException({
      code: 'PENDING_HOLD_EXPIRED',
      message: 'Lịch hẹn đã hết thời gian giữ chỗ; muốn tiếp tục, vui lòng đặt lại lịch hẹn.',
    });
  }
}
