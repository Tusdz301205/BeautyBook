import { useCallback, useEffect, useState } from 'react';

/** Each detail section owns its request and ignores results after navigation/retry. */
export function useDiscoveryResource<T>(fetcher: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    fetcher().then(data => {
      if (active) setState({ data, loading: false, error: null });
    }).catch(reason => {
      if (active) setState({ data: null, loading: false, error: reason instanceof Error ? reason.message : 'Chưa thể tải dữ liệu.' });
    });
    return () => { active = false; };
  }, [fetcher, attempt]);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  return { ...state, reload };
}
