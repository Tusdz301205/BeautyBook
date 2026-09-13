import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Must run in the SAME transaction as the occurrence insert. The plan row
// serializes creation with recovery; rollback also rolls back the heartbeat/count.
export async function reserveRecurringOccurrence(
  tx: Pick<Prisma.TransactionClient, 'recurringBookingPlan'>,
  planId: string,
  customerId: string | undefined,
  branchId: string,
) {
  if (!customerId) throw new ConflictException('Chuỗi lịch phải thuộc một khách hàng');
  const claimed = await tx.recurringBookingPlan.updateMany({
    where: { id: planId, customerId, branchId, status: 'CREATING', deletedAt: null },
    data: { updatedAt: new Date(), createdOccurrenceCount: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new ConflictException('Chuỗi lịch đã dừng tạo. Vui lòng kiểm tra các kỳ đã có trong Lịch hẹn của tôi.');
  }
}
