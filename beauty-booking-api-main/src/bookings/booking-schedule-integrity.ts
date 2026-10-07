import { ConflictException } from '@nestjs/common';

/** Whole-booking moves must not rewrite execution or completed attribution. */
export function assertUnstartedBookingItems(items: readonly { status?: string }[]) {
  if (items.some(item => item.status !== 'SCHEDULED')) {
    throw new ConflictException('Đã có dịch vụ bắt đầu hoặc kết thúc; không thể dời lịch hoặc đổi toàn bộ chuyên viên. Xử lý từng dịch vụ chưa bắt đầu hoặc tạo lịch mới cho phần còn lại.');
  }
}
