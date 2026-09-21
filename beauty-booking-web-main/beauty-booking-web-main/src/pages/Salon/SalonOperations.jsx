import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Award, Banknote, BellRing, Building2, FileText, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { branchesApi, financeOperationsApi, impactApi, loyaltyApi, ownershipApi, waitlistApi } from '../../api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { loadOperationsData, operationsContext, operationsRights, operationsTab } from '../../utils/operationsScope';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';

const panels = [
  ['impact', 'Lịch bị ảnh hưởng', AlertTriangle], ['waitlist', 'Danh sách chờ', BellRing],
  ['cash', 'Hóa đơn', Banknote], ['loyalty', 'Điểm thưởng', Award],
  ['ownership', 'Pháp nhân & chuyển chủ', Building2],
];
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const stamp = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

const emptyData = () => ({ impacts: [], waitlist: [], invoices: [], invoiceRequests: [], loyalty: null, transfers: [], versions: null });

export default function SalonOperations() {
  const [searchParams] = useSearchParams();
  const selectedImpactId = searchParams.get('impactCase') || '';
  const user = useAuthStore((state) => state.user);
  const [requestedTab, setTab] = useState('impact');
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
      const result = await loadOperationsData(user, nextContext, { impactApi, waitlistApi, financeOperationsApi, loyaltyApi, ownershipApi });
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
  const visible = panels.filter(([key]) => rights[key]);
  const tab = operationsTab(requestedTab, rights);
  const panelKey = `${context.businessId}:${context.branchId}`;

  return <Page><PageHeader eyebrow="Điều phối" title="Trung tâm vận hành" description="Điều phối lịch hẹn, danh sách chờ và các nghiệp vụ được cấp quyền." actions={<Button variant="secondary" loading={loading} onClick={() => load()}><RefreshCw size={16} />Làm mới</Button>} />
    {context.branches.length > 1 && <Field label="Chi nhánh"><Select value={context.branchId} onChange={(event) => setSelectedBranchId(event.target.value)}>{context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>}
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--bb-border)]">{visible.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === key ? 'border-[var(--bb-brand)] text-[var(--bb-brand-strong)]' : 'border-transparent text-[var(--bb-muted)]'}`}><Icon size={16} />{label}</button>)}</div>
    {error ? <Card><ErrorState message={error} onRetry={() => load()} /></Card> : loading ? <Card className="p-5"><Skeleton rows={8} /></Card> : !tab ? <Card><EmptyState title="Không có nghiệp vụ được cấp quyền" description="Tài khoản hiện tại chưa có quyền điều phối tại chi nhánh này." /></Card> : <>
      {tab === 'impact' && <ImpactPanel key={panelKey} rows={data.impacts} selectedId={selectedImpactId} busy={busy} run={run} />}
      {tab === 'waitlist' && <WaitlistPanel key={panelKey} rows={data.waitlist} canOffer={rights.offer} busy={busy} run={run} />}
      {tab === 'cash' && <InvoicePanel key={panelKey} invoices={data.invoices} invoiceRequests={data.invoiceRequests} canIssue={rights.issueInvoice} canManage={rights.manageInvoices} busy={busy} run={run} />}
      {tab === 'loyalty' && <LoyaltyPanel key={panelKey} businessId={context.businessId} liability={data.loyalty} canConfigure={rights.configureLoyalty} busy={busy} run={run} />}
      {tab === 'ownership' && <OwnershipPanel key={panelKey} businessId={context.businessId} rows={data.transfers} versions={data.versions} busy={busy} run={run} />}
    </>}
  </Page>;
}

function ImpactPanel({ rows, selectedId, busy, run }) {
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ itemId: '', resolution: 'APPROVED_EXCEPTION', reason: '', replacementStaffId: '', replacementBranchId: '', proposedStartAt: '' });
  useEffect(() => {
    if (!selectedId || detail?.id === selectedId || !rows.some((row) => row.id === selectedId)) return;
    void impactApi.detail(selectedId).then(setDetail).catch((error) => toast.error(error.message || 'Không thể mở hồ sơ ảnh hưởng'));
  }, [selectedId, rows, detail?.id]);
  if (!rows.length) return <Card><EmptyState icon={AlertTriangle} title="Không có lịch cần điều phối" description="Case sẽ tự tạo khi thao tác khóa hoặc tạm dừng ảnh hưởng lịch tương lai." /></Card>;
  return <div className="space-y-4">{rows.map((item) => {
    const opened = detail?.id === item.id;
    const pendingIds = opened ? detail.items.filter((row) => row.status === 'PENDING').map((row) => row.id) : [];
    const batchMode = form.itemId === `batch:${item.id}`;
    const payload = () => ({
      resolution: form.resolution,
      reason: form.reason,
      replacementStaffId: form.replacementStaffId || undefined,
      replacementBranchId: form.replacementBranchId || undefined,
      proposedStartAt: form.proposedStartAt ? new Date(form.proposedStartAt).toISOString() : undefined,
    });
    return <Card key={item.id} className="p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div><div className="flex gap-2"><b>{item.subjectType} · {item.action}</b><Badge>{item.status}</Badge></div><p className="mt-1 text-sm text-[var(--bb-muted)]">{item.reason} · hạn {stamp(item.deadlineAt)}</p></div>
        <Button variant="secondary" onClick={async () => setDetail(await impactApi.detail(item.id))}>Mở danh sách</Button>
      </div>
      {opened && <div className="mt-4 space-y-3 border-t border-[var(--bb-border)] pt-4">
        {pendingIds.length > 1 && <div className="rounded-lg bg-[var(--bb-surface-subtle)] p-4">
          <Button size="sm" variant="secondary" onClick={() => setForm((current) => ({ ...current, itemId: `batch:${item.id}` }))}>Xử lý hàng loạt ({pendingIds.length})</Button>
          {batchMode && <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            run(`batch:${item.id}`, async () => {
              const result = await impactApi.resolveBatch(item.id, { itemIds: pendingIds, ...payload() });
              setDetail(result.impact);
              const failed = result.results.filter((row) => !row.ok);
              if (failed.length) throw new Error(`${failed.length}/${result.results.length} lịch chưa xử lý được`);
              setForm((current) => ({ ...current, itemId: '' }));
            }, 'Đã xử lý hàng loạt lịch bị ảnh hưởng');
          }}>
            <ResolutionFields form={form} setForm={setForm} />
            <div className="sm:col-span-2"><Button type="submit" loading={busy === `batch:${item.id}`}>Áp dụng cho {pendingIds.length} lịch</Button></div>
          </form>}
        </div>}
        {detail.items.map((row) => <div key={row.id} className="rounded-lg border border-[var(--bb-border)] p-4">
          <div className="flex flex-wrap justify-between gap-2"><span><b>{row.booking?.bookingCode || row.bookingId}</b> · {row.status}</span>{row.status === 'PENDING' && <Button size="sm" variant="secondary" onClick={() => setForm((current) => ({ ...current, itemId: row.id }))}>Chọn phương án</Button>}</div>
          {form.itemId === row.id && <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            run(row.id, async () => {
              setDetail(await impactApi.resolve(item.id, row.id, payload()));
              setForm((current) => ({ ...current, itemId: '' }));
            }, 'Đã xử lý lịch bị ảnh hưởng');
          }}>
            <ResolutionFields form={form} setForm={setForm} />
            <div className="sm:col-span-2"><Button type="submit" loading={busy === row.id}>Xác nhận</Button></div>
          </form>}
        </div>)}
        {detail.status === 'READY_TO_COMPLETE' && <Button loading={busy === item.id} onClick={() => run(item.id, () => impactApi.complete(item.id), 'Đã hoàn tất case')}>Hoàn tất case</Button>}
      </div>}
    </Card>;
  })}</div>;
}

function ResolutionFields({ form, setForm }) {
  return <>
    <Field label="Phương án"><Select value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))}><option value="REASSIGN">Đổi nhân viên</option><option value="RESCHEDULE">Đổi thời gian</option><option value="TRANSFER_BRANCH">Chuyển chi nhánh</option><option value="CANCEL_REFUND">Hủy và hoàn tiền</option><option value="APPROVED_EXCEPTION">Giữ theo ngoại lệ</option></Select></Field>
    <Field label="Lý do" required><Input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required /></Field>
    {form.resolution === 'REASSIGN' && <Field label="ID nhân viên mới" required><Input value={form.replacementStaffId} onChange={(event) => setForm((current) => ({ ...current, replacementStaffId: event.target.value }))} required /></Field>}
    {form.resolution === 'TRANSFER_BRANCH' && <Field label="ID chi nhánh mới" required><Input value={form.replacementBranchId} onChange={(event) => setForm((current) => ({ ...current, replacementBranchId: event.target.value }))} required /></Field>}
    {form.resolution === 'RESCHEDULE' && <Field label="Thời gian mới" required><Input type="datetime-local" value={form.proposedStartAt} onChange={(event) => setForm((current) => ({ ...current, proposedStartAt: event.target.value }))} required /></Field>}
  </>;
}

function WaitlistPanel({ rows, canOffer, busy, run }) {
  const [forms, setForms] = useState({});
  if (!rows.length) return <Card><EmptyState icon={BellRing} title="Danh sách chờ trống" /></Card>;
  return <div className="space-y-3">{rows.map((entry) => { const form = forms[entry.id] || { startAt: '', staffId: '' }; return <Card key={entry.id} className="p-5"><div className="flex gap-2"><b>Yêu cầu {entry.id.slice(0, 8)}</b><Badge>{entry.status}</Badge></div><p className="mt-1 text-sm text-[var(--bb-muted)]">{stamp(entry.windowStart)} – {stamp(entry.windowEnd)}</p>{canOffer && entry.status === 'WAITING' && <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); run(entry.id, () => waitlistApi.offer(entry.id, { startAt: new Date(form.startAt).toISOString(), staffId: form.staffId, ttlMinutes: 10 }), 'Đã gửi offer có thời hạn'); }}><Field label="Slot đề nghị" required><Input type="datetime-local" value={form.startAt} onChange={(event) => setForms((current) => ({ ...current, [entry.id]: { ...form, startAt: event.target.value } }))} required /></Field><Field label="ID nhân viên" required><Input value={form.staffId} onChange={(event) => setForms((current) => ({ ...current, [entry.id]: { ...form, staffId: event.target.value } }))} required /></Field><Button className="mb-5 self-end" type="submit" loading={busy === entry.id}>Gửi offer</Button></form>}</Card>; })}</div>;
}

function InvoicePanel({ invoices, invoiceRequests, canIssue, canManage, busy, run }) {
  const [invoice, setInvoice] = useState({ bookingId: '', invoiceRequestId: '', buyerName: '', buyerTaxCode: '', taxRate: 0, taxInclusive: true });
  const pendingRequests = invoiceRequests.filter((request) => request.status === 'PENDING');
  const chooseRequest = (request) => setInvoice((current) => ({
    ...current,
    bookingId: request.bookingId,
    invoiceRequestId: request.id,
    buyerName: request.buyerSnapshot?.name || '',
    buyerTaxCode: request.buyerSnapshot?.taxCode || '',
  }));
  return <div className="space-y-5">
    {canIssue && <div>
      <Card className="p-5"><h2 className="font-bold">Phát hành hóa đơn</h2><p className="mt-1 text-xs text-[var(--bb-muted)]">Chỉ dựa trên khoản đã thu. Quy định pháp lý cần xác minh theo thị trường.</p><form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); run('invoice', () => financeOperationsApi.issueInvoice({ ...invoice, taxRate: Number(invoice.taxRate) }), 'Đã phát hành hóa đơn'); }}><Input aria-label="ID booking" placeholder="ID booking" value={invoice.bookingId} onChange={(event) => setInvoice((current) => ({ ...current, bookingId: event.target.value, invoiceRequestId: '' }))} required /><Input aria-label="Tên người mua" placeholder="Tên người mua" value={invoice.buyerName} onChange={(event) => setInvoice((current) => ({ ...current, buyerName: event.target.value }))} /><Input aria-label="Mã số thuế" placeholder="Mã số thuế" value={invoice.buyerTaxCode} onChange={(event) => setInvoice((current) => ({ ...current, buyerTaxCode: event.target.value }))} /><Input aria-label="Thuế suất" type="number" min="0" max="100" value={invoice.taxRate} onChange={(event) => setInvoice((current) => ({ ...current, taxRate: event.target.value }))} /><Button type="submit" loading={busy === 'invoice'}>Phát hành</Button></form></Card>
    </div>}
    <Card className="p-5"><h2 className="font-bold">Yêu cầu thông tin hóa đơn đang chờ</h2>{!pendingRequests.length ? <p className="mt-2 text-sm text-[var(--bb-muted)]">Không có yêu cầu mới.</p> : <div className="mt-3 divide-y divide-[var(--bb-border)]">{pendingRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><b>{request.booking?.bookingCode}</b> · {request.branch?.name}<p className="mt-1 text-xs text-[var(--bb-muted)]">{request.buyerSnapshot?.name}{request.buyerSnapshot?.taxCode ? ` · MST ${request.buyerSnapshot.taxCode}` : ''} · gửi {stamp(request.createdAt)}</p></div><div className="flex gap-2">{canIssue && <Button size="sm" variant="secondary" onClick={() => chooseRequest(request)}>Điền vào form</Button>}{canManage && <Button size="sm" variant="ghost" loading={busy === request.id} onClick={() => { const reason = window.prompt('Lý do từ chối yêu cầu'); if (reason?.trim()) run(request.id, () => financeOperationsApi.rejectInvoiceRequest(request.id, reason.trim()), 'Đã từ chối yêu cầu'); }}>Từ chối</Button>}</div></div>)}</div>}</Card>
    <Card className="p-5"><h2 className="font-bold">Lịch sử</h2><div className="mt-3 divide-y divide-[var(--bb-border)]">{invoices.map((row) => <div key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><FileText size={15} className="mr-2 inline" />{row.invoiceNumber} · {row.status}</span><div className="flex items-center gap-2"><b>{money(row.totalAmount)}</b>{canManage && row.status === 'ISSUED' && <Button size="sm" variant="ghost" loading={busy === `reissue-${row.id}`} onClick={() => { const reason = window.prompt('Lý do phát hành lại'); if (reason?.trim()) run(`reissue-${row.id}`, () => financeOperationsApi.reissueInvoice(row.id, { reason: reason.trim() }), 'Đã phát hành hóa đơn thay thế'); }}>Phát hành lại</Button>}</div></div>)}</div></Card>
  </div>;
}

function LoyaltyPanel({ businessId, liability, canConfigure, busy, run }) {
  const [form, setForm] = useState({ earnPointsPerAmount: 1, earnAmountUnit: 10000, redemptionValuePerPoint: 1000, expiresAfterDays: 365 });
  return <div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><h2 className="font-bold">Điểm chưa sử dụng</h2><p className="mt-3 text-3xl font-bold">{Number(liability?.pointsOutstanding || 0).toLocaleString('vi-VN')}</p><p className="text-sm text-[var(--bb-muted)]">{liability?.accounts || 0} tài khoản · nghĩa vụ quy đổi ước tính {money(liability?.estimatedLiability)} từ ledger điểm append-only.</p></Card>{canConfigure && <Card className="p-5"><h2 className="font-bold">Phiên bản quy tắc mới</h2><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); run('loyalty', () => loyaltyApi.configure({ businessId, ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)])) }), 'Đã lưu quy tắc mới'); }}>{Object.entries(form).map(([key, value]) => <Field key={key} label={key} required><Input type="number" min="1" value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required /></Field>)}<Button type="submit" loading={busy === 'loyalty'}>Lưu phiên bản</Button></form></Card>}</div>;
}

function OwnershipPanel({ businessId, rows, versions, busy, run }) {
  const [form, setForm] = useState({ newOwnerEmail: '', effectiveAt: '', reason: '' });
  const [legal, setLegal] = useState({ legalName: '', taxCode: '', registrationNumber: '', representativeName: '' });
  const [payout, setPayout] = useState({ bankName: '', accountHolder: '', accountNumber: '' });
  return <div className="space-y-5"><Card className="p-5"><h2 className="font-bold">Yêu cầu chuyển chủ</h2><p className="mt-1 text-sm text-[var(--bb-muted)]">Chủ mới phải xác nhận, sau đó nền tảng xác minh trước ngày hiệu lực.</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); run('transfer', () => ownershipApi.create({ businessId, ...form, effectiveAt: new Date(form.effectiveAt).toISOString() }), 'Đã tạo yêu cầu chuyển chủ'); }}><Field label="Email chủ mới" required><Input type="email" value={form.newOwnerEmail} onChange={(event) => setForm((current) => ({ ...current, newOwnerEmail: event.target.value }))} required /></Field><Field label="Ngày hiệu lực" required><Input type="datetime-local" value={form.effectiveAt} onChange={(event) => setForm((current) => ({ ...current, effectiveAt: event.target.value }))} required /></Field><Field className="sm:col-span-2" label="Lý do" required><Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required /></Field><Button type="submit" loading={busy === 'transfer'}>Gửi yêu cầu</Button></form></Card><div className="grid gap-5 lg:grid-cols-2"><VersionForm title="Pháp nhân" form={legal} setForm={setLegal} busy={busy === 'legal'} submit={() => run('legal', () => ownershipApi.legalVersion(businessId, legal), 'Đã lưu phiên bản pháp nhân chờ Platform xác minh')} /><VersionForm title="Tài khoản nhận tiền" form={payout} setForm={setPayout} busy={busy === 'payout'} submit={() => run('payout', () => ownershipApi.payoutVersion(businessId, payout), 'Đã lưu tài khoản nhận tiền mã hóa chờ xác minh')} /></div><Card className="p-5"><h2 className="font-bold">Lịch sử bất biến</h2><p className="mt-2 text-sm text-[var(--bb-muted)]">{rows.length} chuyển giao · {versions?.legalEntities?.length || 0} pháp nhân · {versions?.payoutAccounts?.length || 0} tài khoản payout.</p>{rows.map((row) => <div key={row.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bb-border)] pt-3 text-sm"><span>{row.status} · hiệu lực {stamp(row.effectiveAt)} · {row.reason}{row.failureReason ? ` · ${row.failureReason}` : ''}</span>{row.status === 'NEED_MORE_INFO' && <Button size="sm" loading={busy === `more-${row.id}`} onClick={() => { const note = window.prompt('Nội dung hồ sơ đã bổ sung'); if (note?.trim()) run(`more-${row.id}`, () => ownershipApi.submitMoreInfo(row.id, { note: note.trim() }), 'Đã gửi lại hồ sơ bổ sung'); }}>Gửi lại hồ sơ</Button>}</div>)}</Card></div>;
}
function VersionForm({ title, form, setForm, busy, submit }) { return <Card className="p-5"><h2 className="font-bold">{title}</h2><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>{Object.entries(form).map(([key, value], index) => <Field key={key} label={key} required><Input value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={index < 3} /></Field>)}<Button type="submit" loading={busy}>Tạo phiên bản mới</Button></form></Card>; }
