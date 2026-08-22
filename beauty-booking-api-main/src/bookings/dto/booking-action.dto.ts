import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * API Rule 7 — Booking Action Router.
 * PUT /bookings/:id nhận payload `action` và rẽ nhánh xử lý.
 * Mỗi action đi vào MỘT service function riêng (Rule 14 — không gộp).
 */
export enum BookingAction {
  CONFIRM = 'confirm',
  REJECT = 'reject',
  RESCHEDULE = 'reschedule',
  AUTO_ACCEPT = 'auto_accept',
}

export class BookingActionDto {
  @IsEnum(BookingAction, {
    message: 'action phải là confirm | reject | reschedule | auto_accept',
  })
  action!: BookingAction;

  /** Lý do (bắt buộc nghiệp vụ khi reject). */
  @IsOptional()
  @IsString()
  reason?: string;

  /** reschedule: giờ mới — ISO 8601 (Rule 14: cấm chuỗi thời gian tự do). */
  @IsOptional()
  @IsDateString({}, { message: 'newStartTime phải là ISO 8601' })
  newStartTime?: string;

  @IsOptional()
  @IsDateString({}, { message: 'newEndTime phải là ISO 8601' })
  newEndTime?: string;

  /** reschedule: đổi nhân viên (tuỳ chọn). */
  @IsOptional()
  @IsUUID('4', { message: 'newStaffId không hợp lệ' })
  newStaffId?: string;
}
