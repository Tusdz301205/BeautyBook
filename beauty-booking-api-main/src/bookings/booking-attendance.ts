import type { Prisma } from '@prisma/client';
import { appointmentDateFromInstant, appointmentTimeFromInstant, toBookingInterval } from '../common/utils/booking-datetime';

type ScheduledBooking = {
  status?: string;
  appointmentDate?: Date;
  appointmentStartTime?: Date;
  appointmentEndTime?: Date;
  deletedAt?: Date | null;
};
const cancelled = new Set(['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED']);
export const ATTENDED_BOOKING_STATUSES = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'] as const;
export function hasRecordedAttendance(status: string) {
  return (ATTENDED_BOOKING_STATUSES as readonly string[]).includes(status);
}
export function hasRecordedVisit(booking: { status: string; statusHistory?: readonly { status: string }[] }) {
  return hasRecordedAttendance(booking.status) || (booking.statusHistory ?? []).some(entry => hasRecordedAttendance(entry.status));
}
export function attendedVisitWhere(): Prisma.BookingWhereInput {
  return { deletedAt: null, OR: [{ status: { in: [...ATTENDED_BOOKING_STATUSES] } },
    { statusHistory: { some: { status: { in: [...ATTENDED_BOOKING_STATUSES] } } } }] };
}

/** Attendance and schedule position are read projections, never execution or payment facts. */
export function bookingAttendance(booking: ScheduledBooking, serverNow = new Date()) {
  let scheduledStartAt: Date | null = null, scheduledEndAt: Date | null = null;
  if (booking.appointmentDate && booking.appointmentStartTime && booking.appointmentEndTime) {
    try {
      const interval = toBookingInterval(booking.appointmentDate, booking.appointmentStartTime, booking.appointmentEndTime);
      scheduledStartAt = interval.start;
      scheduledEndAt = interval.end;
    } catch { /* Invalid legacy schedules remain unclassified, without guessing actual time. */ }
  }
  const scheduleElapsed = scheduledEndAt !== null && scheduledEndAt.getTime() <= serverNow.getTime();
  const attendedHistory = booking.status === 'CHECKED_IN' && scheduleElapsed;
  const scheduleBucket = cancelled.has(booking.status ?? '') ? 'CANCELLED' as const
    : booking.status === 'COMPLETED' || attendedHistory ? 'HISTORY' as const : 'UPCOMING' as const;
  return {
    attendanceWorkflow: 'CHECK_IN_ONLY' as const,
    scheduledStartAt, scheduledEndAt, scheduleElapsed, scheduleBucket,
    canReview: !booking.deletedAt && (booking.status === 'COMPLETED' || attendedHistory),
  };
}

/** Same predicate as the projection, evaluated before pagination/counting.
 * DATE/TIME are branch wall values in the existing BOOKING_TIME_ZONE contract.
 * Column comparisons also retain old overnight schedules without closing them early. */
export function attendedHistoryWhere(now: Date, fields: Pick<Prisma.BookingFieldRefs, 'appointmentStartTime'>): Prisma.BookingWhereInput {
  const day = appointmentDateFromInstant(now), clock = appointmentTimeFromInstant(now);
  const yesterday = new Date(day.getTime() - 86_400_000);
  return { status: 'CHECKED_IN', OR: [
    { appointmentEndTime: { gt: fields.appointmentStartTime }, OR: [
      { appointmentDate: { lt: day } },
      { appointmentDate: day, appointmentEndTime: { lte: clock } },
    ] },
    { appointmentEndTime: { lte: fields.appointmentStartTime }, OR: [
      { appointmentDate: { lt: yesterday } },
      { appointmentDate: yesterday, appointmentEndTime: { lte: clock } },
    ] },
  ] };
}

export function customerScheduleWhere(tab: 'upcoming' | 'completed' | 'cancelled', now: Date,
  fields: Pick<Prisma.BookingFieldRefs, 'appointmentStartTime'>): Prisma.BookingWhereInput {
  const history = attendedHistoryWhere(now, fields);
  if (tab === 'completed') return { OR: [{ status: 'COMPLETED' }, history] };
  if (tab === 'cancelled') return { status: { in: ['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'] } };
  return { status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] }, NOT: history };
}
