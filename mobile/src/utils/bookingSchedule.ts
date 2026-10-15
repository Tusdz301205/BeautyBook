/** Optional during rolling deployment. These fields are presentation, never lifecycle writes. */
export interface BookingSchedule {
  attendanceWorkflow?: 'CHECK_IN_ONLY';
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  scheduleElapsed?: boolean;
  scheduleBucket?: 'UPCOMING' | 'HISTORY' | 'CANCELLED';
}

/** Only server-projected history counts; an item end or device clock is not booking completion. */
export function checkedInHistory(status: string | undefined, schedule: BookingSchedule): boolean {
  return status === 'CHECKED_IN' && schedule.scheduleBucket !== 'CANCELLED' &&
    (schedule.scheduleBucket === 'HISTORY' || schedule.scheduleElapsed === true);
}

/** Refresh at the booking end using server time; native timers use elapsed time, not device dates. */
export function nextScheduleRefresh(items: Array<BookingSchedule & {
  status?: string; rawStatus?: string; bookingStatus?: string; serverNow?: string;
}>, serverNow?: number): number | null {
  const delays = items.flatMap(item => {
    const status = item.rawStatus ?? item.bookingStatus ?? item.status;
    if (status !== 'CHECKED_IN' || checkedInHistory(status, item) || item.scheduleBucket === 'CANCELLED') return [];
    const end = item.scheduledEndAt && /(?:Z|[+-]\d{2}:\d{2})$/.test(item.scheduledEndAt) ? Date.parse(item.scheduledEndAt) : NaN;
    const now = serverNow ?? Date.parse(item.serverNow ?? '');
    return Number.isFinite(end) && Number.isFinite(now) && end >= now ? [end - now + 1] : [];
  });
  return delays.length ? Math.min(...delays, 2_147_483_647) : null;
}
