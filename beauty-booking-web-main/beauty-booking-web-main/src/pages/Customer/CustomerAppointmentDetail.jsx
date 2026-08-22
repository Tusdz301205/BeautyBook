import React, { useEffect, useMemo, useState } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarPlus,
  Clock3,
  CreditCard,
  ExternalLink,
  MapPin,
  Phone,
  Scissors,
  Star,
  UserRound,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingsApi, paymentsApi, platformPolicyApi } from '../../api/apiClient';
import { RescheduleModal } from '../../components/customer/RescheduleModal';
import { ReviewModal } from '../../components/customer/ReviewModal';
import { Badge, Button, Card, Dialog, ErrorState, Field, InlineNotice, Input, Page, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { useBookingStore } from '../../store/bookingStore';

const LABELS = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã đến', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến', REJECTED: 'Đã từ chối', EXPIRED: 'Hết hạn giữ chỗ' };
const TONES = { PENDING: 'warning', CONFIRMED: 'info', CHECKED_IN: 'info', IN_PROGRESS: 'brand', COMPLETED: 'success', CANCELLED: 'danger', NO_SHOW: 'neutral', REJECTED: 'danger', EXPIRED: 'neutral' };
const PAYMENT = { PENDING: ['Chờ thanh toán', 'warning'], PAID: ['Đã thanh toán', 'success'], FAILED: ['Thanh toán thất bại', 'danger'], REFUNDED: ['Đã hoàn tiền', 'info'], PARTIALLY_REFUNDED: ['Hoàn một phần', 'warning'] };
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;

export function CustomerAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const setBranch = useBookingStore((state) => state.setBranch);
  const toggleService = useBookingStore((state) => state.toggleService);
  const [booking, setBooking] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [policy, setPolicy] = useState({ allowRescheduleRequests: true });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [result, currentPolicy] = await Promise.all([
        bookingsApi.getById(id),
        platformPolicyApi.getPublic(),
      ]);
      setBooking(result);
      setPolicy(currentPolicy);
      try {
        const checkoutResult = await paymentsApi.getCheckout(id);
        setCheckout(checkoutResult);
        const minimumDue = Math.max(
          0,
          Number(checkoutResult.policy?.requiredAmount || 0) -
            Number(checkoutResult.summary?.paidAmount || 0),
        );
        setPayAmount(String(minimumDue || checkoutResult.summary?.amountDue || ''));
        setCheckoutError('');
      } catch (paymentError) {
        setCheckout(null);
        setCheckoutError(paymentError.message || 'Không thể tải thông tin thanh toán');
      }
    }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);

  const start = booking?.appointmentStartTime ? parseISO(booking.appointmentStartTime) : null;
  const end = booking?.appointmentEndTime ? parseISO(booking.appointmentEndTime) : null;
  const duration = start && end ? Math.max(0, differenceInMinutes(end, start)) : (booking?.bookingServices || []).reduce((sum, item) => sum + Number(item.service?.durationMinutes || 0), 0);
  const upcoming = start ? start.getTime() > Date.now() : false;
  const canChange = upcoming && ['PENDING', 'CONFIRMED'].includes(booking?.status);
  const services = booking?.bookingServices || [];
  const directionsUrl = booking?.branch?.addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.branch.addressLine)}` : '';
  const chronologicalHistory = useMemo(() => [...(booking?.statusHistory || [])].reverse(), [booking]);
  const rebook = () => {
    const serviceIds = services.map((item) => item.service?.id || item.serviceId).filter(Boolean);
    if (!booking?.branchId || !serviceIds.length) return;
    setBranch(booking.branchId);
    serviceIds.forEach((serviceId) => toggleService(serviceId));
    navigate('/book/staff');
  };
  const cancel = async () => {
    if (!cancelReason.trim()) return;
    setBusy(true);
    try { await bookingsApi.updateStatus(booking.id, 'CANCELLED', undefined, cancelReason.trim()); toast.success('Đã hủy lịch'); setCancelOpen(false); await load(); }
    catch (requestError) { toast.error(requestError.message || 'Không thể hủy lịch'); }
    finally { setBusy(false); }
  };
  const createBankTransfer = async () => {
    const amount = Number(payAmount);
    if (!checkout || amount <= 0 || amount > Number(checkout.summary?.amountDue || 0)) return;
    setPaymentBusy(true);
    try {
      const result = await paymentsApi.createIntent({
        bookingId: booking.id,
        method: 'BANK_TRANSFER',
        amount,
        idempotencyKey: `CUSTOMER:${booking.id}:BANK:${crypto.randomUUID()}`,
      });
      setCheckout(result);
      toast.success('Đã tạo giao dịch chờ xác minh. Khoản tiền chưa được ghi nhận vào lịch hẹn.');
    } catch (requestError) {
      toast.error(requestError.message || 'Không thể tạo giao dịch chuyển khoản');
    } finally {
      setPaymentBusy(false);
    }
  };

  if (loading) return <Page className="max-w-6xl"><Skeleton rows={8} /></Page>;
  if (error || !booking) return <Page className="max-w-4xl"><Link to="/customer/appointments" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--bb-brand-strong)]"><ArrowLeft size={16} />Quay lại lịch hẹn</Link><Card><ErrorState message={error || 'Không tìm thấy lịch hẹn'} onRetry={load} /></Card></Page>;
  const payment = booking.payments?.[0];
  const [paymentLabel, paymentTone] = PAYMENT[payment?.status] || ['Chưa ghi nhận', 'neutral'];

  return <Page className="max-w-6xl">
    <Link to="/customer/appointments" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--bb-brand-strong)] hover:underline"><ArrowLeft size={16} />Lịch hẹn của tôi</Link>
    <PageHeader eyebrow={`Mã lịch ${booking.bookingCode || '—'}`} title={booking.branch?.business?.name || booking.branch?.name || 'Chi tiết lịch hẹn'} description="Thông tin dưới đây được lấy trực tiếp từ hồ sơ lịch hẹn của bạn." actions={<Badge tone={TONES[booking.status] || 'neutral'}>{LABELS[booking.status] || booking.status}</Badge>} />

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <div className="space-y-5">
        <Card className="overflow-hidden"><div className="grid gap-4 p-5 sm:grid-cols-2"><Info icon={Clock3} label="Thời gian" value={start ? `${format(start, 'dd/MM/yyyy · HH:mm')}${end ? ` – ${format(end, 'HH:mm')}` : ''}` : 'Chưa cập nhật'} note={duration ? `${duration} phút` : undefined} /><Info icon={MapPin} label="Địa điểm" value={booking.branch?.name || 'Cơ sở làm đẹp'} note={booking.branch?.addressLine} /></div><div className="flex flex-wrap gap-2 border-t border-[var(--bb-border)] p-4">{booking.branch?.phone && <a href={`tel:${booking.branch.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--bb-border)] px-3 text-sm font-semibold hover:bg-[var(--bb-surface-subtle)]"><Phone size={16} />Gọi cơ sở</a>}{directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--bb-border)] px-3 text-sm font-semibold hover:bg-[var(--bb-surface-subtle)]"><ExternalLink size={16} />Chỉ đường</a>}</div></Card>

        <Card className="overflow-hidden"><header className="border-b border-[var(--bb-border)] p-5"><h2 className="font-bold">Dịch vụ & nhân viên</h2></header><div className="divide-y divide-[var(--bb-border)]">{services.map((item) => <article key={item.id} className="flex items-start gap-3 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]"><Scissors size={18} /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{item.service?.name || 'Dịch vụ'}</h3><p className="mt-1 flex items-center gap-1 text-xs text-[var(--bb-muted)]"><UserRound size={13} />{item.staff?.user?.fullName || item.staff?.fullName || 'Cơ sở sẽ sắp xếp nhân viên'}</p></div><div className="text-right"><p className="font-semibold">{money(item.priceAtBooking)}</p>{item.service?.durationMinutes && <p className="mt-1 text-xs text-[var(--bb-muted)]">{item.service.durationMinutes} phút</p>}</div></article>)}</div><footer className="flex justify-between gap-4 border-t border-[var(--bb-border)] bg-[var(--bb-surface-subtle)] p-5"><span className="font-semibold">Tổng thanh toán</span><strong className="text-lg">{money(booking.finalAmount ?? booking.totalAmount)}</strong></footer></Card>

        {chronologicalHistory.length > 0 && <Card className="p-5"><h2 className="font-bold">Tiến trình lịch hẹn</h2><ol className="mt-5 space-y-4">{chronologicalHistory.map((item, index) => <li key={item.id} className="relative grid grid-cols-[1rem_1fr] gap-3"><span className="relative mt-1.5 h-3 w-3 rounded-full bg-[var(--bb-brand)] before:absolute before:left-[5px] before:top-3 before:h-[calc(100%+1rem)] before:w-px before:bg-[var(--bb-border)] last:before:hidden" /><div><p className="text-sm font-semibold">{LABELS[item.status] || item.status}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{new Date(item.createdAt).toLocaleString('vi-VN')}{item.note ? ` · ${item.note}` : ''}</p></div></li>)}</ol></Card>}
      </div>

      <aside className="space-y-5">
        <Card className="p-5">
          <h2 className="font-bold">Thanh toán</h2>
          {checkout ? <>
            <dl className="mt-4 space-y-2 text-sm">
              <PaymentRow label="Tổng tiền" value={money(checkout.summary?.totalAmount)} />
              <PaymentRow label="Đã xác minh" value={money(checkout.summary?.paidAmount)} />
              <PaymentRow label="Còn phải trả" value={money(checkout.summary?.amountDue)} strong />
            </dl>
            {Number(checkout.policy?.requiredAmount || 0) > 0 && <p className="mt-3 rounded-lg bg-[var(--bb-surface-subtle)] p-3 text-xs text-[var(--bb-muted)]">Yêu cầu trả trước theo chính sách: {money(checkout.policy.requiredAmount)}. Chính sách đã được chụp tại thời điểm đặt lịch.</p>}
            {Number(checkout.summary?.amountDue || 0) > 0 && !['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status) && <div className="mt-4 grid gap-3">
              <Field label="Số tiền chuyển khoản" hint={checkout.policy?.allowSplitPayment ? 'Có thể thanh toán từng phần.' : 'Chính sách yêu cầu thanh toán một lần.'}>
                <Input type="number" min="1" max={checkout.summary.amountDue} value={payAmount} onChange={(event) => setPayAmount(event.target.value)} />
              </Field>
              <Button loading={paymentBusy} disabled={!Number(payAmount) || Number(payAmount) > Number(checkout.summary.amountDue)} onClick={createBankTransfer}>Tạo giao dịch chuyển khoản</Button>
              <p className="text-xs leading-5 text-[var(--bb-muted)]">Giao dịch chỉ được ghi nhận vào lịch hẹn sau khi cơ sở đối chiếu chứng từ và xác minh.</p>
            </div>}
            {(checkout.transactions || []).filter((item) => item.status === 'PENDING').map((item) => <div key={item.id} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs"><b>Đang chờ xác minh:</b> {money(item.amount)} · <span className="bb-mono">{item.transactionRef || item.id}</span></div>)}
          </> : <div className="mt-4">
            <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><CreditCard size={17} />{payment ? money(payment.amount) : money(booking.finalAmount ?? booking.totalAmount)}</span><Badge tone={paymentTone}>{paymentLabel}</Badge></div>
            {checkoutError && <p className="mt-3 text-xs text-[var(--bb-danger)]">{checkoutError}</p>}
          </div>}
          <Link to="/customer/payments" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--bb-brand-strong)] hover:underline">Xem lịch sử thanh toán</Link>
        </Card>
        <Card className="p-5"><h2 className="font-bold">Thao tác</h2><div className="mt-4 grid gap-2">{canChange && policy.allowRescheduleRequests && <Button variant="secondary" className="w-full" onClick={() => setRescheduleOpen(true)}><ArrowRightLeft size={16} />Yêu cầu đổi lịch</Button>}{canChange && <Button variant="secondary" className="w-full text-[var(--bb-danger)]" onClick={() => { setCancelReason(''); setCancelOpen(true); }}><XCircle size={16} />Hủy lịch</Button>}{booking.status === 'COMPLETED' && !booking.review && <Button className="w-full" onClick={() => setReviewOpen(true)}><Star size={16} />Viết đánh giá</Button>}{services.length > 0 && <Button variant="secondary" className="w-full" onClick={rebook}><CalendarPlus size={16} />Đặt lại dịch vụ này</Button>}</div></Card>
        {booking.note && <InlineNotice tone="info"><b>Ghi chú của bạn:</b> {booking.note}</InlineNotice>}
        {booking.cancelReason && <InlineNotice tone="danger"><b>Lý do hủy:</b> {booking.cancelReason}</InlineNotice>}
      </aside>
    </div>

    {rescheduleOpen && <RescheduleModal booking={booking} onClose={() => setRescheduleOpen(false)} onSuccess={() => { setRescheduleOpen(false); void load(); }} />}
    {reviewOpen && <ReviewModal booking={booking} policy={policy} onClose={() => setReviewOpen(false)} onSuccess={() => { setReviewOpen(false); void load(); }} />}
    <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Hủy lịch hẹn" description={`Mã lịch ${booking.bookingCode || '—'}. Lý do sẽ được gửi cho cơ sở.`} footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)}>Giữ lịch</Button><Button variant="danger" loading={busy} disabled={!cancelReason.trim()} onClick={cancel}>Xác nhận hủy</Button></>}><Field label="Lý do hủy" required><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Cho cơ sở biết lý do bạn không thể đến" /></Field></Dialog>
  </Page>;
}

function Info({ icon: Icon, label, value, note }) {
  return <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--bb-surface-subtle)] text-[var(--bb-brand-strong)]"><Icon size={18} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--bb-muted)]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p>{note && <p className="mt-1 text-xs leading-5 text-[var(--bb-muted)]">{note}</p>}</div></div>;
}

function PaymentRow({ label, value, strong = false }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-[var(--bb-muted)]">{label}</dt><dd className={strong ? 'font-bold' : 'font-semibold'}>{value}</dd></div>;
}

export default CustomerAppointmentDetail;
