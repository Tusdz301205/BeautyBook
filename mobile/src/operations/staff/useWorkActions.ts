import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getApiSessionGeneration } from '../../api/client';
import { staffApi } from './staffApi';
import { actionFor, createWorkGate, workError, type WorkItem, type WorkAction } from './workModel';

export function useWorkActions({ identity, fresh, staffId, reload, refresh }: {
  identity: string; fresh: boolean; staffId?: string; reload: () => Promise<boolean>; refresh: () => void;
}) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const latest = useRef({ identity, fresh, staffId, reload, refresh });
  latest.current = { identity, fresh, staffId, reload, refresh };
  const gateRef = useRef({ identity, gate: createWorkGate() });
  if (gateRef.current.identity !== identity) gateRef.current = { identity, gate: createWorkGate() };
  const [busyState, setBusy] = useState<{ identity: string; id: string } | null>(null);
  const [messageState, setMessage] = useState<{ identity: string; text: string } | null>(null);
  const reconcile = async () => {
    const captured = gateRef.current;
    try { await captured.gate.reconcile(async () => { if (!(await latest.current.reload())) throw new Error('READ_FAILED'); });
      if (captured.identity === latest.current.identity) setMessage(null);
    } catch { if (captured.identity === latest.current.identity) setMessage({ identity, text: 'Chưa xác minh được kết quả. Hãy tải lại trước khi thao tác tiếp.' }); }
  };
  const action = (item: WorkItem, requested: WorkAction) => {
    const captured = latest.current, generation = getApiSessionGeneration(), gate = gateRef.current.gate;
    const valid = () => alive.current && latest.current.identity === captured.identity && generation === getApiSessionGeneration();
    const send = async () => {
      if (!valid() || !latest.current.fresh || actionFor(item, latest.current.staffId) !== requested || gate.blocked) return;
      setBusy({ identity: captured.identity, id: item.id }); setMessage(null);
      try {
        await gate.run(() => staffApi.update(item, requested), async () => {
          // Read the restricted item endpoint even on timeout/conflict; never trust
          // the mutation envelope as a staff projection or assume the write failed.
          if (!valid()) throw new Error('STALE_REQUEST');
          let detailError: unknown;
          try { await staffApi.detail(item.id); }
          catch (error) { detailError = error; }
          const reloaded = valid() && await captured.reload();
          if (!valid() || !reloaded || detailError) throw detailError ?? new Error('READ_FAILED');
        });
        if (valid()) { setMessage({ identity: captured.identity, text: requested === 'START' ? 'Dịch vụ đã bắt đầu.' : 'Dịch vụ đã hoàn tất.' }); captured.refresh(); }
      } catch (error) {
        if (valid()) setMessage({ identity: captured.identity, text: gate.blocked
          ? 'Chưa rõ kết quả thao tác. Hãy tải lại để xác minh trước khi thử tiếp.'
          : (error as { status?: number })?.status === 409 ? workError(error).message
            : 'Đã đọc lại công việc. Hãy kiểm tra trạng thái dịch vụ trước khi thao tác tiếp.' });
      } finally { if (valid()) setBusy(null); }
    };
    if (requested === 'COMPLETE') Alert.alert('Hoàn tất dịch vụ?', `${item.serviceNameSnapshot} · ${item.customer.fullName}`, [
      { text: 'Quay lại', style: 'cancel' }, { text: 'Hoàn tất dịch vụ', onPress: () => { void send(); } },
    ]);
    else void send();
  };
  return { action, reconcile, blocked: gateRef.current.gate.blocked,
    busyId: busyState?.identity === identity ? busyState.id : null,
    message: messageState?.identity === identity ? messageState.text : null };
}
