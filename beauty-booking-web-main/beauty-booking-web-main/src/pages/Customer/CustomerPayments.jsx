import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarCheck, CreditCard, PackageCheck, ReceiptText, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { paymentsApi } from '../../api/apiClient';
import { Badge, Button, Card, EmptyState, ErrorState, MetricCard, Page, PageHeader, Select, Skeleton } from '../../components/ui';

const PAYMENT_STATUS = { PENDING: ['Chờ thanh toán', 'warning'], PAID: ['Đã thanh toán', 'success'], FAILED: ['Thất bại', 'danger'], REFUNDED: ['Đã hoàn tiền', 'info'], PARTIALLY_REFUNDED: ['Hoàn một phần', 'warning'] };
const REFUND_STATUS = { PENDING: ['Đang xem xét', 'warning'], APPROVED: ['Đã duyệt', 'info'], REJECTED: ['Bị từ chối', 'danger'], REFUNDED: ['Đã hoàn tiền', 'success'] };
const METHODS = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', MOMO: 'MoMo', VNPAY: 'VNPay', ZALOPAY: 'ZaloPay', CREDIT_CARD: 'Thẻ', MOCK_ONLINE: 'Thanh toán thử nghiệm' };
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;

export function CustomerPayments() {
  const [items, setItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [paymentItems, packageItems] = await Promise.all([
        paymentsApi.getAll(),
        paymentsApi.getPackagePurchases(),
      ]);
      setItems(paymentItems);
      setPackages(packageItems);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => filter === 'ALL' ? items : items.filter((item) => item.status === filter), [filter, items]);
  const totals = useMemo(() => ({ paid: items.filter((item) => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0), refunds: items.flatMap((item) => item.refundRequests || []).filter((item) => item.status === 'REFUNDED').reduce((sum, item) => sum + Number(item.amount || 0), 0) }), [items]);
  const payInstallment = async (installmentId) => {
    setBusy(installmentId);
    try {
      await paymentsApi.payPackageInstallment(installmentId, {
        method: 'BANK_TRANSFER',
        idempotencyKey: `CUSTOMER:PACKAGE:${installmentId}:${crypto.randomUUID()}`,
      });
      toast.success('Đã tạo giao dịch chuyển khoản chờ cơ sở xác minh.');
      await load();
    } catch (requestError) {
      toast.error(requestError.message || 'Không thể tạo giao dịch');
    } finally {
      setBusy('');
    }
  };
  return <Page className="max-w-6xl"><PageHeader eyebrow="Tài chính cá nhân" title="Thanh toán & hoàn tiền" description="Lịch sử giao dịch thuộc các lịch hẹn của bạn. Yêu cầu hoàn tiền do cơ sở hoặc bộ phận hỗ trợ khởi tạo theo chính sách." actions={<Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc trạng thái thanh toán" className="min-w-48"><option value="ALL">Tất cả giao dịch</option>{Object.entries(PAYMENT_STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</Select>} />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard icon={ReceiptText} label="Số giao dịch" value={items.length} /><MetricCard icon={Banknote} label="Tổng ghi nhận" value={money(totals.paid)} tone="success" /><MetricCard icon={RotateCcw} label="Đã hoàn" value={money(totals.refunds)} tone="info" /></div>
    {!loading && packages.length > 0 && <section className="space-y-3" aria-labelledby="package-purchases-title">
      <div><h2 id="package-purchases-title" className="text-xl font-bold">Gói liệu trình của tôi</h2><p className="mt-1 text-sm text-[var(--bb-muted)]">Theo dõi kỳ thanh toán và số buổi còn lại. Chuyển khoản chỉ có hiệu lực sau khi cơ sở xác minh.</p></div>
      {packages.map((purchase) => {
        const redeemed = (purchase.entitlements || []).filter((item) => item.status === 'REDEEMED').length;
        const due = (purchase.installments || []).find((item) => ['DUE', 'FAILED'].includes(item.status));
        return <Card key={purchase.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]"><PackageCheck size={20} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{purchase.package?.name || 'Gói liệu trình'}</h3><Badge tone={purchase.status === 'ACTIVE' ? 'success' : purchase.status === 'COMPLETED' ? 'info' : 'warning'}>{purchase.status}</Badge></div><p className="mt-2 text-sm text-[var(--bb-muted)]">Đã dùng {redeemed}/{purchase.package?.sessionCount || purchase.entitlements?.length || 0} buổi · Đã trả {money(purchase.paidAmount)} / {money(purchase.totalAmount)}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">Hiệu lực đến {new Date(purchase.expiresAt).toLocaleDateString('vi-VN')}</p></div>{due && <Button loading={busy === due.id} onClick={() => payInstallment(due.id)}>Chuyển khoản kỳ {due.sequence} · {money(due.amount)}</Button>}</div>{(purchase.installments || []).some((item) => item.status === 'PENDING') && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">Có kỳ thanh toán đang chờ cơ sở đối chiếu. Số tiền chưa được cộng vào gói.</p>}</Card>;
      })}
    </section>}
    {loading ? <Skeleton rows={5} /> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !visible.length ? <Card><EmptyState icon={CreditCard} title="Chưa có giao dịch" description="Thanh toán được cơ sở ghi nhận sẽ xuất hiện tại đây." /></Card> : <div className="space-y-3">{visible.map((payment) => { const [label, tone] = PAYMENT_STATUS[payment.status] || [payment.status, 'neutral']; return <Card as="article" key={payment.id} className="overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bb-surface-subtle)] text-[var(--bb-brand-strong)]"><CreditCard size={20} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{money(payment.amount)}</h2><Badge tone={tone}>{label}</Badge></div><p className="mt-1 text-xs text-[var(--bb-muted)]">{payment.booking?.branch?.name || 'Cơ sở làm đẹp'} · {METHODS[payment.method] || payment.method} · {new Date(payment.paidAt || payment.createdAt).toLocaleString('vi-VN')}</p>{payment.transactionRef && <p className="mt-1 text-xs text-[var(--bb-muted)]">Mã giao dịch <span className="bb-mono">{payment.transactionRef}</span></p>}</div>{payment.bookingId && <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--bb-brand-strong)] hover:bg-[var(--bb-brand-soft)]" to={`/customer/appointments/${payment.bookingId}`}><CalendarCheck size={16} />Xem lịch hẹn</Link>}</div>{payment.refundRequests?.length > 0 && <div className="border-t border-[var(--bb-border)] bg-[var(--bb-surface-subtle)] px-5 py-4"><h3 className="text-xs font-bold uppercase tracking-wider text-[var(--bb-muted)]">Tiến trình hoàn tiền</h3><div className="mt-3 space-y-3">{payment.refundRequests.map((refund) => { const [refundLabel, refundTone] = REFUND_STATUS[refund.status] || [refund.status, 'neutral']; return <div key={refund.id} className="flex flex-col justify-between gap-2 border-l-2 border-[var(--bb-border-strong)] pl-3 sm:flex-row"><div><p className="text-sm font-semibold">{money(refund.amount)} · {refund.reason}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">Tạo lúc {new Date(refund.createdAt).toLocaleString('vi-VN')}{refund.reviewNote ? ` · ${refund.reviewNote}` : ''}</p></div><Badge tone={refundTone}>{refundLabel}</Badge></div>; })}</div></div>}</Card>; })}</div>}
  </Page>;
}

export default CustomerPayments;
