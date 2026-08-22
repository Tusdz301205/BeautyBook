import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, RefreshCw, ShieldAlert, UserRoundX } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/apiClient';
import { normalizeBooking } from '../../utils/bookingCalendar.adapter';
import { ChangeRequestCard } from '../salon/ChangeRequestCard';
import { useAuthStore } from '../../store/authStore';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  Textarea,
  cx,
} from '../ui';

export default function AppointmentQueues({ branchId, onCountsChange, onChanged }) {
  const can = useAuthStore((state) => state.can);
  const canUpdate = can('booking:update:branch') || can('booking:update:tenant');
  const canApproveChanges = can('change_request:approve:branch') || can('change_request:approve:tenant');
  const [queue, setQueue] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [queueResult, requestResult] = await Promise.all([
        bookingsApi.salonQueue(),
        canApproveChanges ? bookingsApi.pendingChangeRequests() : [],
      ]);
      setQueue(queueResult?.data ?? queueResult ?? []);
      setRequests(Array.isArray(requestResult) ? requestResult : requestResult?.data ?? []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải hàng chờ lịch hẹn.');
    } finally {
      setLoading(false);
    }
  }, [canApproveChanges]);

  useEffect(() => { load(); }, [load]);

  const scopedQueue = useMemo(
    () => branchId && branchId !== '__all__'
      ? queue.filter((booking) => (booking.branchId ?? booking.branch_id) === branchId)
      : queue,
    [branchId, queue],
  );
  const scopedRequests = useMemo(
    () => branchId && branchId !== '__all__'
      ? requests.filter((request) => request.booking?.branchId === branchId)
      : requests,
    [branchId, requests],
  );
  const unassigned = useMemo(
    () => scopedQueue.filter((booking) =>
      !(booking.services ?? []).some((service) => service.staff || service.staffId),
    ),
    [scopedQueue],
  );

  useEffect(() => {
    onCountsChange?.({
      pending: scopedQueue.length,
      changes: scopedRequests.length,
      unassigned: unassigned.length,
    });
  }, [onCountsChange, scopedQueue.length, scopedRequests.length, unassigned.length]);

  const refreshAll = async () => {
    await load();
    onChanged?.();
  };

  const approve = async (id) => {
    setBusy(id);
    try {
      await bookingsApi.updateStatus(id, 'CONFIRMED');
      toast.success('Đã xác nhận lịch');
      await refreshAll();
    } catch (updateError) {
      toast.error(updateError.message);
    } finally {
      setBusy('');
    }
  };

  const submitReject = async () => {
    if (!reject || reason.trim().length < 3) return;
    setBusy(reject.id);
    try {
      await bookingsApi.updateStatus(reject.id, 'CANCELLED', undefined, reason.trim());
      toast.success('Đã từ chối lịch');
      setReject(null);
      await refreshAll();
    } catch (updateError) {
      toast.error(updateError.message);
    } finally {
      setBusy('');
    }
  };

  const visible = tab === 'unassigned' ? unassigned : scopedQueue;

  return (
    <div className="h-full overflow-y-auto bg-[var(--bb-canvas)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--bb-ink)]">Trung tâm hành động</h2>
          <p className="mt-1 text-sm text-[var(--bb-muted)]">Hàng chờ hỗ trợ cho lịch vận hành; mọi hành động vẫn được hệ thống kiểm tra quyền và phạm vi.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refreshAll}>
          <RefreshCw size={15} /> Tải lại
        </Button>
      </div>

      <div role="tablist" aria-label="Hàng chờ lịch hẹn" className="flex gap-1 overflow-x-auto border-b border-[var(--bb-border)]">
        <QueueTab active={tab === 'pending'} onClick={() => setTab('pending')} icon={CalendarCheck}>Cần xác nhận ({scopedQueue.length})</QueueTab>
        {canApproveChanges && <QueueTab active={tab === 'requests'} onClick={() => setTab('requests')} icon={ShieldAlert}>Yêu cầu thay đổi ({scopedRequests.length})</QueueTab>}
        <QueueTab active={tab === 'unassigned'} onClick={() => setTab('unassigned')} icon={UserRoundX}>Chưa phân công ({unassigned.length})</QueueTab>
      </div>

      <div className="mt-4">
        {loading ? <Skeleton rows={6} /> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : tab === 'requests' ? (
          scopedRequests.length === 0
            ? <Card><EmptyState icon={ShieldAlert} title="Không có yêu cầu thay đổi" /></Card>
            : <div className="grid gap-4 xl:grid-cols-2">{scopedRequests.map((request) => <ChangeRequestCard key={request.id} request={request} onUpdated={refreshAll} />)}</div>
        ) : visible.length === 0 ? (
          <Card><EmptyState icon={tab === 'unassigned' ? UserRoundX : CalendarCheck} title={tab === 'unassigned' ? 'Không có lịch chưa phân công' : 'Không có lịch chờ xác nhận'} /></Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((booking) => <PendingCard
              key={booking.bookingId || booking.id}
              booking={booking}
              busy={busy}
              canUpdate={canUpdate}
              onApprove={approve}
              onReject={() => {
                setReject({ ...booking, id: booking.bookingId || booking.id });
                setReason('');
              }}
            />)}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(reject)}
        onClose={() => setReject(null)}
        title="Từ chối lịch hẹn"
        description={`Lịch ${reject?.bookingCode || reject?.id || '—'} sẽ chuyển sang CANCELLED với lý do gửi cho khách.`}
        footer={<><Button variant="secondary" onClick={() => setReject(null)}>Hủy</Button><Button variant="danger" loading={busy === reject?.id} disabled={reason.trim().length < 3} onClick={submitReject}>Xác nhận từ chối</Button></>}
      >
        <Field label="Lý do" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      </Dialog>
    </div>
  );
}

function QueueTab({ active, icon: Icon, children, ...props }) {
  return <button type="button" role="tab" aria-selected={active} className={cx('flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold', active ? 'border-[var(--bb-brand)] text-[var(--bb-brand-strong)]' : 'border-transparent text-[var(--bb-muted)]')} {...props}><Icon size={16} />{children}</button>;
}

function PendingCard({ booking, busy, canUpdate, onApprove, onReject }) {
  const id = booking.bookingId || booking.id;
  const normalized = normalizeBooking(booking);
  return (
    <Card as="article" className="overflow-hidden">
      <header className="flex items-start gap-3 border-b border-[var(--bb-border)] p-5">
        <div className="min-w-0 flex-1"><h3 className="font-bold">{booking.customer_name || 'Khách hàng'}</h3><p className="mt-1 text-xs text-[var(--bb-muted)]">{booking.services?.map((service) => service.name).filter(Boolean).join(', ') || '—'}</p></div>
        <Badge tone="warning">PENDING</Badge>
      </header>
      <div className="p-5"><p className="text-sm font-bold">{normalized.startAt ? format(normalized.startAt, 'dd/MM/yyyy · HH:mm') : '—'}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{booking.branch_name || booking.salon_name || '—'}</p><p className="bb-mono mt-3 text-xs text-[var(--bb-muted)]">{booking.bookingCode || booking.id}</p></div>
      {canUpdate && <footer className="flex justify-end gap-2 border-t border-[var(--bb-border)] p-4"><Button variant="secondary" disabled={busy === id} onClick={onReject}>Từ chối</Button><Button loading={busy === id} onClick={() => onApprove(id)}>Xác nhận</Button></footer>}
    </Card>
  );
}
