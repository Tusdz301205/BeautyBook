import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { advanceServerClock } from '../utils/bookingOperationalTime';

/** Elapsed monotonic time, never a device wall-clock offset. Refresh elsewhere
 * on reconnect/foreground; do not fabricate an API timestamp while offline. */
export function useOperationalTime(serverNow: string | number | undefined, fresh = true): number {
  const server = typeof serverNow === 'string' ? /(?:Z|[+-]\d{2}:\d{2})$/.test(serverNow) ? Date.parse(serverNow) : NaN : serverNow ?? NaN;
  const anchor = useRef({ server, mono: performance.now() });
  if (!Object.is(anchor.current.server, server)) anchor.current = { server, mono: performance.now() };
  const [tick, setTick] = useState(performance.now());
  useEffect(() => {
    const update = () => setTick(performance.now());
    update();
    const timer = setInterval(update, 1000);
    const listener = AppState.addEventListener('change', update);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  return fresh ? advanceServerClock(server, anchor.current.mono, tick) : server;
}
