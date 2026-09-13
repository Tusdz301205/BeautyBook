import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, InlineNotice, SuccessState } from '../../components/ui';
import { PublicShell } from '../../components/layout/PublicShell';
import { useBookingStore } from '../../store/bookingStore';

export default function BookingSuccess() {
  const locationState = useLocation().state;
  const resetBooking = useBookingStore((state) => state.reset);
  const booking = locationState?.booking;
  const pending = booking?.status === 'PENDING';
  const holdMinutes = booking?.pendingExpiresAt
    ? Math.max(1, Math.ceil((new Date(booking.pendingExpiresAt).getTime() - Date.now()) / 60_000))
    : null;
  const title = pending ? 'Đã gửi yêu cầu đặt lịch' : 'Đặt lịch thành công';
  const message = pending
    ? 'Cơ sở sẽ xác nhận lịch của bạn. Lịch chưa được xem là đã xác nhận cho đến khi trạng thái thay đổi.'
    : 'Lịch hẹn của bạn đã được xác nhận.';

  useEffect(() => {
    resetBooking();
  }, [resetBooking]);

  return <PublicShell><Card className="mx-auto my-12 max-w-xl p-6">
    <SuccessState title={title} message={message} action={<div className="flex flex-wrap justify-center gap-2"><Link to="/customer/appointments" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--bb-brand)] px-4 text-sm font-semibold text-white">Xem lịch hẹn</Link><Link to="/book" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--bb-border)] px-4 text-sm font-semibold">Đặt lịch khác</Link></div>} />
    {pending && <InlineNotice tone="warning"><span>Khung giờ đang được giữ tạm{holdMinutes ? ` trong khoảng ${holdMinutes} phút` : ''}. Nếu hết hạn trước khi cơ sở xác nhận, slot sẽ được giải phóng.</span></InlineNotice>}
    {booking?.bookingCode && <p className="mt-4 text-center text-sm text-[var(--bb-muted)]">Mã lịch <strong className="bb-mono text-[var(--bb-ink)]">{booking.bookingCode}</strong></p>}
  </Card></PublicShell>;
}
