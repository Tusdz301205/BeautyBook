import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Clock3, Coins, TicketPercent, UserRound } from 'lucide-react';
import { bookingsApi, loyaltyApi, recurringApi, servicesApi } from '../../api/apiClient';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { Button, Card, Field, InlineNotice, Input, Skeleton } from '../../components/ui';
import { BookingLayout } from '../../components/customer/BookingLayout';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { BookingPolicyNotice } from '../../components/customer/BookingPolicyNotice';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;

export default function BookingConfirm() {
  const navigate = useNavigate();
  const state = useBookingStore();
  const user = useAuthStore((store) => store.user);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [acknowledged, setAcknowledged] = useState(false);
  const policyResource = useAsyncResource(user && state.branchId ? JSON.stringify([user.id, state.branchId]) : null,
    () => bookingsApi.selfBookingPolicy(state.branchId));
  const policy = policyResource.data;
  useEffect(() => { setAcknowledged(false); }, [user?.id, state.branchId, policy]);

  useEffect(() => {
    if (!state.branchId || !state.serviceIds.length || !state.slot) { navigate('/book', { replace: true }); return; }
  }, [state.branchId, state.serviceIds, state.slot, navigate]);

  const serviceKey = state.branchId && state.serviceIds.length ? JSON.stringify([state.branchId, state.serviceIds]) : null;
  const serviceResource = useAsyncResource(serviceKey, async () => {
    const result = await servicesApi.getAll(state.branchId);
    const selected = (result.data ?? result ?? []).filter((item) => state.serviceIds.includes(item.id));
    if (selected.length !== state.serviceIds.length) throw new Error('Một số dịch vụ không còn khả dụng. Vui lòng chọn lại dịch vụ.');
    return selected;
  });
  const services = serviceResource.data || [];
  const loading = serviceResource.loading;

  const variantByService = useMemo(() => new Map(services.map((service) => [
    service.id,
    service.variants?.find((variant) => variant.id === state.variantSelections[service.id]) || null,
  ])), [services, state.variantSelections]);
  const subtotal = state.combo ? Number(state.combo.comboPrice) : services.reduce((sum, service) => sum + Number(variantByService.get(service.id)?.price ?? service.price ?? 0), 0);
  const businessId = services[0]?.branch?.businessId;
  const { data: loyaltyAccount } = useAsyncResource(user && businessId ? JSON.stringify([user.id, businessId]) : null, async () => {
    const rows = await loyaltyApi.mine();
    return (rows || []).find((row) => row.businessId === businessId) || null;
  });

  const pricePayload = {
      branchId: state.branchId,
      serviceIds: state.serviceIds,
      comboId: state.comboId,
      voucherCode: !state.recurring.enabled && state.voucherCode ? state.voucherCode : undefined,
      variantSelections: state.variantSelections,
      loyaltyPoints: state.recurring.enabled ? 0 : state.loyaltyPoints,
      appointmentDate: state.slot?.start,
  };
  const priceResource = useAsyncResource(services.length && state.slot ? JSON.stringify([user?.id, pricePayload]) : null, () => bookingsApi.previewPrice(pricePayload));
  const preview = priceResource.data;

  const recurringPayload = state.slot ? {
    branchId: state.branchId,
    serviceIds: state.serviceIds,
    comboId: state.comboId || undefined,
    staffId: state.staffId || undefined,
    staffMode: state.recurring.staffMode,
    frequency: state.recurring.frequency,
    startDate: state.date,
    preferredTime: format(new Date(state.slot.start), 'HH:mm'),
    occurrenceCount: state.recurring.occurrenceCount,
  } : null;
  const recurringResource = useAsyncResource(user && state.recurring.enabled && recurringPayload && !Object.keys(state.variantSelections).length
    ? JSON.stringify([user.id, recurringPayload]) : null, () => recurringApi.preview(recurringPayload));
  const recurringPreview = recurringResource.data;
  const previewingRecurring = recurringResource.loading;
  const recurringReady = !state.recurring.enabled || (recurringPreview?.availableCount > 0 && (state.recurring.skipConflicts || !recurringPreview.conflictCount));
  const canConfirm = Boolean(user && preview && !loading && !priceResource.loading && !previewingRecurring && recurringReady
    && policy && !policyResource.loading && !policyResource.error && policy.selfBookingAllowed
    && (!policy.acknowledgmentRequired || acknowledged));

  const confirm = async () => {
    if (submittingRef.current || !canConfirm) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      let booking; let plan;
      if (state.recurring.enabled) {
        if (Object.keys(state.variantSelections).length) throw new Error('Lịch lặp với biến thể dịch vụ chưa được hỗ trợ. Hãy tắt lịch lặp.');
        plan = await recurringApi.create({ ...recurringPayload, skipConflicts: state.recurring.skipConflicts, note: state.customerInfo.note, violationAcknowledged: acknowledged });
        booking = plan.bookings?.[0];
      } else {
        booking = await bookingsApi.create({
          branchId: state.branchId,
          serviceIds: state.serviceIds,
          variantSelections: state.variantSelections,
          comboId: state.comboId || undefined,
          appointmentDate: state.slot.start,
          note: state.customerInfo.note,
          staffId: state.staffId,
          voucherCode: state.voucherCode || undefined,
          loyaltyPoints: state.loyaltyPoints,
          source: 'ONLINE_WEB',
          violationAcknowledged: acknowledged,
        }, idempotencyKey.current);
      }
      toast.success(plan ? `Đã tạo chuỗi ${plan.bookings?.length || 0} lịch hẹn` : booking.status === 'PENDING' ? 'Đã gửi yêu cầu đặt lịch' : 'Đặt lịch thành công');
      navigate('/book/success', { state: { booking, plan } });
    } catch (error) {
      if (['SELF_BOOKING_RESTRICTED', 'BOOKING_WARNING_ACK_REQUIRED'].includes(error.details?.code)) {
        setAcknowledged(false);
        idempotencyKey.current = crypto.randomUUID();
        policyResource.reload();
        toast.error(error.message);
      } else if (error.status === 409 || /trùng|conflict|already|khung giờ/i.test(error.message)) {
        toast.error('Một hoặc nhiều khung giờ vừa có người đặt. Vui lòng kiểm tra lại.');
        navigate('/book/time');
      } else toast.error(error.message || 'Đặt lịch thất bại');
    } finally { submittingRef.current = false; setSubmitting(false); }
  };

  const total = preview?.finalAmount ?? subtotal;
  const summary = <Card className="sticky top-24 p-5"><h2 className="text-sm font-bold">Tóm tắt giá dịch vụ</h2><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--bb-muted)]">{state.recurring.enabled ? 'Tạm tính mỗi kỳ' : 'Tạm tính'}</span><span>{money(preview?.subtotal ?? subtotal)}</span></div>{preview?.promotionDiscount > 0 && <div className="flex justify-between text-[var(--bb-success)]"><span>Khuyến mãi tự động</span><span>-{money(preview.promotionDiscount)}</span></div>}{preview?.voucherApplied && <div className="flex justify-between text-[var(--bb-success)]"><span>Voucher {preview.code}</span><span>-{money(preview.voucherDiscount)}</span></div>}{preview?.loyaltyDiscount > 0 && <div className="flex justify-between text-[var(--bb-success)]"><span>{preview.loyaltyPoints} điểm</span><span>-{money(preview.loyaltyDiscount)}</span></div>}<div className="flex justify-between border-t border-[var(--bb-border)] pt-3 text-base font-bold"><span>{state.recurring.enabled ? 'Kỳ đầu tiên' : 'Tổng cộng'}</span><span className="text-[var(--bb-brand-strong)]">{priceResource.loading ? 'Đang tính giá…' : preview ? money(total) : 'Chưa có giá xác nhận'}</span></div></div>{state.recurring.enabled && <p className="mt-3 text-xs text-[var(--bb-muted)]">Giá từng kỳ được xác định khi tạo chuỗi lịch. Voucher và điểm không áp dụng cho chuỗi lịch.</p>}{(serviceResource.error || priceResource.error || recurringResource.error) && <div className="mt-4"><InlineNotice tone="danger">{(serviceResource.error || priceResource.error || recurringResource.error).message}</InlineNotice><Button variant="secondary" className="mt-2 w-full" onClick={() => { serviceResource.reload(); priceResource.reload(); recurringResource.reload(); }}>Thử lại</Button></div>}<Button loading={submitting || priceResource.loading || previewingRecurring} disabled={!canConfirm} onClick={confirm} className="mt-5 w-full">{state.recurring.enabled ? 'Xác nhận chuỗi lịch' : 'Xác nhận đặt lịch'}</Button></Card>;

  return <BookingLayout step={5} title="Kiểm tra và xác nhận" aside={summary}>
    {policyResource.loading && <p role="status">Đang kiểm tra chính sách đặt lịch…</p>}
    {policyResource.error && <InlineNotice tone="danger">Không thể kiểm tra chính sách đặt lịch. <Button variant="secondary" onClick={policyResource.reload}>Thử lại</Button></InlineNotice>}
    <BookingPolicyNotice policy={policy} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
    {loading ? <Skeleton rows={6} /> : <div className="space-y-6"><section><h2 className="text-sm font-bold">{state.combo ? `Combo ${state.combo.name}` : 'Dịch vụ đã chọn'}</h2><div className="mt-3 divide-y divide-[var(--bb-border)] rounded-xl border border-[var(--bb-border)]">{services.map((service) => { const variant = variantByService.get(service.id); return <div key={service.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-semibold">{service.name}</p>{variant && <p className="mt-1 text-xs font-semibold text-[var(--bb-brand-strong)]">{variant.name}</p>}<p className="mt-1 text-xs text-[var(--bb-muted)]">{variant?.durationMinutes || service.durationMinutes || 0} phút{variant ? ` · buffer ${variant.bufferBeforeMinutes || 0}/${variant.bufferAfterMinutes || 0} phút` : ''}</p></div>{!state.combo && <p className="font-bold">{variant?.priceDisplay || money(service.price)}</p>}</div>; })}</div></section>
      {loyaltyAccount && !state.recurring.enabled && <Card className="p-4"><div className="flex items-center gap-2 font-bold"><Coins size={18} />Dùng điểm tích lũy</div><p className="mt-1 text-xs text-[var(--bb-muted)]">Khả dụng tại doanh nghiệp này: {loyaltyAccount.balance} điểm. Hệ thống tự giới hạn theo số tiền còn phải trả.</p><Field className="mt-3" label="Số điểm muốn dùng"><Input type="number" min="0" max={loyaltyAccount.balance} value={state.loyaltyPoints} onChange={(event) => state.setLoyaltyPoints(Math.min(loyaltyAccount.balance, Number(event.target.value) || 0))} /></Field></Card>}
      <div className="grid gap-3 sm:grid-cols-2"><Card className="p-4"><Clock3 size={18} className="text-[var(--bb-brand-strong)]" /><p className="mt-3 text-xs font-semibold text-[var(--bb-muted)]">Thời gian</p><p className="mt-1 text-sm font-bold">{state.slot && format(new Date(state.slot.start), 'dd/MM/yyyy · HH:mm')}</p></Card><Card className="p-4"><UserRound size={18} className="text-[var(--bb-brand-strong)]" /><p className="mt-3 text-xs font-semibold text-[var(--bb-muted)]">Người đặt</p><p className="mt-1 text-sm font-bold">{state.customerInfo.fullName}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{state.customerInfo.phone}</p></Card></div>
      {state.recurring.enabled && Object.keys(state.variantSelections).length > 0 && <InlineNotice tone="warning">Hãy tắt lịch lặp: biến thể cần được snapshot và xác nhận riêng cho từng kỳ.</InlineNotice>}
      {state.recurring.enabled && Object.keys(state.variantSelections).length === 0 && <InlineNotice tone={recurringPreview?.conflictCount ? 'warning' : 'success'}>{previewingRecurring ? 'Đang kiểm tra toàn bộ chuỗi lịch…' : recurringPreview ? `${recurringPreview.availableCount} kỳ còn chỗ${recurringPreview.conflictCount ? `, ${recurringPreview.conflictCount} kỳ xung đột sẽ ${state.recurring.skipConflicts ? 'được bỏ qua' : 'cần xử lý'}.` : '.'}` : 'Chưa có kết quả kiểm tra chuỗi lịch.'}</InlineNotice>}
      {state.voucherCode && !state.recurring.enabled && <InlineNotice tone={preview?.voucherApplied ? 'success' : 'warning'}><span className="flex items-center gap-2"><TicketPercent size={16} />{preview?.voucherApplied ? `Mã ${state.voucherCode} đã áp dụng.` : preview?.explanations?.join(' · ') || `Mã ${state.voucherCode} không đủ điều kiện.`}</span></InlineNotice>}
      <div className="border-t border-[var(--bb-border)] pt-5"><Button variant="secondary" disabled={submitting} onClick={() => navigate('/book/info')}>Quay lại chỉnh sửa</Button></div>
    </div>}
  </BookingLayout>;
}
