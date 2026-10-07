import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Record provider identity before every whole-booking assignment change. */
export async function auditProviderReassignment(tx: Prisma.TransactionClient, item: {
  id: string; bookingId: string; staffId: string | null; status: string; revision?: number;
}, nextStaffId: string, actorId: string | undefined, reason: string) {
  if (item.staffId === nextStaffId) return;
  if (!actorId) throw new BadRequestException('Thiếu người thực hiện đổi phân công');
  const ids = [...new Set([nextStaffId, ...(item.staffId ? [item.staffId] : [])])];
  const users = new Map((await tx.staffProfile.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true } })).map(profile => [profile.id, profile.userId]));
  await tx.bookingServiceAdjustment.create({ data: {
    bookingServiceId: item.id, bookingId: item.bookingId, actorId, action: 'REASSIGN', reason, amountDelta: 0,
    version: await tx.bookingServiceAdjustment.count({ where: { bookingServiceId: item.id } }) + 1,
    beforeSnapshot: { status: item.status, staffId: item.staffId, staffUserId: item.staffId ? users.get(item.staffId) ?? null : null, revision: item.revision ?? null },
    afterSnapshot: { status: item.status, staffId: nextStaffId, staffUserId: users.get(nextStaffId) ?? null, revision: item.revision == null ? null : item.revision + 1 },
  } });
}
