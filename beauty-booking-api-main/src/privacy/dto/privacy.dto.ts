import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConsultationAnswerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fieldKey!: string;

  @IsDefined()
  value!: unknown;
}

export class SubmitConsultationDto {
  @IsUUID('4')
  serviceId!: string;

  @IsString()
  @Length(64, 64)
  noticeHash!: string;

  @IsBoolean()
  @IsIn([true])
  consentAccepted!: true;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConsultationAnswerDto)
  answers!: ConsultationAnswerDto[];
}

export class RevokeConsultationConsentDto {
  @IsUUID('4')
  grantEventId!: string;
}

export class CreateBreakGlassGrantDto {
  @IsUUID('4')
  bookingId!: string;

  @IsIn(['CUSTOMER_SAFETY', 'INCIDENT_RESPONSE', 'LEGAL_CASE'])
  reason!: 'CUSTOMER_SAFETY' | 'INCIDENT_RESPONSE' | 'LEGAL_CASE';

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  explanation!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  durationMinutes!: number;
}

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

export class ConsultationFieldDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fieldKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(['TEXT', 'TEXTAREA', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT', 'DATE'])
  fieldType!:
    | 'TEXT'
    | 'TEXTAREA'
    | 'BOOLEAN'
    | 'SINGLE_SELECT'
    | 'MULTI_SELECT'
    | 'DATE';

  @IsOptional()
  @IsIn([
    'SKIN_CONDITION',
    'ALLERGY',
    'MEDICATION',
    'PREGNANCY',
    'GENERAL_HEALTH',
    'OTHER',
  ])
  dataCategory?:
    | 'SKIN_CONDITION'
    | 'ALLERGY'
    | 'MEDICATION'
    | 'PREGNANCY'
    | 'GENERAL_HEALTH'
    | 'OTHER';

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  options?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4000)
  maxLength?: number;
}

export class CreateConsultationTemplateDto {
  @IsUUID('4')
  businessId!: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  noticeVersion!: string;

  @IsString()
  @MinLength(40)
  @MaxLength(12000)
  noticeContent!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  purpose!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  recipientDescription!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConsultationFieldDefinitionDto)
  fields!: ConsultationFieldDefinitionDto[];
}

export class CreateConsultationVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  noticeVersion!: string;

  @IsString()
  @MinLength(40)
  @MaxLength(12000)
  noticeContent!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  purpose!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  recipientDescription!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConsultationFieldDefinitionDto)
  fields!: ConsultationFieldDefinitionDto[];
}

export class SetConsultationRequirementDto {
  @IsUUID('4')
  serviceId!: string;

  @IsUUID('4')
  templateId!: string;

  @IsBoolean()
  required!: boolean;

  @IsIn(['BEFORE_APPOINTMENT', 'AT_CHECK_IN', 'BEFORE_SERVICE'])
  timing!: 'BEFORE_APPOINTMENT' | 'AT_CHECK_IN' | 'BEFORE_SERVICE';
}
