import { IsIn, IsInt, IsISO8601, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

const provided = (_object: unknown, value: unknown) => value !== undefined;
const original = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key];

export class UpdateSelfDto {
  @Transform(original) @ValidateIf(provided) @IsString() @MinLength(2) @MaxLength(150)
  fullName?: string;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(30)
  phone?: string;

  @Transform(original) @ValidateIf(provided) @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @Transform(original) @ValidateIf(provided) @IsISO8601({ strict: true })
  dateOfBirth?: string;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(100)
  avatarMediaId?: string;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(500)
  address?: string;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(5000)
  staffBio?: string;

  @Transform(original) @ValidateIf(provided) @IsInt() @Min(0) @Max(80)
  experienceYears?: number;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(150)
  emergencyContactName?: string;

  @Transform(original) @ValidateIf(provided) @IsString() @MaxLength(30)
  emergencyContactPhone?: string;
}
