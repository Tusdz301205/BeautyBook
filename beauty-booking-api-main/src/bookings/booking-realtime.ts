import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerGateway } from '../scheduler/scheduler.gateway';

const logger = new Logger('BookingRealtime');

/** Call only after commit. Realtime delivery must never undo a saved mutation.
 * Fetch recipients from the persisted booking; item responses may omit them. */
export async function emitCommittedBookingUpdates(
  prisma: PrismaService,
  gateway: SchedulerGateway | undefined,
  bookingIds: readonly string[],
) {
  if (!gateway || bookingIds.length === 0) return;
  try {
    const bookings = await prisma.booking.findMany({
      where: { id: { in: [...new Set(bookingIds)] } },
      select: {
        id: true, status: true, branchId: true, updatedAt: true,
        branch: { select: { businessId: true } },
        customer: { select: { user: { select: { id: true } } } },
      },
    });
    for (const booking of bookings) await emitCommittedBookingUpdate(gateway, booking);
  } catch {
    logger.warn('Committed booking invalidation delayed; clients recover through authorized refetch');
  }
}

export async function emitCommittedBookingUpdate(
  gateway: SchedulerGateway,
  booking: Parameters<SchedulerGateway['notifyBookingUpdated']>[0],
) {
  try {
    await Promise.resolve(gateway.notifyBookingUpdated(booking));
  } catch {
    logger.warn(`Committed booking invalidation delayed for booking ${booking.id}`);
  }
}
