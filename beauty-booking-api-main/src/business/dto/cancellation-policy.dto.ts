import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CUSTOMER_CANCELLATION_HOURS } from '../../bookings/customer-cancellation-policy';

// CancellationPolicy hour fields use PostgreSQL's signed 32-bit integer type.
export const MAX_CANCELLATION_POLICY_HOURS = 2147483647;
export const MAX_CANCELLATION_POLICY_NOTES_LENGTH = 2000;

export class UpdateCancellationPolicyDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(CUSTOMER_CANCELLATION_HOURS)
  @Max(CUSTOMER_CANCELLATION_HOURS)
  freeCancelHours?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(MAX_CANCELLATION_POLICY_HOURS)
  rescheduleAllowedHours?: number;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsString()
  @MaxLength(MAX_CANCELLATION_POLICY_NOTES_LENGTH)
  @Matches(/^[^\u0000]*$/u, { message: 'notes must not contain null characters' })
  notes?: string | null;
}
