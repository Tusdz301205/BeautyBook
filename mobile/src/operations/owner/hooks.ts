import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiSessionGeneration } from '../../api/client';
import { useOperations } from '../OperationsContext';
import type { OwnerScope } from '../../types/ownerOperations';
import { ownerError, ownsBusiness } from './policy';

export function useOwnerScope(): OwnerScope {
  const { user } = useAuth();
  const operations = useOperations();
  const contextKey = operations.contextKey;
  const current = useRef(contextKey); current.current = contextKey;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return { userId: user?.id ?? '', workspace: user?.workspace, sessionType: user?.sessionType,
    roles: user?.roles ?? [], scopes: user?.scopes ?? [], businessId: operations.businessId,
    branches: operations.branches, branchId: operations.branchId,
    isCurrent: () => alive.current && current.current === contextKey };
}
export function useOwnerData<T>(loader: (scope: OwnerScope) => Promise<T>, resource: string) {
  const operations = useOperations(), scope = useOwnerScope();
  const [attempt, setAttempt] = useState(0);
  const key = `${operations.contextKey}:${scope.userId}:${scope.businessId}:${scope.branchId}:${resource}`;
  const stamp = `${key}:${operations.revision}:${operations.loading}:${operations.error ?? ''}:${attempt}`;
  const latest = useRef(stamp); latest.current = stamp;
  const fetcher = useRef(loader); fetcher.current = loader;
  const currentScope = useRef(scope); currentScope.current = scope;
  const [state, setState] = useState<{ key: string; stamp: string; data?: T; loading: boolean; error: string | null }>({ key: '', stamp: '', loading: true, error: null });
  const sequence = useRef(0);
  const reload = useCallback(() => { setAttempt(value => value + 1); if (operations.error) operations.refresh(); }, [operations.error, operations.refresh]);
  useEffect(() => {
    const request = ++sequence.current, generation = getApiSessionGeneration();
    let alive = true;
    const valid = () => alive && latest.current === stamp && sequence.current === request && generation === getApiSessionGeneration();
    if (operations.loading) {
      setState({ key, stamp, loading: true, error: null });
      return;
    }
    if (operations.error) {
      setState({ key, stamp, loading: false, error: operations.error });
      return;
    }
    if (!ownsBusiness(currentScope.current)) {
      setState({ key, stamp, loading: false, error: 'Chưa có quyền chủ doanh nghiệp còn hiệu lực trong phiên này. Kiểm tra ngữ cảnh tại Tài khoản.' });
      return;
    }
    setState(previous => ({ key, stamp, data: previous.key === key ? previous.data : undefined, loading: true, error: null }));
    void fetcher.current(currentScope.current).then(data => {
      if (valid()) setState({ key, stamp, data, loading: false, error: null });
    }, error => {
      if (valid()) setState(previous => {
        const offline = error && typeof error === 'object' && 'status' in error && error.status === 0;
        const cached = offline && previous.key === key ? previous.data : undefined;
        return { key, stamp, data: cached, loading: false, error: ownerError(error) + (cached ? ' Dữ liệu đang hiển thị là bản đã tải trước đó; cần tải lại trước khi thao tác.' : '') };
      });
    });
    return () => { alive = false; };
  }, [key, stamp]);
  return { data: state.key === key ? state.data : undefined,
    loading: state.stamp !== stamp || state.loading,
    error: state.stamp === stamp ? state.error : null, reload, stamp, scope };
}
export function useOwnerMutation(reload: () => void, loaded: boolean) {
  const operations = useOperations();
  const key = operations.contextKey;
  const active = useRef(key); active.current = key;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const lock = useRef(false);
  const [state, setState] = useState({ key, busy: false, message: '', blocked: false });
  const [sawReload, setSawReload] = useState(false);
  useEffect(() => {
    if (state.blocked && !loaded) setSawReload(true);
    if (state.blocked && loaded && sawReload) { setState(previous => ({ ...previous, blocked: false })); setSawReload(false); }
  }, [loaded, sawReload, state.blocked]);
  useEffect(() => { lock.current = false; setState({ key, busy: false, message: '', blocked: false }); setSawReload(false); }, [key]);
  async function run(action: () => Promise<void>) {
    if (lock.current || !loaded || state.blocked) return false;
    lock.current = true;
    const generation = getApiSessionGeneration();
    setState({ key, busy: true, message: '', blocked: true });
    try {
      await action();
      if (alive.current && active.current === key && generation === getApiSessionGeneration()) {
        setState({ key, busy: false, message: 'Đã xử lý. Đang tải lại trạng thái từ máy chủ.', blocked: true });
        return true;
      }
      return false;
    } catch (error) {
      if (alive.current && active.current === key && generation === getApiSessionGeneration()) setState({ key, busy: false, message: ownerError(error), blocked: true });
      return false;
    } finally {
      if (alive.current && active.current === key && generation === getApiSessionGeneration()) {
        lock.current = false; reload(); operations.refresh();
      }
    }
  }
  return { run, busy: state.key === key && state.busy,
    blocked: state.key === key && state.blocked, message: state.key === key ? state.message : '' };
}
