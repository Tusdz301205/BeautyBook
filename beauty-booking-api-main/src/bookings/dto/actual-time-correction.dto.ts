import { IsIn, IsInt, IsISO8601, IsString, MaxLength, Min, ValidateIf, IsOptional, IsUUID } from 'class-validator';

export class ActualTimeCorrectionDto {
  @IsIn(['KNOWN', 'UNKNOWN'])
  @IsOptional()
  actualTimingStatus?: 'KNOWN' | 'UNKNOWN';

  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  actualStartedAt!: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  actualCompletedAt!: string | null;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class ActualTimeGrantDto {
  @IsUUID()
  userId!: string;
  @IsUUID()
  businessId!: string;
  @IsOptional()
  @IsUUID()
  branchId?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class RevokeActualTimeGrantDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
