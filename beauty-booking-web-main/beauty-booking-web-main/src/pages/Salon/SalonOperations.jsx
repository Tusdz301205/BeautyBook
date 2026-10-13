import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { branchesApi, impactApi } from '../../api/apiClient';
import OperationsResolutionForm from '../../components/salon/OperationsResolutionForm';
import { operationLabel } from '../../utils/operationsProduct';
import { useAuthStore } from '../../store/authStore';
import { loadOperationsData, operationsContext, operationsRights, operationsTab } from '../../utils/operationsScope';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Page, PageHeader, Select, Skeleton } from '../../components/ui';

const stamp = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

const emptyData = () => ({ impacts: [] });

export default function SalonOperations() {
  const [searchParams] = useSearchParams();
  const selectedImpactId = searchParams.get('impactCase') || '';
  const user = useAuthStore((state) => state.user);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [context, setContext] = useState({ businessId: '', branchId: '', branches: [] });
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const current = () => sequence === requestSequence.current;
    setLoading(true); setError(''); setData(emptyData());
    try {
      const branches = await branchesApi.getAccessible();
      if (!current()) return;
      const nextContext = operationsContext(user, branches, selectedBranchId);
      setContext(nextContext);
      const result = await loadOperationsData(user, nextContext, { impactApi });
      if (current()) setData(result);
    } catch (requestError) {
      if (current()) setError(requestError.message || 'Không thể tải trung tâm vận hành');
    } finally { if (current()) setLoading(false); }
  }, [user, selectedBranchId]);
  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);
  const run = async (key, action, success) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (requestError) { toast.error(requestError.message); }
    finally { setBusy(''); }
  };
  const rights = operationsRights(user, context);

  const tab = operationsTab('impact', rights);
  const panelKey = `${context.businessId}:${context.branchId}`;

  return <Page><PageHeader eyebrow="Điều phối" title="Trung tâm vận hành" actions={<Button variant="secondary" loading={loading} onClick={() => load()}><RefreshCw size={16} />Làm mới</Button>} />
    {context.branches.length > 1 && <Field label="Chi nhánh"><Select value={context.branchId} onChange={(event) => { requestSequence.current += 1; setLoading(true); setData(emptyData()); setSelectedBranchId(event.target.value); }}>{context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>}
    {error ? <Card><ErrorState message={error} onRetry={() => load()} /></Card> : loading ? <Card className="p-5"><Skeleton rows={8} /></Card> : !tab ? <Card><EmptyState title="Không có nghiệp vụ được cấp quyền" description="Tài khoản hiện tại chưa có quyền điều phối tại chi nhánh này." /></Card> : <>
      {tab === 'impact' && <ImpactPanel key={panelKey} rows={data.impacts} selectedId={selectedImpactId} businessId={context.businessId} branches={context.branches} busy={busy} run={run} />}

    </>}
  </Page>;
}

export function ImpactPanel({ rows, selectedId, businessId, branches, busy, run }) {
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ itemId: '', resolution: 'APPROVED_EXCEPTION', reason: '', replacementStaffId: '', replacementBranchId: '', proposedStartAt: '' });
  const [detailLoading, setDetailLoading] = useState('');
  const [detailError, setDetailError] = useState(null);
  const detailSequence = useRef(0);
  const openDetail = useCallback(async (id) => {
    const sequence = ++detailSequence.current;
    setDetail(null); setDetailLoading(id); setDetailError(null);
    setForm((current) => ({ ...current, itemId: '', replacementStaffId: '', replacementBranchId: '' }));
    try { const result = await impactApi.detail(id); if (sequence === detailSequence.current) setDetail(result); }
    catch { if (sequence === detailSequence.current) setDetailError({ id, message: 'Không thể tải danh sách lịch bị ảnh hưởng.' }); }
    finally { if (sequence === detailSequence.current) setDetailLoading(''); }
  }, []);
  useEffect(() => {
    if (selectedId && rows.some((row) => row.id === selectedId)) void openDetail(selectedId);
    return () => { detailSequence.current += 1; };
  }, [selectedId, rows, openDetail]);
  const choose = (itemId) => setForm((current) => ({ ...current, itemId, replacementStaffId: '', replacementBranchId: '' }));
  if (!rows.length) return <Card><EmptyState icon={AlertTriangle} title="Không có lịch cần điều phối" description="Các lịch cần xử lý sẽ xuất hiện khi việc khóa hoặc tạm dừng ảnh hưởng đến lịch sắp tới." /></Card>;
  return <div className="space-y-4">{rows.map((item) => {
    const opened = detail?.id === item.id;
    const detailItems = opened && Array.isArray(detail.items) ? detail.items : [];
    const pendingIds = detailItems.filter((row) => row.status === 'PENDING').map((row) => row.id);
    const batchMode = form.itemId === `batch:${item.id}`;
    return <Card key={item.id} className="min-w-0 break-words [overflow-wrap:anywhere] p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><b>{operationLabel('subject', item.subjectType)} · {operationLabel('action', item.action)}</b><Badge>{operationLabel('status', item.status)}</Badge></div><p className="mt-1 text-sm text-[var(--bb-muted)]">{item.reason || 'Chưa có lý do'} · hạn {stamp(item.deadlineAt)}</p></div>
        <Button variant="secondary" loading={detailLoading === item.id} onClick={() => openDetail(item.id)}>Mở danh sách</Button>
      </div>
      {detailError?.id === item.id && <ErrorState message={detailError.message} onRetry={() => openDetail(item.id)} />}
      {opened && <div className="mt-4 space-y-3 border-t border-[var(--bb-border)] pt-4">
        {pendingIds.length > 1 && <div className="rounded-lg bg-[var(--bb-surface-subtle)] p-4">
          <Button size="sm" variant="secondary" onClick={() => choose(`batch:${item.id}`)}>Xử lý hàng loạt ({pendingIds.length})</Button>
          {batchMode && <OperationsResolutionForm key={form.itemId} form={form} setForm={setForm} businessId={businessId} branches={branches} items={detailItems.filter((row) => row.status === 'PENDING')} busy={busy === `batch:${item.id}`} submitLabel={`Áp dụng cho ${pendingIds.length} lịch`} submit={(payload) => {
            run(`batch:${item.id}`, async () => {
              const result = await impactApi.resolveBatch(item.id, { itemIds: pendingIds, ...payload });
              setDetail(result.impact);
              const failed = result.results.filter((row) => !row.ok);
              if (failed.length) throw new Error(`${failed.length}/${result.results.length} lịch chưa xử lý được`);
              setForm((current) => ({ ...current, itemId: '' }));
            }, 'Đã xử lý hàng loạt lịch bị ảnh hưởng');
          }} />}
        </div>}
        {!Array.isArray(detail.items) ? <ErrorState message="Chưa tải được danh sách lịch trong hồ sơ." onRetry={() => openDetail(item.id)} /> : !detailItems.length && <EmptyState title="Chưa có lịch trong hồ sơ" description="Hồ sơ này hiện không có lịch bị ảnh hưởng để hiển thị." />}
        {detailItems.map((row) => <div key={row.id} className="rounded-lg border border-[var(--bb-border)] p-4">
          <div className="flex flex-wrap justify-between gap-2"><span><b>{row.booking?.bookingCode || 'Lịch hẹn chưa có mã'}</b> · {operationLabel('status', row.status)}</span>{row.status === 'PENDING' && <Button size="sm" variant="secondary" onClick={() => choose(row.id)}>Chọn phương án</Button>}</div>
          {!row.booking && <p className="mt-2 text-sm text-[var(--bb-muted)]">Chưa tải được thông tin lịch hẹn. Tải lại hồ sơ trước khi đổi nhân viên hoặc chi nhánh.</p>}
          {form.itemId === row.id && <OperationsResolutionForm key={row.id} form={form} setForm={setForm} businessId={businessId} branches={branches} items={[row]} busy={busy === row.id} submitLabel="Xác nhận" submit={(payload) => {
            run(row.id, async () => {
              setDetail(await impactApi.resolve(item.id, row.id, payload));
              setForm((current) => ({ ...current, itemId: '' }));
            }, 'Đã xử lý lịch bị ảnh hưởng');
          }} />}
        </div>)}
        {detail.status === 'READY_TO_COMPLETE' && <Button loading={busy === item.id} onClick={() => run(item.id, () => impactApi.complete(item.id), 'Đã hoàn tất hồ sơ')}>Hoàn tất hồ sơ</Button>}
      </div>}
    </Card>;
  })}</div>;
}
