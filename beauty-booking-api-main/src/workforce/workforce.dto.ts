import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityRangeDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;
}

export class ReplaceAvailabilityDto {
  @IsUUID()
  staffId!: string;

  @IsUUID()
  branchId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  ranges!: AvailabilityRangeDto[];
}

export class GenerateTimesheetsDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ApproveTimesheetDto {
  @IsInt()
  @Min(0)
  @Max(1_440)
  approvedPaidMinutes!: number;

  @IsOptional()
  @IsObject()
  approvedRoleMinutes?: Record<string, number>;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class CreateTimesheetAdjustmentDto {
  @IsObject()
  newData!: Record<string, unknown>;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class ReviewTimesheetAdjustmentDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class CreateCompensationRuleDto {
  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsIn([
    'HOURLY_WAGE',
    'FIXED_COMPONENT',
    'SERVICE_COMMISSION',
    'PRODUCT_COMMISSION',
    'BONUS',
    'ALLOWANCE',
    'DEDUCTION',
  ])
  type!: string;

  @IsIn([
    'APPROVED_PAID_TIME',
    'SERVICE_AMOUNT',
    'AFTER_DISCOUNT',
    'AFTER_VOUCHER',
    'AFTER_REFUND',
    'FIXED',
  ])
  calculationBasis!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedAmount?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class AssignCompensationRuleDto {
  @IsUUID()
  staffId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CalculateCompensationDto {
  @IsUUID()
  businessId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class CreatePayRunDto {
  @IsUUID()
  businessId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}

export class TransitionPayRunDto {
  @IsIn(['REVIEW', 'APPROVED', 'LOCKED', 'EXPORTED', 'MARKED_PAID'])
  status!: 'REVIEW' | 'APPROVED' | 'LOCKED' | 'EXPORTED' | 'MARKED_PAID';

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;
}
