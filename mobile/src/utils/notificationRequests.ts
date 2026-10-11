import type { ApiNotification, ApiNotificationsPage } from '../api/notifications';

type Api = {
  list: (page: number) => Promise<ApiNotificationsPage>;
  markRead: (id: string) => Promise<unknown>;
  markAllRead: () => Promise<unknown>;
};

// Owns synchronous guards as well as response fences; React state alone cannot
// block two taps delivered before the next render.
export function createNotificationRequests(api: Api, append: boolean, currentSession: () => boolean, changed: () => void) {
  let active = false;
  let lifetime = 0;
  let request = 0;
  let requestedPage = 1;
  let responseRevision = 0;
  const reads = new Set<string>();
  const pending = new Set<string>();
  let allPending = false;
  let state = { data: null as ApiNotificationsPage | null, page: 1, busy: false, markingAll: false, error: null as unknown };
  const valid = (origin: number) => active && lifetime === origin && currentSession();
  const publish = () => { if (active && currentSession()) changed(); };
  const normalizeResponse = (result: ApiNotificationsPage): ApiNotificationsPage => ({
    ...result,
    // Rows and count are separate server queries. Preserve known read flags,
    // but never infer another count decrement from a stale response row.
    data: result.data.map(item => reads.has(item.id) ? { ...item, isRead: true } : item),
  });
  const markSnapshotRead = (snapshot: ApiNotificationsPage, id: string): ApiNotificationsPage => ({
    ...snapshot,
    unreadCount: Math.max(0, snapshot.unreadCount - (snapshot.data.some(item => item.id === id && !item.isRead) ? 1 : 0)),
    data: snapshot.data.map(item => item.id === id ? { ...item, isRead: true } : item),
  });
  const load = async (page = 1, replace = false) => {
    if (!active || !currentSession() || allPending || (state.busy && !replace)) return;
    const origin = lifetime;
    const ticket = ++request;
    requestedPage = page;
    state = { ...state, busy: true, error: null };
    publish();
    try {
      const response = await api.list(page);
      if (!valid(origin) || ticket !== request) return;
      const result = normalizeResponse(response);
      const lastPage = Math.max(1, result.pagination.totalPages);
      if (page > lastPage) {
        state = { ...state, busy: false };
        return await load(lastPage, true);
      }
      const rows = append && page > 1 ? [...(state.data?.data ?? []), ...result.data] : result.data;
      responseRevision++;
      state = { ...state, data: { ...result, data: [...new Map(rows.map(item => [item.id, item])).values()] }, page, error: null };
    } catch (error) {
      if (valid(origin) && ticket === request) {
        const forbidden = typeof error === 'object' && error !== null && 'status' in error && [401, 403].includes(Number(error.status));
        state = { ...state, data: forbidden ? null : state.data, error };
      }
    } finally {
      if (valid(origin) && ticket === request) { state = { ...state, busy: false }; publish(); }
    }
  };
  return {
    getState: () => state,
    activate() { active = true; },
    dispose() { active = false; lifetime++; request++; pending.clear(); allPending = false; state = { ...state, busy: false, markingAll: false }; },
    load,
    reload: () => load(append ? 1 : state.busy ? requestedPage : state.page, true),
    move(delta: number) {
      if (state.busy || allPending || !state.data) return;
      const page = Math.max(1, Math.min(state.page + delta, Math.max(1, state.data.pagination.totalPages)));
      if (page !== state.page) void load(page);
    },
    async markRead(item: ApiNotification, success?: () => void, fail?: (error: unknown) => void) {
      if (!active || !currentSession() || allPending || pending.has(item.id)) return;
      const origin = lifetime;
      const snapshotRevision = responseRevision;
      pending.add(item.id);
      try {
        const unread = !item.isRead && !reads.has(item.id);
        if (unread) await api.markRead(item.id);
        if (!valid(origin)) return;
        reads.add(item.id);
        // Reconcile both displayed rows and any list response already in flight.
        // A successful read must never be undone by an older list snapshot.
        if (state.data) {
          // Only adjust the local snapshot this mark started against. A newer
          // API response may already include the PATCH in its separate count.
          state = { ...state, data: unread && responseRevision === snapshotRevision
            ? markSnapshotRead(state.data, item.id) : normalizeResponse(state.data) };
        }
        if (unread && state.busy) {
          // Counts and page contents from before the PATCH are stale too.
          ++request;
          state = { ...state, busy: false };
          void load(requestedPage, true);
        }
        publish();
        success?.();
      } catch (error) { if (valid(origin)) fail?.(error); }
      finally { if (valid(origin)) pending.delete(item.id); }
    },
    async markAllRead(fail?: (error: unknown) => void) {
      if (!active || !currentSession() || allPending) return;
      const origin = lifetime;
      allPending = true;
      ++request; // Fence pagination immediately, before the PATCH completes.
      state = { ...state, busy: false, markingAll: true };
      publish();
      try {
        await api.markAllRead();
        if (!valid(origin)) return;
        if (state.data) {
          state.data.data.forEach(item => reads.add(item.id));
          state = { ...state, data: { ...state.data, unreadCount: 0, data: state.data.data.map(item => ({ ...item, isRead: true })) } };
        }
      } catch (error) { if (valid(origin)) fail?.(error); }
      finally {
        if (valid(origin)) {
          allPending = false;
          state = { ...state, markingAll: false };
          publish();
          await load(1, true);
        }
      }
    },
  };
}
