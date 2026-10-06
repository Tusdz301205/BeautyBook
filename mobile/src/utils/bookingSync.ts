/** A burst becomes one fetch; an invalidation during a fetch fences its result
 * and schedules one trailing fetch. No polling and no concurrent fetches. */
export function createInvalidationQueue<T>(options: {
  fetch: () => Promise<T>;
  commit: (value: T) => void;
  fail: (reason: unknown) => void;
  busy?: (value: boolean) => void;
  delayMs?: number;
}) {
  let revision = 0;
  let dirty = false;
  let running = false;
  let disposed = false;
  let suspended = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiters: Array<() => void> = [];
  const settle = () => { const pending = waiters; waiters = []; pending.forEach(resolve => resolve()); };
  const schedule = () => {
    if (disposed || suspended || running || timer || !dirty) return;
    timer = setTimeout(() => { timer = undefined; void drain(); }, options.delayMs ?? 100);
  };
  const drain = async () => {
    if (disposed || suspended || running || !dirty) return;
    running = true;
    options.busy?.(true);
    try {
      while (dirty && !disposed && !suspended) {
        dirty = false;
        const captured = revision;
        try {
          const result = await options.fetch();
          if (!disposed && !suspended && captured === revision) options.commit(result);
        } catch (reason) {
          if (!disposed && !suspended && captured === revision) options.fail(reason);
        }
      }
    } finally {
      running = false;
      if (!disposed) options.busy?.(false);
      if (!dirty || disposed || suspended) settle();
      schedule();
    }
  };
  return {
    invalidate() {
      if (disposed) return Promise.resolve();
      revision += 1;
      dirty = true;
      if (suspended) return Promise.resolve();
      const completion = new Promise<void>(resolve => waiters.push(resolve));
      schedule();
      return completion;
    },
    suspend(value: boolean) {
      suspended = value;
      revision += 1;
      dirty = true;
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (value) { options.busy?.(false); settle(); }
      else schedule();
    },
    dispose() {
      disposed = true;
      revision += 1;
      if (timer) clearTimeout(timer);
      settle();
    },
  };
}

export function schedulerOrigin(apiBase: string) {
  return apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

interface SyncSocket {
  auth: object | ((callback: (data: object) => void) => void);
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

/** The provider owns one socket. Payloads are never merged into customer data. */
export function bindBookingSocket(socket: SyncSocket, options: {
  token: () => string | null;
  subscribeToken: (listener: (token: string | null) => void) => () => void;
  refreshToken: () => Promise<string | null>;
  invalidate: () => void;
  clear: () => void;
  suspend: (value: boolean) => void;
  active: boolean;
}) {
  let disposed = false;
  let active = options.active;
  let refreshing = false;
  let authAttempts = 0;
  let lastToken = options.token();
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelRecovery = () => {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
  };
  const connect = () => {
    if (disposed || !active || refreshing || !options.token()) return;
    socket.auth = { token: options.token() };
    socket.connect();
  };
  const invalidate = () => { if (!disposed && active && options.token()) options.invalidate(); };
  const clear = () => { if (!disposed) options.clear(); };
  const recover = () => {
    if (disposed || !active || refreshing || recoveryTimer || !options.token() || authAttempts >= 3) return;
    recoveryTimer = setTimeout(() => {
      recoveryTimer = undefined;
      if (disposed || !active || !options.token()) return;
      authAttempts += 1;
      refreshing = true;
      let recovered = false;
      void options.refreshToken().then(token => { recovered = Boolean(token); }).catch(() => {
        // Offline/5xx retains the session. Retry with backoff instead of reconnecting an expired token.
      }).finally(() => {
        refreshing = false;
        if (recovered) connect();
        else recover();
      });
    }, [1000, 5000, 30000][authAttempts]);
  };
  const authFailed = () => {
    if (disposed || !active || refreshing || recoveryTimer || !options.token()) return;
    socket.disconnect();
    clear();
    recover();
  };
  const listeners: Record<string, (...args: any[]) => void> = {
    booking_created: invalidate, booking_updated: invalidate, booking_deleted: invalidate,
    scheduler_resync: invalidate,
    scheduler_access_changed: () => { clear(); invalidate(); },
    scheduler_auth_failed: authFailed,
    // Socket.IO can emit connect before the gateway rejects authorization.
    // Only token rotation or an explicit foreground cycle resets recovery.
    connect: invalidate,
    connect_error: (error: { data?: { code?: string } }) => {
      if (error?.data?.code === 'WS_AUTH_FAILED') authFailed();
    },
    disconnect: (reason: string) => {
      if (reason === 'io server disconnect') authFailed();
    },
  };
  Object.entries(listeners).forEach(([event, listener]) => socket.on(event, listener));
  const unsubscribe = options.subscribeToken(token => {
    if (disposed) return;
    cancelRecovery();
    if (token !== lastToken) { authAttempts = 0; lastToken = token; }
    socket.disconnect();
    if (!token) { clear(); options.suspend(true); }
    else { options.suspend(!active); connect(); }
  });
  options.suspend(!active);
  connect();
  return {
    setActive(value: boolean) {
      if (disposed || value === active) return;
      active = value;
      cancelRecovery();
      options.suspend(!value);
      if (!value) socket.disconnect();
      else { authAttempts = 0; invalidate(); connect(); }
    },
    dispose() {
      disposed = true;
      cancelRecovery();
      unsubscribe();
      Object.entries(listeners).forEach(([event, listener]) => socket.off(event, listener));
      socket.disconnect();
    },
  };
}
