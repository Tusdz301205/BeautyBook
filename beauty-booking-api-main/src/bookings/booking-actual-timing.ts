import type { Prisma } from '@prisma/client';

// Read only lifecycle audit facts. Never expose reasons, actors or snapshots
// in the public timing contract, and never infer execution from planned time.
export const BOOKING_TIMING_AUDIT_INCLUDE = {
  actualTimeCorrections: {
    orderBy: [{ version: 'desc' }, { id: 'desc' }], take: 1,
    select: { actualStartedAt: true, actualCompletedAt: true, actualTimingStatus: true, version: true },
  },
  refs_BookingServiceAdjustment_bookingServiceId: {
    where: { action: { in: ['START', 'COMPLETE', 'SKIP', 'REASSIGN'] } },
    orderBy: { version: 'asc' },
    select: { action: true, actorId: true, createdAt: true, version: true, beforeSnapshot: true, afterSnapshot: true },
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
  actualTimeCorrections?: readonly { actualStartedAt: Date | null; actualCompletedAt: Date | null;
    actualTimingStatus: 'KNOWN' | 'UNKNOWN'; version: number }[];
  refs_BookingServiceAdjustment_bookingServiceId?: readonly TimingAudit[];
};

function snapshotStatus(snapshot: unknown): unknown {
  return snapshot && typeof snapshot === 'object' && 'status' in snapshot ? snapshot.status : null;
}

export function bookingItemActualTiming(item: TimingItem) {
  const correction = [...(item.actualTimeCorrections ?? [])].sort((a, b) => b.version - a.version)[0];
  if (correction) return {
    actualStartedAt: correction.actualStartedAt,
    actualCompletedAt: correction.actualCompletedAt,
    actualStoppedAt: correction.actualCompletedAt,
    actualTimingSource: 'ACTUAL_TIME_CORRECTION' as const,
    actualTimingStatus: correction.actualTimingStatus,
  };
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
    actualTimingStatus: start || complete || skip ? 'KNOWN' as const : 'UNKNOWN' as const,
  };
}

export function withBookingTiming<T extends { bookingServices?: readonly TimingItem[] }>(booking: T, serverNow = new Date()) {
  return {
    ...booking,
    serverNow,
    bookingServices: (booking.bookingServices ?? []).map((item) => {
      const publicItem = { ...item };
      delete publicItem.refs_BookingServiceAdjustment_bookingServiceId;
      delete publicItem.actualTimeCorrections;
      return { ...publicItem, ...bookingItemActualTiming(item) };
    }),
  };
}
