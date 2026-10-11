import { Transform } from 'class-transformer';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
const original = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key];
export class SuspendUserDto {
  @Transform(original) @IsBoolean() isActive!: boolean;
  @Transform(original) @IsBoolean() expectedIsActive!: boolean;
  @Transform(original) @IsBoolean() acknowledgeImpact!: boolean;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
}
