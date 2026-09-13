import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDataSubjectRequestDto {
  @IsIn([
    'EXPORT',
    'RECTIFICATION',
    'ERASURE',
    'RESTRICT_PROCESSING',
    'OBJECT_PROCESSING',
    'DELETE_ACCOUNT',
  ])
  type!:
    | 'EXPORT'
    | 'RECTIFICATION'
    | 'ERASURE'
    | 'RESTRICT_PROCESSING'
    | 'OBJECT_PROCESSING'
    | 'DELETE_ACCOUNT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class MarketingPreferenceDto {
  @IsBoolean()
  emailMarketing!: boolean;

  @IsBoolean()
  smsMarketing!: boolean;

  @IsBoolean()
  pushMarketing!: boolean;

  @IsBoolean()
  personalizedPromotions!: boolean;
}

export class CreatePrivacyExportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string;
}
