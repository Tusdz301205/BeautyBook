import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiSessionGeneration } from '../../api/client';
import { useOperations } from '../OperationsContext';
import { staffApi, readWorkDay } from './staffApi';
import { workError, type WorkItem } from './workModel';

export function useStaffWork(query: { day?: string | null; itemId?: string; bookingId?: string }) {
  const ops = useOperations();
  const key = `${ops.contextKey}|${ops.branchId}|${query.day}|${query.itemId}|${query.bookingId}`;
  const identity = `${key}|${ops.revision}|${ops.canWorkAsStaff}|${ops.staffProfile?.id}`;
  const current = useRef(identity); current.current = identity;
  const sequence = useRef(0);
  const [snapshot, setSnapshot] = useState<{ key: string; items: WorkItem[]; serverNow: number; receivedAt: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setError] = useState<{ key: string; message: string } | null>(null);
  const [verifiedIdentity, setVerifiedIdentity] = useState<string | null>(null);
  const load = useCallback(async () => {
    const requestIdentity = identity, requestId = ++sequence.current, generation = getApiSessionGeneration();
    const valid = () => current.current === requestIdentity && sequence.current === requestId && generation === getApiSessionGeneration();
    if (!ops.canWorkAsStaff || !ops.staffProfile || !ops.branchId || (!query.itemId && !query.bookingId && !query.day)) return false;
    setLoading(true); setError(null); setVerifiedIdentity(null);
    try {
      const result = query.itemId ? await staffApi.detail(query.itemId) : await readWorkDay({ branchId: ops.branchId,
        ...(query.bookingId ? { bookingId: query.bookingId } : { dateFrom: query.day!, dateTo: query.day! }) }, valid);
      if (!valid()) return false;
      const items = 'data' in result ? result.data : [result];
      // UI defence in depth; authorization and projection still belong to the backend.
      const ownItems = items.filter(item => item.staffId === ops.staffProfile!.id && item.businessId === ops.businessId && item.branchId === ops.branchId);
      if (query.itemId && !ownItems.length) throw { status: 404 };
      setSnapshot({ key, items: ownItems, serverNow: Date.parse(result.serverNow), receivedAt: Date.now() });
      setVerifiedIdentity(requestIdentity);
      return true;
    } catch (error) {
      if (!valid()) return false;
      const feedback = workError(error);
      if (feedback.removeData) setSnapshot(null);
      setError({ key, message: feedback.message });
      return false;
    } finally { if (valid()) setLoading(false); }
  }, [identity, key, ops.branchId, ops.businessId, ops.canWorkAsStaff, ops.staffProfile?.id, query.day, query.itemId, query.bookingId]);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  const visible = ops.canWorkAsStaff && snapshot?.key === key ? snapshot : null;
  return { ops, items: visible?.items ?? [], serverNow: visible?.serverNow ?? NaN, receivedAt: visible?.receivedAt ?? 0,
    loading, error: errorState?.key === key ? errorState.message : null, fresh: verifiedIdentity === identity && !loading, load, identity };
}
