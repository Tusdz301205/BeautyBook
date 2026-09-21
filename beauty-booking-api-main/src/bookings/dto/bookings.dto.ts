import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
  Matches,
  MaxLength,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * VI label <-> BookingStatus enum mapping used across UI/API.
 * Source of truth for both client and server.
 */
export const BOOKING_STATUS_VI = {
  PENDING: 'Mới',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  NO_SHOW: 'No-show',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Đã hết hạn',
} as const;

export type BookingStatusEnum =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'REJECTED'
  | 'EXPIRED';

export class CreateBookingDto {
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  violationAcknowledged?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'customerId không hợp lệ' })
  customerId?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsUUID('4', { message: 'branchId không hợp lệ' })
  branchId!: string;

  @ValidateIf((value) => !value.comboId)
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 dịch vụ' })
  @ArrayMaxSize(20, { message: 'Không được đặt quá 20 dịch vụ cùng lúc' })
  @IsUUID('4', { each: true, message: 'serviceId không hợp lệ' })
  serviceIds?: string[];

  @IsOptional()
  @IsObject()
  variantSelections?: Record<string, string>;

  @IsOptional()
  @IsUUID('4', { message: 'comboId không hợp lệ' })
  comboId?: string;

  @IsDateString({}, { message: 'appointmentDate phải là ISO date string' })
  appointmentDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(0)
  note?: string;

  @IsOptional()
  @IsUUID('4', { message: 'createdBy không hợp lệ' })
  createdBy?: string;

  @IsOptional()
  @IsUUID('4', { message: 'staffId không hợp lệ' })
  staffId?: string;

  @IsOptional()
  @IsString()
  voucherCode?: string;

  @IsOptional()
  loyaltyPoints?: number;

  @IsOptional()
  @IsBoolean()
  controlledOverbooking?: boolean;

  @ValidateIf((value) => value.controlledOverbooking === true)
  @IsString()
  @MinLength(10, { message: 'Lý do overbooking phải có ít nhất 10 ký tự' })
  @MaxLength(500)
  overbookingReason?: string;

  @IsOptional()
  @IsEnum(['ONLINE_WEB', 'ONLINE_APP', 'WALK_IN', 'PHONE', 'STAFF_CREATED', 'ADMIN_CREATED'])
  source?: 'ONLINE_WEB' | 'ONLINE_APP' | 'WALK_IN' | 'PHONE' | 'STAFF_CREATED' | 'ADMIN_CREATED';
}

export class UpdateStatusDto {
  @IsEnum(
    ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'],
    { message: 'status không hợp lệ' },
  )
  status!: BookingStatusEnum;

  // Required by the service for NO_SHOW; never inferred from an absent request.
  @IsOptional()
  @IsBoolean()
  noShowConfirmed?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  // CUSTOMER (khách tự huỷ) | SALON (salon xác nhận/huỷ) | ADMIN (ép buộc)
  @IsOptional()
  @IsEnum(['CUSTOMER', 'SALON', 'ADMIN', 'SYSTEM'])
  changedByType?: 'CUSTOMER' | 'SALON' | 'ADMIN' | 'SYSTEM';
}

export class MoveBookingDto {
  @IsDateString({}, { message: 'newStartTime phải là ISO date string' })
  newStartTime!: string;

  @IsDateString({}, { message: 'newEndTime phải là ISO date string' })
  newEndTime!: string;

  @IsUUID('4', { message: 'newStaffId không hợp lệ' })
  newStaffId!: string;
}

export class ResizeBookingDto {
  @IsDateString({}, { message: 'newEndTime phải là ISO date string' })
  newEndTime!: string;
}

export class AssignStaffDto {
  @IsUUID('4', { message: 'staffId không hợp lệ' })
  staffId!: string;
}

export class SchedulerQueryDto {
  @IsUUID('4', { message: 'branchId không hợp lệ' })
  branchId!: string;

  @IsDateString({}, { message: 'startDate phải là ISO date string' })
  startDate!: string;

  @IsDateString({}, { message: 'endDate phải là ISO date string' })
  endDate!: string;
}

const normalizeVietnamesePhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const compact = value.trim().replace(/[\s.-]/g, '');
  return compact.startsWith('0') ? `+84${compact.slice(1)}` : compact;
};

/**
 * Public one-time booking payload. It deliberately excludes customerId,
 * createdBy, source and voucherCode so an unauthenticated caller cannot
 * choose an identity, forge audit ownership or apply account-bound credit.
 */
export class CreateGuestBookingDto {
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  violationAcknowledged?: boolean;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  guestName!: string;

  @Transform(normalizeVietnamesePhone)
  @IsString()
  @Matches(/^\+84\d{9}$/, { message: 'Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx' })
  guestPhone!: string;

  @IsUUID('4', { message: 'branchId không hợp lệ' })
  branchId!: string;

  @ValidateIf((value) => !value.comboId)
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 dịch vụ' })
  @ArrayMaxSize(20, { message: 'Không được đặt quá 20 dịch vụ cùng lúc' })
  @IsUUID('4', { each: true, message: 'serviceId không hợp lệ' })
  serviceIds?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'comboId không hợp lệ' })
  comboId?: string;

  @IsDateString({}, { message: 'appointmentDate phải là ISO date string' })
  appointmentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsUUID('4', { message: 'staffId không hợp lệ' })
  staffId?: string;
}
