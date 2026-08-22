import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePromotionDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType!: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsNumber() @IsPositive() discountValue!: number;
  @IsISO8601() startDate!: string;
  @IsISO8601() endDate!: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) businessIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) serviceIds?: string[];
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsOptional() @IsNumber() @IsPositive() discountValue?: number;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'EXPIRED']) status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
}

export class CreateVoucherDto {
  @IsString() @MaxLength(50) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType!: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsNumber() @IsPositive() discountValue!: number;
  @IsOptional() @IsNumber() @Min(0) minOrderValue?: number;
  @IsOptional() @IsNumber() @IsPositive() maxDiscount?: number;
  @IsInt() @Min(1) totalQuantity!: number;
  @IsISO8601() startDate!: string;
  @IsISO8601() endDate!: string;
  @IsOptional() @IsUUID() businessId?: string;
  @IsOptional() @IsIn(['PLATFORM', 'TENANT', 'CUSTOMER', 'COMPENSATION', 'CAMPAIGN']) scope?: 'PLATFORM' | 'TENANT' | 'CUSTOMER' | 'COMPENSATION' | 'CAMPAIGN';
  @IsOptional() @IsIn(['ALL', 'NEW_CUSTOMER', 'RETURNING_CUSTOMER', 'BIRTHDAY', 'VIP', 'SELECTED']) audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
  @IsOptional() @IsBoolean() autoIssue?: boolean;
}

export class UpdateVoucherDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(1) totalQuantity?: number;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsIn(['ACTIVE', 'EXPIRED', 'REVOKED']) status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  @IsOptional() @IsIn(['ALL', 'NEW_CUSTOMER', 'RETURNING_CUSTOMER', 'BIRTHDAY', 'VIP', 'SELECTED']) audience?: 'ALL' | 'NEW_CUSTOMER' | 'RETURNING_CUSTOMER' | 'BIRTHDAY' | 'VIP' | 'SELECTED';
  @IsOptional() @IsBoolean() autoIssue?: boolean;
}
