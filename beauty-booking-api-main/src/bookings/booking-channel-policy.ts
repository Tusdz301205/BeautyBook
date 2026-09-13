import { BadRequestException, ConflictException } from '@nestjs/common';
import type { BookingSource } from '@prisma/client';

export function resolveBookingSource(
  customerOnly: boolean,
  requested: BookingSource | undefined,
  hasGuestName: boolean,
): BookingSource {
  if (customerOnly) return 'ONLINE_WEB';
  if (requested && !['WALK_IN', 'PHONE', 'STAFF_CREATED'].includes(requested)) {
    throw new BadRequestException('Chọn nguồn đặt lịch tại quầy, qua điện thoại hoặc do nhân viên tạo');
  }
  return requested ?? (hasGuestName ? 'WALK_IN' : 'STAFF_CREATED');
}

export function assertBookingChannelAllowed(
  source: BookingSource,
  policy: { allowWalkIn?: boolean; allowCounterBooking?: boolean } | null | undefined,
): void {
  if (source === 'WALK_IN' && policy?.allowWalkIn === false) {
    throw new ConflictException('Chi nhánh hiện không nhận khách vãng lai');
  }
  if (['PHONE', 'STAFF_CREATED', 'ADMIN_CREATED'].includes(source) && policy?.allowCounterBooking === false) {
    throw new ConflictException('Chi nhánh hiện không cho phép đặt lịch tại quầy');
  }
}
