import {
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PublicBranchServicesQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class PublicBranchReviewsQueryDto {
  @IsOptional()
  @IsIn(['newest', 'highest', 'lowest'])
  sort: 'newest' | 'highest' | 'lowest' = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

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

export class BranchBookingPolicyDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  leadTimeMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  bookingHorizonDays?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  cancellationHours?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  rescheduleHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  noShowHandling?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  earlyCheckInMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  gracePeriodMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  allowWalkIn?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  allowCounterBooking?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  defaultBufferMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  overbookingEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(5)
  maxOverbookedSlots?: number;
}

export class BranchWorkingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  openTime!: string;

  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  closeTime!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  isClosed?: boolean;
}

export class SaveBranchOnboardingDto {
  @IsInt()
  @Min(1)
  @Max(13)
  currentStep!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(13)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(13, { each: true })
  completedSteps?: number[];

  @IsOptional()
  @IsObject()
  draftData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateBranchDto)
  branch?: UpdateBranchDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BranchBookingPolicyDto)
  bookingPolicy?: BranchBookingPolicyDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique((hour: BranchWorkingHourDto) => hour?.dayOfWeek)
  @ValidateNested({ each: true })
  @Type(() => BranchWorkingHourDto)
  workingHours?: BranchWorkingHourDto[];
}
