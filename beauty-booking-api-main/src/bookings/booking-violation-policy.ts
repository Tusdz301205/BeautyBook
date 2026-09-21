import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lockCustomerBookingPolicy, refreshBookingRestriction, readCustomerBookingPolicy, RESTRICTION_POLICY_VERSION } from './customer-booking-policy';

export const BOOKING_VIOLATION_POLICY_VERSION = RESTRICTION_POLICY_VERSION;
export const VIOLATION_WINDOW_MS = 90 * 86_400_000;

export async function recordBookingViolation(tx: Prisma.TransactionClient, data: {
  bookingId: string; customerId: string; businessId: string; recordedById: string;
  kind: 'LATE_CANCELLATION' | 'NO_SHOW'; sourceRequestId?: string;
  occurredAt: Date; appointmentStartAt: Date;
}) {
  const profile = await tx.customerProfile.findUnique({ where: { id: data.customerId }, select: { userId: true } });
  const grants = profile ? await tx.userRole.findMany({ where: { userId: profile.userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: data.occurredAt } }] }, select: { role: { select: { code: true } } } }) : [];
  const customerOnly = grants.some(grant => grant.role.code === 'CUSTOMER') &&
    !grants.some(grant => ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN'].includes(grant.role.code));
  if (!customerOnly) {
    // A walk-in shadow profile is historical identity, not a Customer account.
    if (data.kind === 'NO_SHOW') return null;
    throw new ConflictException('Chỉ tài khoản khách hàng hợp lệ được gửi yêu cầu hủy sát giờ');
  }
  await lockCustomerBookingPolicy(tx, data.customerId, data.businessId);
  const existing = await tx.bookingViolationEvent.findFirst({ where: { bookingId: data.bookingId, voidedAt: null } });
  if (existing) {
    if (existing.kind === data.kind && existing.sourceRequestId === (data.sourceRequestId ?? null)) return existing;
    throw new ConflictException('Lịch hẹn đã có sự kiện vi phạm hợp lệ; không được ghi nhận trùng');
  }
  const event = await tx.bookingViolationEvent.create({ data: { ...data, policyVersion: BOOKING_VIOLATION_POLICY_VERSION } });
  await refreshBookingRestriction(tx, data.customerId, data.businessId, data.recordedById);
  const policy = await readCustomerBookingPolicy(tx, data.customerId, data.businessId, data.occurredAt);
  if (policy.score >= 2) {
    const business = await tx.business.findUniqueOrThrow({ where: { id: data.businessId }, select: { name: true } });
    await tx.notification.create({ data: { userId: profile!.userId, type: 'SYSTEM', severity: 'WARNING',
      title: policy.restriction?.active ? 'Hạn chế tự đặt lịch tại doanh nghiệp' : 'Thông tin lịch sử đặt lịch',
      body: `Bạn có ${policy.score} điểm vi phạm trong 90 ngày tại ${business.name}.` +
        (policy.restriction?.active ? ` Hạn chế tự đặt đến ${policy.restriction.endsAt!.toISOString()}. Bạn có thể liên hệ cơ sở để được hỗ trợ tạo lịch.` : ''),
      relatedBookingId: data.bookingId, actionUrl: `/customer/appointments/${data.bookingId}`,
      metadata: { businessId: data.businessId, eventId: event.id, score: policy.score } } });
  }
  return event;
}

// Internal correction primitive only: no salon "waive points" endpoint. A
// caller must establish the invalidity and authorize the correcting actor.
export async function voidInvalidBookingViolation(tx: Prisma.TransactionClient, eventId: string,
  actorId: string, cause: 'OWNERSHIP_ERROR' | 'DUPLICATE' | 'INVALID_BOOKING_STATE' | 'BUSINESS_RULE_ERROR',
  evidence: string, now = new Date()) {
  if (!['OWNERSHIP_ERROR', 'DUPLICATE', 'INVALID_BOOKING_STATE', 'BUSINESS_RULE_ERROR'].includes(cause) || evidence.trim().length < 10) {
    throw new ConflictException('Cần căn cứ xác định sự kiện không hợp lệ');
  }
  const event = await tx.bookingViolationEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new ConflictException('Sự kiện không tồn tại');
  await lockCustomerBookingPolicy(tx, event.customerId, event.businessId);
  const changed = await tx.bookingViolationEvent.updateMany({ where: { id: eventId, voidedAt: null },
    data: { voidedAt: now, voidedById: actorId, voidReason: `${cause}: ${evidence.trim()}` } });
  if (changed.count !== 1) throw new ConflictException('Sự kiện không tồn tại hoặc đã được vô hiệu hóa');
  await refreshBookingRestriction(tx, event.customerId, event.businessId, actorId);
  await tx.auditLog.create({ data: { userId: actorId, action: 'STATUS_CHANGE', entityType: 'BookingViolationEvent',
    entityId: eventId, newData: { validity: 'VOID', cause, evidence: evidence.trim(), voidedAt: now.toISOString() } } });
}

export async function bookingViolationSummary(tx: Pick<Prisma.TransactionClient, 'bookingViolationEvent' | 'customerBookingPolicy'>,
  customerId: string, businessId: string, now = new Date()) {
  return readCustomerBookingPolicy(tx, customerId, businessId, now);
}
