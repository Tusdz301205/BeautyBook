import type { Prisma } from '@prisma/client';

// Read only lifecycle audit facts. Never expose reasons, actors or snapshots
// in the public timing contract, and never infer execution from planned time.
export const BOOKING_TIMING_AUDIT_INCLUDE = {
  refs_BookingServiceAdjustment_bookingServiceId: {
    where: { action: { in: ['START', 'COMPLETE', 'SKIP'] } },
    orderBy: { version: 'asc' },
    select: { action: true, createdAt: true, version: true, beforeSnapshot: true, afterSnapshot: true },
  },
} satisfies Prisma.BookingServiceInclude;

type TimingAudit = {
  action: string;
  createdAt: Date;
  version: number;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
};
type TimingItem = {
  status?: string;
  refs_BookingServiceAdjustment_bookingServiceId?: readonly TimingAudit[];
};

function snapshotStatus(snapshot: unknown): unknown {
  return snapshot && typeof snapshot === 'object' && 'status' in snapshot ? snapshot.status : null;
}

export function bookingItemActualTiming(item: TimingItem) {
  const events = [...(item.refs_BookingServiceAdjustment_bookingServiceId ?? [])]
    .sort((a, b) => a.version - b.version);
  const start = events.find((event) => event.action === 'START' &&
    snapshotStatus(event.beforeSnapshot) === 'SCHEDULED' && snapshotStatus(event.afterSnapshot) === 'IN_PROGRESS');
  const complete = item.status === 'COMPLETED' ? events.find((event) => event.action === 'COMPLETE' &&
    snapshotStatus(event.beforeSnapshot) === 'IN_PROGRESS' && snapshotStatus(event.afterSnapshot) === 'COMPLETED') : undefined;
  const skip = start && item.status === 'SKIPPED' ? events.find((event) => event.action === 'SKIP' &&
    event.version > start.version && snapshotStatus(event.beforeSnapshot) === 'IN_PROGRESS' &&
    snapshotStatus(event.afterSnapshot) === 'SKIPPED') : undefined;
  return {
    actualStartedAt: start?.createdAt ?? null,
    actualCompletedAt: complete?.createdAt ?? null,
    actualStoppedAt: complete?.createdAt ?? skip?.createdAt ?? null,
    actualTimingSource: start || complete || skip ? 'SERVICE_ADJUSTMENT' as const : 'UNAVAILABLE' as const,
  };
}

export function withBookingTiming<T extends { bookingServices?: readonly TimingItem[] }>(booking: T, serverNow = new Date()) {
  return {
    ...booking,
    serverNow,
    bookingServices: (booking.bookingServices ?? []).map((item) => {
      const publicItem = { ...item };
      delete publicItem.refs_BookingServiceAdjustment_bookingServiceId;
      return { ...publicItem, ...bookingItemActualTiming(item) };
    }),
  };
}
