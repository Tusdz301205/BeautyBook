import type { Prisma } from '@prisma/client';

/** Durable item-assignment notices; payloads are hints, never access grants. */
export async function queueProviderReassignment(
  tx: Prisma.TransactionClient,
  change: { bookingId: string; itemId: string; eventId: string; previousStaffId: string | null; nextStaffId: string },
) {
  if (change.previousStaffId === change.nextStaffId) return;
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: change.bookingId },
    select: { branchId: true, branch: { select: { businessId: true } } } });
  const ids = [...new Set([change.nextStaffId, ...(change.previousStaffId ? [change.previousStaffId] : [])])];
  const profiles = await tx.staffProfile.findMany({ where: {
    id: { in: ids }, status: 'ACTIVE', deletedAt: null,
    user: { isActive: true, deletedAt: null },
  }, select: { id: true, userId: true } });
  const userIds = profiles.flatMap(profile => profile.userId ? [profile.userId] : []);
  if (!userIds.length) return;
  const grants = await tx.userRole.findMany({ where: {
    userId: { in: userIds }, businessId: booking.branch.businessId,
    user: { isActive: true, deletedAt: null },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      { OR: [{ role: { code: 'STAFF' }, branchId: booking.branchId },
        { role: { code: 'BUSINESS_OWNER' }, branchId: null }] },
    ],
  }, select: { userId: true } });
  const recipients = [...new Set(grants.map(grant => grant.userId))];
  const assignedUser = profiles.find(profile => profile.id === change.nextStaffId)?.userId;
  if (!recipients.length) return;
  await tx.notificationOutbox.createMany({ data: recipients.map(userId => ({
    userId, type: 'SYSTEM' as const, severity: 'INFO' as const,
    title: userId === assignedUser ? 'Bạn được phân công dịch vụ' : 'Phân công dịch vụ đã thay đổi',
    body: userId === assignedUser ? 'Mở lịch làm việc để xem công việc hiện được giao cho bạn.'
      : 'Công việc này đã được chuyển khỏi lịch của bạn. Quyền xem được kiểm tra lại khi mở.',
    // Do not project a live booking summary to the former provider through
    // the notification relation. Target IDs only trigger an authorized refetch.
    targetType: 'BOOKING', targetId: change.bookingId,
    actionUrl: `/salon/appointments?bookingId=${change.bookingId}`,
    metadata: { bookingServiceId: change.itemId, assignmentEventId: change.eventId },
    dedupeKey: `provider-reassignment:${change.eventId}:${userId}`,
  })), skipDuplicates: true });
}
