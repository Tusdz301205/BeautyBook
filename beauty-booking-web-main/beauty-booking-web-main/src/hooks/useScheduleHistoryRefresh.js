import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { captureSessionGeneration, isSessionGenerationCurrent } from '../utils/sessionGeneration';

export function scheduleHistoryRefreshDelay(rows) {
  const delays = (Array.isArray(rows) ? rows : [rows]).flatMap(row => {
    const booking = row?.raw ?? row;
    if (booking?.status !== 'CHECKED_IN' || booking.scheduleElapsed || booking.scheduleBucket === 'HISTORY') return [];
    const now = Date.parse(booking.serverNow ?? '');
    const end = typeof booking.scheduledEndAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(booking.scheduledEndAt)
      ? Date.parse(booking.scheduledEndAt) : NaN;
    return Number.isFinite(now) && Number.isFinite(end) ? [Math.max(1, end - now + 1)] : [];
  });
  return delays.length ? Math.min(...delays, 2_147_483_647) : null;
}

/** Read at the schedule boundary; never transition status, pay, or invent actual service times. */
export function useScheduleHistoryRefresh(rows, refresh) {
  const token = useAuthStore(state => state.accessToken);
  const userId = useAuthStore(state => state.user?.id);
  useEffect(() => {
    const delay = scheduleHistoryRefreshDelay(rows);
    if (!token || !userId || delay === null) return undefined;
    const lease = captureSessionGeneration();
    const timer = setTimeout(() => {
      if (isSessionGenerationCurrent(lease) && useAuthStore.getState().accessToken === token &&
        useAuthStore.getState().user?.id === userId) refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [rows, refresh, token, userId]);
}
