import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { Banknote, CalendarClock, CheckCircle2, FileCheck2, RefreshCcw } from 'lucide-react';
import { workforceApi } from '../../api/apiClient';
import { useAuthStore } from '../../store/authStore';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  Skeleton,
  Textarea,
  cx,
} from '../../components/ui';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const minutes = (value) => `${Math.floor(Number(value || 0) / 60)}h ${Number(value || 0) % 60}p`;
const dateText = (value) => value ? format(new Date(value), 'dd/MM/yyyy') : '—';
const statusTone = (status) => ({
  RAW: 'warning',
  APPROVED: 'success',
  LOCKED: 'neutral',
  DRAFT: 'neutral',
  REVIEW: 'warning',
  MARKED_PAID: 'success',
  EXPORTED: 'info',
  EARNED: 'success',
  REVERSED: 'danger',
}[status] || 'info');

export default function WorkforceWorkspace() {
  const user = useAuthStore((state) => state.user);
  const can = useAuthStore((state) => state.can);
  const context = useMemo(() => {
    const scope = user?.scopes?.find((item) => item.businessId || item.branchId);
    return { tenantId: scope?.businessId || null, branchId: scope?.branchId || null };
  }, [user]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [filters, setFilters] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: today,
  });
  const tabs = useMemo(() => [
    { id: 'timesheets', label: 'Bảng công', visible: can('timesheet:read:self') || can('timesheet:read:branch') || can('timesheet:read:tenant') },
    { id: 'compensation', label: 'Thu nhập', visible: can('compensation:read:self') || can('compensation:read:tenant') },
    { id: 'pay-runs', label: 'Kỳ thanh toán', visible: can('pay_run:read:self') || can('pay_run:manage:tenant') },
  ].filter((item) => item.visible), [can]);
  const [tab, setTab] = useState(() => tabs[0]?.id || 'timesheets');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState(null);
  const businessId = context.tenantId;
  const branchId = context.branchId;
  const canReview = can('timesheet:review:branch') || can('timesheet:review:tenant');
  const canGenerate = can('timesheet:generate:branch') || can('timesheet:generate:tenant');
  const canManageCompensation = can('compensation:manage:tenant');
  const canManagePayRuns = can('pay_run:manage:tenant');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = tab === 'timesheets'
        ? await workforceApi.getTimesheets({ ...filters, branchId: branchId || undefined })
        : tab === 'compensation'
          ? await workforceApi.getCompensation({ ...filters, businessId: businessId || undefined })
          : await workforceApi.getPayRuns(businessId || undefined);
      setData(result || []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải dữ liệu nhân sự');
    } finally {
      setLoading(false);
    }
  }, [branchId, businessId, filters, tab]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) setTab(tabs[0]?.id || 'timesheets');
  }, [tab, tabs]);

  const generate = async () => {
    setBusy('generate');
    try {
      const result = await workforceApi.generateTimesheets({
        ...filters,
        branchId: branchId || undefined,
      });
      toast.success(`Đã đồng bộ ${result?.generated ?? result?.timesheets?.length ?? 0} bảng công từ attendance`);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const calculate = async () => {
    if (!businessId) return toast.error('Không xác định được doanh nghiệp');
    setBusy('calculate');
    try {
      const result = await workforceApi.calculateCompensation({ businessId, ...filters });
      toast.success(`Đã xử lý ${result?.entriesProcessed ?? 0} khoản thu nhập đủ điều kiện`);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const createPayRun = async () => {
    if (!businessId) return toast.error('Không xác định được doanh nghiệp');
    setBusy('pay-run');
    try {
      await workforceApi.createPayRun({
        businessId,
        periodStart: filters.from,
        periodEnd: filters.to,
      });
      toast.success('Đã tạo kỳ thanh toán nháp từ các khoản thu nhập đủ điều kiện');
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const submitReview = async () => {
    if (!review?.reason?.trim()) return;
    setBusy(review.id);
    try {
      if (review.kind === 'approve') {
        await workforceApi.approveTimesheet(review.id, {
          approvedPaidMinutes: Number(review.approvedPaidMinutes),
          reason: review.reason.trim(),
        });
        toast.success('Đã duyệt thời gian được tính thu nhập');
      } else {
        await workforceApi.requestTimesheetAdjustment(review.id, {
          newData: { approvedPaidMinutes: Number(review.approvedPaidMinutes) },
          reason: review.reason.trim(),
        });
        toast.success('Đã gửi yêu cầu điều chỉnh bảng công');
      }
      setReview(null);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const transitionPayRun = async (item) => {
    const transitions = {
      DRAFT: 'REVIEW',
      REVIEW: 'APPROVED',
      APPROVED: 'LOCKED',
      LOCKED: 'MARKED_PAID',
      EXPORTED: 'MARKED_PAID',
    };
    const next = transitions[item.status];
    if (!next) return;
    const requiresReference = ['MARKED_PAID', 'EXPORTED'].includes(next);
    setBusy(item.id);
    try {
      await workforceApi.transitionPayRun(item.id, {
        status: next,
        reason: `Chuyển kỳ thu nhập ${item.status} → ${next}`,
        ...(requiresReference ? { externalReference: `MANUAL-${Date.now()}` } : {}),
      });
      toast.success(next === 'MARKED_PAID'
        ? 'Đã ghi nhận doanh nghiệp xử lý thanh toán bên ngoài'
        : `Đã chuyển kỳ sang ${next}`);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const actions = tab === 'timesheets' && canGenerate
    ? <Button variant="secondary" loading={busy === 'generate'} onClick={generate}><RefreshCcw size={16} />Đồng bộ attendance</Button>
    : tab === 'compensation' && canManageCompensation
      ? <Button loading={busy === 'calculate'} onClick={calculate}><Banknote size={16} />Tính khoản đủ điều kiện</Button>
      : tab === 'pay-runs' && canManagePayRuns
        ? <Button loading={busy === 'pay-run'} onClick={createPayRun}><FileCheck2 size={16} />Tạo kỳ nháp</Button>
        : null;

  return <Page>
    <PageHeader
      eyebrow="Workforce"
      title="Bảng công & thu nhập"
      description="Attendance là dữ liệu thực tế; chỉ thời gian đã duyệt mới đi vào tính thu nhập và kỳ thanh toán."
      actions={actions}
    />

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--bb-border)] bg-white p-1" role="tablist" aria-label="Dữ liệu workforce">
      {tabs.map((item) => <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={tab === item.id}
        onClick={() => setTab(item.id)}
        className={cx('min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold', tab === item.id ? 'bg-[var(--bb-brand)] text-white' : 'text-[var(--bb-muted)] hover:bg-[var(--bb-surface-subtle)]')}
      >{item.label}</button>)}
    </div>

    <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:max-w-2xl">
      <Field label="Từ ngày"><Input type="date" value={filters.from} max={filters.to} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></Field>
      <Field label="Đến ngày"><Input type="date" value={filters.to} min={filters.from} max={format(addDays(new Date(), 365), 'yyyy-MM-dd')} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></Field>
    </Card>

    {loading
      ? <Card className="p-5"><Skeleton rows={7} /></Card>
      : error
        ? <Card><ErrorState message={error} onRetry={load} /></Card>
        : tab === 'timesheets'
          ? <Timesheets rows={data} canReview={canReview} onReview={setReview} user={user} />
          : tab === 'compensation'
            ? <Compensation rows={data} />
            : <PayRuns rows={data} canManage={canManagePayRuns} busy={busy} onTransition={transitionPayRun} />}

    <Dialog
      open={Boolean(review)}
      onClose={() => setReview(null)}
      title={review?.kind === 'approve' ? 'Duyệt bảng công' : 'Yêu cầu điều chỉnh bảng công'}
      description="Thay đổi được lưu với lý do và người thực hiện; raw attendance không bị ghi đè."
      footer={<>
        <Button variant="secondary" onClick={() => setReview(null)}>Hủy</Button>
        <Button loading={busy === review?.id} disabled={!review?.reason?.trim()} onClick={submitReview}>
          {review?.kind === 'approve' ? 'Duyệt thời gian' : 'Gửi yêu cầu'}
        </Button>
      </>}
    >
      <div className="grid gap-4">
        <Field label="Số phút được tính" required>
          <Input type="number" min="0" max="1440" value={review?.approvedPaidMinutes ?? ''} onChange={(event) => setReview((current) => ({ ...current, approvedPaidMinutes: event.target.value }))} />
        </Field>
        <Field label="Lý do" required>
          <Textarea value={review?.reason || ''} onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))} />
        </Field>
      </div>
    </Dialog>
  </Page>;
}

function Timesheets({ rows, canReview, onReview, user }) {
  if (!rows.length) return <Card><EmptyState icon={CalendarClock} title="Chưa có bảng công" description="Bảng công raw sẽ được tạo từ check-in, break và check-out thực tế." /></Card>;
  const isStaff = user?.roles?.includes('STAFF');
  return <div className="grid gap-4 xl:grid-cols-2">{rows.map((row) => <Card key={row.id} className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-bold">{row.staff?.fullName || 'Nhân viên'}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{row.branch?.name || 'Chi nhánh'} · {dateText(row.workDate)}</p></div>
      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
    </div>
    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <Stat label="Ca dự kiến" value={minutes(row.scheduledMinutes)} />
      <Stat label="Làm thực tế" value={minutes(row.actualWorkedMinutes)} />
      <Stat label="Giờ nghỉ" value={minutes(row.breakMinutes)} />
      <Stat label="Đi muộn" value={minutes(row.lateMinutes)} />
      <Stat label="Làm thêm" value={minutes(row.overtimeMinutes)} />
      <Stat label="Được tính" value={row.approvedPaidMinutes == null ? 'Chưa duyệt' : minutes(row.approvedPaidMinutes)} strong />
    </dl>
    {(row.adjustments || []).length > 0 && <p className="mt-4 text-xs text-[var(--bb-muted)]">{row.adjustments.length} yêu cầu điều chỉnh · mới nhất: {row.adjustments[0].status}</p>}
    {row.status !== 'LOCKED' && <div className="mt-4 flex justify-end">
      <Button size="sm" variant={canReview ? 'primary' : 'secondary'} onClick={() => onReview({
        id: row.id,
        kind: canReview ? 'approve' : 'adjust',
        approvedPaidMinutes: row.approvedPaidMinutes ?? row.actualWorkedMinutes,
        reason: '',
      })}>{canReview ? <><CheckCircle2 size={15} />Duyệt</> : isStaff ? 'Yêu cầu điều chỉnh' : 'Điều chỉnh'}</Button>
    </div>}
  </Card>)}</div>;
}

function Compensation({ rows }) {
  if (!rows.length) return <Card><EmptyState icon={Banknote} title="Chưa có khoản thu nhập" description="Chỉ bảng công đã duyệt hoặc dịch vụ đã thực hiện và thanh toán đủ mới tạo khoản thu nhập." /></Card>;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return <div className="space-y-4">
    <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--bb-muted)]">Tổng trong phạm vi</p><p className="mt-2 text-3xl font-bold tabular-nums">{money(total)}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">Có thể truy vết từng dòng về rule, phiên bản, booking hoặc bảng công nguồn.</p></Card>
    <div className="grid gap-3">{rows.map((row) => <Card key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1"><p className="font-bold">{row.staff?.fullName || 'Nhân viên'} · {row.rule?.name || row.type}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{row.branch?.name || 'Chi nhánh'} · {dateText(row.earnedAt)} · Rule v{row.ruleVersion || row.rule?.version || '—'}</p></div>
      <p className="text-lg font-bold tabular-nums">{money(row.amount)}</p><Badge tone={statusTone(row.status)}>{row.status}</Badge>
    </Card>)}</div>
  </div>;
}

function PayRuns({ rows, canManage, busy, onTransition }) {
  if (!rows.length) return <Card><EmptyState icon={FileCheck2} title="Chưa có kỳ thanh toán" description="Kỳ nháp sẽ gom các khoản thu nhập EARNED chưa nằm trong kỳ khác." /></Card>;
  const nextLabel = { DRAFT: 'Gửi duyệt', REVIEW: 'Phê duyệt', APPROVED: 'Khóa kỳ', LOCKED: 'Đánh dấu đã xử lý', EXPORTED: 'Đánh dấu đã xử lý' };
  return <div className="grid gap-4">{rows.map((row) => <Card key={row.id} className="p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1"><p className="font-bold">{dateText(row.periodStart)} – {dateText(row.periodEnd)}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{row.items?.length || 0} nhân viên · Pay run không phải chuyển khoản ngân hàng tự động.</p></div>
      <div className="text-left sm:text-right"><p className="text-xl font-bold tabular-nums">{money(row.netAmount)}</p><Badge tone={statusTone(row.status)}>{row.status}</Badge></div>
    </div>
    {canManage && nextLabel[row.status] && <div className="mt-4 flex justify-end"><Button size="sm" loading={busy === row.id} onClick={() => onTransition(row)}>{nextLabel[row.status]}</Button></div>}
  </Card>)}</div>;
}

function Stat({ label, value, strong }) {
  return <div className="rounded-lg bg-[var(--bb-surface-subtle)] p-3"><dt className="text-xs text-[var(--bb-muted)]">{label}</dt><dd className={cx('mt-1 tabular-nums', strong ? 'font-bold text-[var(--bb-brand-strong)]' : 'font-semibold')}>{value}</dd></div>;
}
