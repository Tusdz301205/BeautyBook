import type { BookingSource } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

/** Server-only context, passed separately from request DTOs after branch authorization. */
export interface BookingLeadContext {
  authorizedCounter: boolean;
  source?: BookingSource;
}

export function bookingLeadMilliseconds(
  onlineLeadHours: number,
  source: BookingSource = 'ONLINE_WEB',
  context?: BookingLeadContext,
): number {
  if (context?.authorizedCounter === true &&
      ['WALK_IN', 'PHONE', 'STAFF_CREATED'].includes(source)) return 0;
  return onlineLeadHours * 60 * 60 * 1000;
}

export function assertBookingAdvance(
  start: Date,
  policy: { minBookingLeadTimeHours: number; maxAdvanceBookingDays: number },
  source?: BookingSource,
  context?: BookingLeadContext,
  now = Date.now(),
): void {
  const advanceMs = start.getTime() - now;
  if (advanceMs <= 0) {
    throw new BadRequestException('Thời gian đặt lịch phải ở tương lai (sau hiện tại)');
  }
  if (advanceMs < bookingLeadMilliseconds(policy.minBookingLeadTimeHours, source, context)) {
    throw new BadRequestException(`Cần đặt trước ít nhất ${policy.minBookingLeadTimeHours} giờ.`);
  }
  if (advanceMs > policy.maxAdvanceBookingDays * 24 * 60 * 60 * 1000) {
    throw new BadRequestException(`Chỉ được đặt trước tối đa ${policy.maxAdvanceBookingDays} ngày.`);
  }
}
