import type { Prisma } from '@prisma/client';

export const CANCELLED_BOOKING_OUTCOMES: readonly string[] = [
  'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW',
];

/** Run in the transaction that closes the parent booking. Keep completed,
 * skipped and previously cancelled items as historical facts; invalidate any
 * stale item-edit request by advancing the revision of unfinished items. */
export function cancelUnfinishedBookingItems(
  tx: Pick<Prisma.TransactionClient, 'bookingService'>,
  bookingId: string,
) {
  return tx.bookingService.updateMany({
    where: { bookingId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
    data: { status: 'CANCELLED', revision: { increment: 1 } },
  });
}
