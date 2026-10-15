import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { refreshSession } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { schedulerSocketUrl } from '../utils/socketEndpoint';
import { bindSchedulerSocketEvents } from '../utils/schedulerSocketEvents';
import { useOperationalRefresh } from './useOperationalRefresh';
import { captureSessionGeneration, isSessionGenerationCurrent } from '../utils/sessionGeneration';
import { useScheduleHistoryRefresh } from './useScheduleHistoryRefresh';

// Events only invalidate reads. Booking data always comes from the scoped API.
export function useCustomerBookingRefresh(refresh, rows) {
  const token = useAuthStore(state => state.accessToken);
  const userId = useAuthStore(state => state.user?.id);
  const latest = useRef(refresh);
  latest.current = refresh;
  useOperationalRefresh(refresh);
  useScheduleHistoryRefresh(rows, refresh);
  useEffect(() => {
    if (!token || !userId) return undefined;
    const lease = captureSessionGeneration();
    let active = true, recovering = false;
    const current = () => active && isSessionGenerationCurrent(lease) && useAuthStore.getState().user?.id === userId
      && useAuthStore.getState().accessToken === token;
    const reload = () => { if (current()) latest.current(); };
    const socket = io(schedulerSocketUrl(), {
      transports: ['websocket', 'polling'],
      auth: callback => callback({ token: useAuthStore.getState().accessToken }),
    });
    const recover = async () => {
      if (!current() || recovering) return;
      recovering = true;
      try {
        const result = await refreshSession(lease);
        if (current()) {
          if (!useAuthStore.getState().setSession(result, lease)) useAuthStore.getState().clearSession(lease);
          else latest.current();
        }
      } catch {
        if (current()) useAuthStore.getState().clearSession(lease);
      } finally { recovering = false; }
    };
    const unbind = bindSchedulerSocketEvents(socket, {
      refresh: reload, clearScopedData: reload, authFailed: recover,
      authorizationChanged: recover, coalesceRefresh: true,
    });
    return () => { active = false; unbind(); socket.disconnect(); };
  }, [token, userId]);
}
