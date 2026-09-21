import { BadRequestException } from '@nestjs/common';

// A product rule, not a tenant/platform setting. Rescheduling remains separate.
export const CUSTOMER_CANCELLATION_HOURS = 4;
export const CUSTOMER_CANCELLATION_MS = CUSTOMER_CANCELLATION_HOURS * 60 * 60 * 1000;

export function customerCancellationMode(start: Date, now: Date = new Date()) {
  const remaining = start.getTime() - now.getTime();
  if (!Number.isFinite(remaining)) {
    throw new BadRequestException('Thời gian lịch hẹn không hợp lệ');
  }
  if (remaining < 0) return 'too_late' as const;
  return remaining >= CUSTOMER_CANCELLATION_MS ? 'allowed' as const : 'warn_late_cancel' as const;
}

export function assertCustomerDirectCancellation(start: Date, now: Date = new Date()): void {
  const mode = customerCancellationMode(start, now);
  if (mode !== 'allowed') {
    throw new BadRequestException({
      code: mode === 'too_late' ? 'CANCELLATION_START_PASSED' : 'LATE_CANCELLATION_REQUEST_REQUIRED',
      message: mode === 'too_late'
        ? 'Lịch hẹn đã bắt đầu. Vui lòng liên hệ cơ sở để được hỗ trợ.'
        : 'Chỉ được tự hủy khi còn ít nhất 4 giờ. Vui lòng gửi yêu cầu hủy sát giờ để cơ sở xử lý.',
    });
  }
}
