import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateServiceDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsNumber() @Min(0) price!: number;
  @IsInt() @IsPositive() durationMinutes!: number;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsUUID() canonicalServiceId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

/** Owner-only compatibility command for one concrete branch offering. */
export class UpdateServiceDto {
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @IsPositive() durationMinutes?: number;
  @IsOptional() @IsBoolean() bookable?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

export class CreateBusinessServiceDto extends CreateServiceDto {
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) branchIds?: string[];
}

export class UpdateBusinessServiceDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @IsPositive() durationMinutes?: number;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @IsUUID() canonicalServiceId?: string;
  @IsOptional() @IsIn(['MAPPED', 'UNMAPPED', 'SUGGESTED']) mappingStatus?: 'MAPPED' | 'UNMAPPED' | 'SUGGESTED';
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

export class UpdateBranchOfferingPricingDto {
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @IsPositive() durationMinutes?: number;
}

export class UpdateBranchOfferingStatusDto {
  @IsOptional() @IsBoolean() bookable?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

export class CreateServiceCategoryDto {
  @IsUUID() businessId!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(140) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}

export class CreateCanonicalServiceDto {
  @IsString() @MaxLength(80) @Matches(/^[A-Z0-9_]+$/) code!: string;
  @IsString() @MaxLength(140) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
}

export class UpdateCanonicalServiceDto {
  @IsOptional() @IsString() @MaxLength(140) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'DEPRECATED', 'MERGED']) status?: 'ACTIVE' | 'DEPRECATED' | 'MERGED';
  @ValidateIf((value: UpdateCanonicalServiceDto) => value.status === 'MERGED' || value.replacementCanonicalId !== undefined)
  @IsUUID()
  replacementCanonicalId?: string;
}
