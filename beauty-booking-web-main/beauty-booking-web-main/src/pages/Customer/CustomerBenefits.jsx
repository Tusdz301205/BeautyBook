import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, BellRing, CalendarPlus, FileText, Heart, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { bookingsApi, financeOperationsApi, loyaltyApi, ownershipApi, savedServicesApi, waitlistApi } from '../../api/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';
import { canSubmitInvoiceRequest } from '../../utils/businessCompletionRules';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const date = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function CustomerBenefits() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ saved: [], loyalty: [], waitlist: [], invoices: [], invoiceRequests: [], completedBookings: [], ownership: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const serviceId = params.get('waitlistServiceId') || '';
  const branchId = params.get('branchId') || '';
  const offeredEntryId = params.get('waitlistOffer') || '';
  const offerToken = params.get('token') || '';
  const [window, setWindow] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      savedServicesApi.list(), loyaltyApi.mine(), waitlistApi.mine(), financeOperationsApi.invoices(),
      ownershipApi.incoming(), financeOperationsApi.invoiceRequests(), bookingsApi.myAppointments('completed'),
    ]);
    setData({
      saved: results[0].status === 'fulfilled' ? results[0].value || [] : [],
      loyalty: results[1].status === 'fulfilled' ? results[1].value || [] : [],
      waitlist: results[2].status === 'fulfilled' ? results[2].value || [] : [],
      invoices: results[3].status === 'fulfilled' ? results[3].value || [] : [],
      ownership: results[4].status === 'fulfilled' ? results[4].value || [] : [],
      invoiceRequests: results[5].status === 'fulfilled' ? results[5].value || [] : [],
      completedBookings: results[6].status === 'fulfilled' ? results[6].value?.data ?? results[6].value ?? [] : [],
    });
    if (results.every((result) => result.status === 'rejected')) setError(results[0].reason?.message || 'Không thể tải dữ liệu tài khoản');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totalPoints = useMemo(() => data.loyalty.reduce((sum, item) => sum + Number(item.balance || 0), 0), [data.loyalty]);
  const run = async (key, action, success) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (requestError) { toast.error(requestError.message); }
    finally { setBusy(''); }
  };
  const join = async (event) => {
    event.preventDefault();
    await run('join', () => waitlistApi.join({ branchId, serviceId, windowStart: new Date(window.from).toISOString(), windowEnd: new Date(window.to).toISOString() }), 'Đã tham gia danh sách chờ');
    setParams({});
  };

  return <Page>
    <PageHeader eyebrow="Tiện ích cá nhân" title="Đã lưu & quyền lợi" description="Theo dõi dịch vụ yêu thích, điểm thưởng, danh sách chờ và hóa đơn thật của tài khoản." />
    {error ? <ErrorState message={error} onRetry={load} /> : loading ? <Card className="p-5"><Skeleton rows={8} /></Card> : <div className="space-y-7">
      {offeredEntryId && offerToken && <Card className="flex flex-col gap-3 border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><h2 className="font-bold text-emerald-900">Có chỗ trống dành cho bạn</h2><p className="mt-1 text-sm text-emerald-800">Xác nhận ngay để tạo lịch thật trước khi đề nghị hết hạn.</p></div><Button loading={busy === offeredEntryId} onClick={() => run(offeredEntryId, () => waitlistApi.accept(offeredEntryId, offerToken), 'Đã xác nhận lịch từ danh sách chờ').then(() => setParams({}))}>Xác nhận chỗ</Button></Card>}
      {serviceId && branchId && <Card className="p-5"><h2 className="font-bold">Nhận chỗ trống phù hợp</h2><p className="mt-1 text-sm text-[var(--bb-muted)]">Chọn khoảng thời gian bạn có thể đến. Mỗi chỗ trống chỉ một khách được xác nhận.</p><form onSubmit={join} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Từ" required><Input type="datetime-local" value={window.from} onChange={(event) => setWindow((current) => ({ ...current, from: event.target.value }))} required /></Field><Field label="Đến" required><Input type="datetime-local" value={window.to} onChange={(event) => setWindow((current) => ({ ...current, to: event.target.value }))} required /></Field><div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={busy === 'join'}><BellRing size={16} />Tham gia danh sách chờ</Button><Button variant="secondary" onClick={() => setParams({})}>Hủy</Button></div></form></Card>}

      {data.ownership.length > 0 && <section><div className="mb-3"><h2 className="text-xl font-bold">Yêu cầu tiếp nhận doanh nghiệp</h2><p className="text-sm text-[var(--bb-muted)]">Kiểm tra tác động trước khi xác nhận trở thành chủ mới.</p></div><div className="space-y-3">{data.ownership.map((transfer) => <Card key={transfer.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{transfer.scopeSnapshot?.branches?.[0]?.name || 'Chuyển quyền sở hữu doanh nghiệp'}</h3><Badge tone="warning">{transfer.status}</Badge></div><p className="mt-2 text-sm text-[var(--bb-muted)]">Hiệu lực dự kiến {date(transfer.effectiveAt)} · {transfer.reason}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-[var(--bb-muted)]">Lịch tương lai</dt><dd className="font-bold">{transfer.impactSnapshot?.futureBookings || 0}</dd></div><div><dt className="text-[var(--bb-muted)]">Thanh toán chờ</dt><dd className="font-bold">{transfer.impactSnapshot?.pendingPayments || 0}</dd></div><div><dt className="text-[var(--bb-muted)]">Hoàn tiền chờ</dt><dd className="font-bold">{transfer.impactSnapshot?.pendingRefunds || 0}</dd></div></dl></div>{transfer.status === 'PENDING_NEW_OWNER_ACCEPTANCE' && <Button loading={busy === transfer.id} onClick={() => run(transfer.id, () => ownershipApi.accept(transfer.id), 'Đã xác nhận tiếp nhận; hồ sơ được chuyển tới Platform')}>Xác nhận tiếp nhận</Button>}</div></Card>)}</div></section>}

      <section><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Dịch vụ đã lưu</h2><p className="text-sm text-[var(--bb-muted)]">{data.saved.length} lựa chọn để xem lại sau.</p></div><Link className="text-sm font-semibold text-[var(--bb-brand-strong)]" to="/explore">Khám phá thêm</Link></div>{!data.saved.length ? <Card><EmptyState icon={Heart} title="Chưa lưu dịch vụ nào" description="Mở một dịch vụ và chọn Lưu để xem lại tại đây." /></Card> : <div className="grid gap-4 md:grid-cols-2">{data.saved.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]"><Heart size={19} fill="currentColor" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.offering?.name || 'Dịch vụ không còn hiển thị'}</h3><Badge tone={item.available ? 'success' : 'warning'}>{item.available ? 'Đang nhận lịch' : 'Tạm không khả dụng'}</Badge></div><p className="mt-1 text-sm text-[var(--bb-muted)]">{item.offering?.branch?.name || 'Cơ sở đã cập nhật'} · {money(item.offering?.price)}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{item.offering && <Link to={`/explore/services/${item.offering.id}`}><Button variant="secondary">Xem chi tiết</Button></Link>}{item.available && <Link to={`/book?branchId=${item.offering.branchId}&serviceId=${item.offering.id}`}><Button><CalendarPlus size={16} />Đặt lịch</Button></Link>}<Button variant="ghost" loading={busy === item.branchServiceOfferingId} onClick={() => run(item.branchServiceOfferingId, () => savedServicesApi.remove(item.branchServiceOfferingId), 'Đã bỏ lưu dịch vụ')}><Trash2 size={16} />Bỏ lưu</Button></div></Card>)}</div>}</section>

      <section><div className="mb-3"><h2 className="text-xl font-bold">Điểm thưởng</h2><p className="text-sm text-[var(--bb-muted)]">Tổng số dư hiện tại: <strong>{totalPoints.toLocaleString('vi-VN')} điểm</strong>. Điểm được quản lý riêng theo từng doanh nghiệp.</p></div>{!data.loyalty.length ? <Card><EmptyState icon={Award} title="Chưa có điểm thưởng" description="Điểm chỉ phát sinh từ khoản thanh toán hợp lệ của lịch đã hoàn thành." /></Card> : <div className="space-y-3">{data.loyalty.map((account) => <Card key={account.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{account.businessName || 'Chương trình khách hàng thân thiết'}</h3><p className="mt-1 text-sm text-[var(--bb-muted)]">{Number(account.balance).toLocaleString('vi-VN')} điểm · sắp hết hạn {Number(account.expiringPoints || 0).toLocaleString('vi-VN')}</p></div><Badge tone="info">{account.transactions?.length || 0} giao dịch</Badge></div><div className="mt-3 divide-y divide-[var(--bb-border)]">{account.transactions?.slice(0, 5).map((transaction) => <div key={transaction.id} className="flex justify-between gap-3 py-2 text-sm"><span>{transaction.type} · {transaction.description || 'Điều chỉnh điểm'}</span><strong className={Number(transaction.points) >= 0 ? 'text-emerald-700' : 'text-red-700'}>{Number(transaction.points) > 0 ? '+' : ''}{transaction.points}</strong></div>)}</div></Card>)}</div>}</section>

      <section><h2 className="text-xl font-bold">Danh sách chờ</h2><div className="mt-3 space-y-3">{!data.waitlist.length ? <Card><EmptyState icon={BellRing} title="Không có yêu cầu đang chờ" description="Bạn có thể chọn Nhận chỗ trống tại trang chi tiết dịch vụ." /></Card> : data.waitlist.map((entry) => <Card key={entry.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><h3 className="font-bold">{entry.branch?.name || 'Chi nhánh'}</h3><Badge>{entry.status}</Badge></div><p className="mt-1 text-sm text-[var(--bb-muted)]">Khung mong muốn: {date(entry.windowStart)} – {date(entry.windowEnd)}{entry.offerExpiresAt ? ` · Offer hết hạn ${date(entry.offerExpiresAt)}` : ''}</p></div>{['WAITING', 'OFFERED'].includes(entry.status) && <Button variant="secondary" loading={busy === entry.id} onClick={() => run(entry.id, () => waitlistApi.cancel(entry.id), 'Đã rời danh sách chờ')}>Rời danh sách</Button>}</Card>)}</div></section>

      <InvoicePanel data={data} busy={busy} run={run} />
    </div>}
  </Page>;
}

function InvoicePanel({ data, busy, run }) {
  const [form, setForm] = useState({ bookingId: '', buyerName: '', buyerEmail: '', buyerTaxCode: '', buyerAddress: '', note: '' });
  const submit = async (event) => {
    event.preventDefault();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `invoice-request-${Date.now()}`;
    await run('invoice-request', () => financeOperationsApi.requestInvoice({ ...form, idempotencyKey }), 'Đã gửi thông tin yêu cầu hóa đơn');
    setForm({ bookingId: '', buyerName: '', buyerEmail: '', buyerTaxCode: '', buyerAddress: '', note: '' });
  };
  return <section>
    <div className="mb-3"><h2 className="text-xl font-bold">Hóa đơn & phiếu thu</h2><p className="text-sm text-[var(--bb-muted)]">Chỉ yêu cầu cho lịch đã được thu đủ. Quy định hóa đơn/VAT cần được xác minh theo thị trường triển khai.</p></div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
      <div className="space-y-3">{!data.invoices.length ? <Card><EmptyState icon={FileText} title="Chưa có hóa đơn" description="Hóa đơn đã phát hành từ khoản thực thu sẽ xuất hiện tại đây." /></Card> : data.invoices.map((invoice) => <Card key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="font-bold">{invoice.invoiceNumber}</h3><p className="mt-1 text-sm text-[var(--bb-muted)]">Phát hành {date(invoice.issuedAt)} · {invoice.status}</p></div><strong>{money(invoice.totalAmount)}</strong></Card>)}</div>
      <Card className="p-5"><h3 className="font-bold">Yêu cầu thông tin hóa đơn</h3><form className="mt-4 space-y-3" onSubmit={submit}>
        <Field label="Lịch đã hoàn thành" required><Select value={form.bookingId} onChange={(event) => setForm((current) => ({ ...current, bookingId: event.target.value }))} required><option value="">Chọn lịch hẹn</option>{data.completedBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.bookingCode} · {booking.branch?.name || 'Cơ sở'} · {date(booking.appointmentDate)}</option>)}</Select></Field>
        <Field label="Tên người mua" required><Input value={form.buyerName} onChange={(event) => setForm((current) => ({ ...current, buyerName: event.target.value }))} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Email"><Input type="email" value={form.buyerEmail} onChange={(event) => setForm((current) => ({ ...current, buyerEmail: event.target.value }))} /></Field><Field label="Mã số thuế"><Input value={form.buyerTaxCode} onChange={(event) => setForm((current) => ({ ...current, buyerTaxCode: event.target.value }))} /></Field></div>
        <Field label="Địa chỉ"><Input value={form.buyerAddress} onChange={(event) => setForm((current) => ({ ...current, buyerAddress: event.target.value }))} /></Field>
        <Field label="Ghi chú"><Textarea className="min-h-20" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></Field>
        <Button type="submit" loading={busy === 'invoice-request'} disabled={!canSubmitInvoiceRequest(form, data.completedBookings)}>Gửi yêu cầu</Button>
      </form></Card>
    </div>
    {data.invoiceRequests.length > 0 && <div className="mt-4 space-y-2">{data.invoiceRequests.map((request) => <Card key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><strong>{request.booking?.bookingCode}</strong> · {request.branch?.name}<p className="mt-1 text-xs text-[var(--bb-muted)]">Gửi {date(request.createdAt)}{request.resolutionNote ? ` · ${request.resolutionNote}` : ''}</p></div><div className="flex items-center gap-2"><Badge tone={request.status === 'FULFILLED' ? 'success' : request.status === 'PENDING' ? 'warning' : 'neutral'}>{request.status}</Badge>{request.status === 'PENDING' && <Button size="sm" variant="ghost" loading={busy === request.id} onClick={() => run(request.id, () => financeOperationsApi.cancelInvoiceRequest(request.id), 'Đã hủy yêu cầu')}>Hủy yêu cầu</Button>}</div></Card>)}</div>}
  </section>;
}
