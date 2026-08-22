import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  addressLine?: string;

  @IsOptional()
  @IsUUID()
  districtId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  directions?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Matches(/^[0-9+ ()-]{8,20}$/)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  managerName?: string;

  @IsOptional()
  @IsDateString()
  scheduledOpeningDate?: string;

  @IsOptional()
  @IsDateString()
  bookingStartDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsIn(['AT_LOCATION', 'MOBILE', 'BOTH'])
  serviceMode?: 'AT_LOCATION' | 'MOBILE' | 'BOTH';

  @IsOptional()
  @IsArray()
  serviceAreas?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @IsOptional()
  @Min(0)
  travelFee?: number;

  @IsOptional()
  @IsArray()
  excludedServiceAreas?: unknown[];

  @IsOptional()
  @IsIn(['MANUAL_CONFIRMATION', 'AUTO_CONFIRMATION'])
  bookingConfirmationMode?: 'MANUAL_CONFIRMATION' | 'AUTO_CONFIRMATION';

  @IsOptional()
  @IsIn(['CUSTOMER_SELECTS_STAFF', 'AUTO_ASSIGN_IF_ANY_STAFF', 'MANUAL_ASSIGN_BY_RECEPTIONIST'])
  staffAssignmentMode?: 'CUSTOMER_SELECTS_STAFF' | 'AUTO_ASSIGN_IF_ANY_STAFF' | 'MANUAL_ASSIGN_BY_RECEPTIONIST';

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  pendingHoldMinutes?: number;
}

export class CreateBranchDraftDto {
  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  sameLegalEntity?: boolean;

  @IsOptional()
  @IsIn(['AT_LOCATION', 'MOBILE', 'BOTH'])
  serviceMode?: 'AT_LOCATION' | 'MOBILE' | 'BOTH';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @IsOptional()
  @IsUUID()
  districtId?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Matches(/^[0-9+ ()-]{8,20}$/)
  phone?: string;
}

export class SaveBranchOnboardingDto {
  @IsInt()
  @Min(1)
  @Max(14)
  currentStep!: number;

  @IsOptional()
  @IsArray()
  completedSteps?: number[];

  @IsOptional()
  @IsObject()
  draftData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  branch?: UpdateBranchDto;

  @IsOptional()
  @IsObject()
  bookingPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  attendancePolicy?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  workingHours?: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed?: boolean;
  }>;
}
