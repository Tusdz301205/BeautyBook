import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const RESTRICTION_POLICY_VERSION = '2026-09-18-request-time';
export const WINDOW_MS = 90 * 86_400_000;
export const RESTRICTION_MS = 30 * 86_400_000;
type Event = { id: string; kind: string; occurredAt: Date; policyVersion: string; voidedAt?: Date | null };
const weight = (event: Event) => event.kind === 'NO_SHOW' ? 2 : 1;

// Deterministic replay is used only on a new event or an audited VOID.
// Reads never activate, extend or recreate a restriction. Old policy events
// count towards score, but cannot themselves trigger a retroactive restriction.
export function replayBookingRestriction(history: Event[]) {
  const events = history.filter(e => !e.voidedAt).sort((a, b) =>
    a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  let triggeredByViolationEventId: string | null = null;
  let left = 0;
  let score = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    while (left < i && events[left].occurredAt.getTime() < event.occurredAt.getTime() - WINDOW_MS) {
      score -= weight(events[left++]);
    }
    score += weight(event);
    if (event.policyVersion !== RESTRICTION_POLICY_VERSION) continue;
    const active = endsAt !== null && endsAt > event.occurredAt;
    if (score >= 4 || active) {
      if (!active) startsAt = event.occurredAt;
      endsAt = new Date(event.occurredAt.getTime() + RESTRICTION_MS);
      triggeredByViolationEventId = event.id;
    }
  }
  return { startsAt, endsAt, triggeredByViolationEventId };
}

// Every event/VOID and customer self-create writes this same pair row under
// SERIALIZABLE. A stale snapshot must retry; FOR UPDATE alone is insufficient.
export async function lockCustomerBookingPolicy(tx: Prisma.TransactionClient, customerId: string, businessId: string) {
  return tx.customerBookingPolicy.upsert({
    where: { customerId_businessId: { customerId, businessId } },
    create: { customerId, businessId, revision: 1 },
    update: { revision: { increment: 1 } },
  });
}

type PolicyReader = Pick<Prisma.TransactionClient, 'bookingViolationEvent' | 'customerBookingPolicy'>;
export async function readCustomerBookingPolicy(db: PolicyReader, customerId: string, businessId: string, now = new Date()) {
  const events = await db.bookingViolationEvent.findMany({ where: { customerId, businessId, voidedAt: null,
    occurredAt: { gte: new Date(now.getTime() - WINDOW_MS), lte: now } }, select: { kind: true } });
  const lateCancellations = events.filter(e => e.kind === 'LATE_CANCELLATION').length;
  const noShows = events.filter(e => e.kind === 'NO_SHOW').length;
  const score = lateCancellations + noShows * 2;
  const row = await db.customerBookingPolicy.findUnique({ where: { customerId_businessId: { customerId, businessId } } });
  const active = Boolean(row?.startsAt && row.startsAt <= now && row.endsAt && row.endsAt > now);
  return { businessId, windowDays: 90, lateCancellations, noShows, score,
    warningLevel: score >= 3 ? 'WARNING_LEVEL_2' : score === 2 ? 'WARNING_LEVEL_1' : 'NORMAL',
    acknowledgmentRequired: score === 3 && !active,
    selfBookingAllowed: !active,
    restriction: row?.endsAt ? { active, startsAt: row.startsAt, endsAt: row.endsAt } : null,
  };
}

export async function refreshBookingRestriction(tx: Prisma.TransactionClient, customerId: string, businessId: string, actorId: string) {
  const events = await tx.bookingViolationEvent.findMany({ where: { customerId, businessId, voidedAt: null },
    select: { id: true, kind: true, occurredAt: true, policyVersion: true } });
  const data = replayBookingRestriction(events);
  const current = await tx.customerBookingPolicy.findUniqueOrThrow({ where: { customerId_businessId: { customerId, businessId } } });
  if (current.triggeredByViolationEventId === data.triggeredByViolationEventId &&
    current.endsAt?.getTime() === data.endsAt?.getTime() && current.startsAt?.getTime() === data.startsAt?.getTime()) return;
  await tx.customerBookingPolicy.update({ where: { id: current.id }, data });
  await tx.auditLog.create({ data: { userId: actorId, action: 'STATUS_CHANGE', entityType: 'CustomerBookingPolicy', entityId: current.id,
    oldData: { startsAt: current.startsAt?.toISOString() ?? null, endsAt: current.endsAt?.toISOString() ?? null,
      triggeredByViolationEventId: current.triggeredByViolationEventId },
    newData: { startsAt: data.startsAt?.toISOString() ?? null, endsAt: data.endsAt?.toISOString() ?? null,
      triggeredByViolationEventId: data.triggeredByViolationEventId, policyVersion: RESTRICTION_POLICY_VERSION } } });
}

export async function assertCustomerSelfBookingAllowed(tx: Prisma.TransactionClient, customerId: string, businessId: string,
  acknowledgment: unknown, actorId?: string) {
  await lockCustomerBookingPolicy(tx, customerId, businessId);
  // Capture time AFTER the serialization fence, not before waiting for a writer.
  const policy = await readCustomerBookingPolicy(tx, customerId, businessId);
  if (!policy.selfBookingAllowed) throw new ForbiddenException({ code: 'SELF_BOOKING_RESTRICTED',
    message: 'Bạn đang được hạn chế tự đặt lịch tại doanh nghiệp này. Vui lòng liên hệ cơ sở để được hỗ trợ.', policy });
  if (policy.acknowledgmentRequired && acknowledgment !== true) throw new ConflictException({
    code: 'BOOKING_WARNING_ACK_REQUIRED', message: 'Vui lòng xác nhận đã hiểu cảnh báo 3 điểm trước khi tiếp tục đặt lịch.', policy });
  if (policy.acknowledgmentRequired) {
    await tx.auditLog.create({ data: { userId: actorId, action: 'CREATE', entityType: 'BookingWarningAcknowledgment', entityId: customerId,
      newData: { businessId, score: policy.score, acknowledged: true, policyVersion: RESTRICTION_POLICY_VERSION } } });
  }
  return policy;
}
