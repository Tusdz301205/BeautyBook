import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ComboServiceItemDto {
  @IsUUID('4')
  serviceId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(19)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  transitionMinutes?: number;
}

export class CreateComboDto {
  @IsUUID('4')
  branchId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  comboPrice!: number;

  @IsOptional()
  @IsEnum(['FIXED_PRICE'])
  pricingMode?: 'FIXED_PRICE';

  @IsOptional()
  @IsEnum(['SINGLE_PROVIDER', 'PER_SERVICE_PROVIDER'])
  staffAssignmentMode?: 'SINGLE_PROVIDER' | 'PER_SERVICE_PROVIDER';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ComboServiceItemDto)
  services!: ComboServiceItemDto[];

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsage?: number;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'PAUSED', 'EXPIRED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'EXPIRED';
}

export class UpdateComboDto extends CreateComboDto {}
