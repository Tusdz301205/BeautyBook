import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class RecurringPreviewDto {
  @IsUUID('4')
  branchId!: string;

  @ValidateIf((value) => !value.comboId)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsUUID('4')
  comboId?: string;

  @IsOptional()
  @IsUUID('4')
  staffId?: string;

  @IsEnum(['SAME_STAFF', 'ANY_AVAILABLE'])
  staffMode!: 'SAME_STAFF' | 'ANY_AVAILABLE';

  @IsEnum(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  frequency!: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  preferredTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(52)
  occurrenceCount!: number;
}

export class CreateRecurringPlanDto extends RecurringPreviewDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  skipConflicts?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateRecurringStatusDto {
  @IsEnum(['ACTIVE', 'PAUSED'])
  status!: 'ACTIVE' | 'PAUSED';
}
