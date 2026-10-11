import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiAccessToken, getApiSessionGeneration, subscribeApiAccessToken } from '../api/client';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import { createNotificationRequests } from '../utils/notificationRequests';

export function useNotificationRequests(append: boolean, contextKey = '', revision = 0) {
  const { user, isLoggedIn } = useAuth();
  const [, render] = useState(0);
  const generation = getApiSessionGeneration();
  const identity = `${user?.id ?? ''}:${isLoggedIn}:${generation}:${contextKey}`;
  const latest = useRef(identity);
  latest.current = identity;
  const requests = useMemo(() => createNotificationRequests(notificationsApi, append,
    () => latest.current === identity && getApiSessionGeneration() === generation && Boolean(getApiAccessToken()) && isLoggedIn,
    () => render(value => value + 1)), [append, identity, generation, isLoggedIn]);

  useEffect(() => subscribeApiAccessToken(() => render(value => value + 1)), []);
  useEffect(() => {
    requests.activate();
    return () => requests.dispose();
  }, [requests]);
  useEffect(() => { void requests.reload(); }, [requests, revision]);
  return { ...requests.getState(), requests };
}
