import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const normalizeVietnamPhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const compact = value.trim().replace(/[\s.-]/g, '');
  return compact.startsWith('0') ? `+84${compact.slice(1)}` : compact;
};

export class LoginDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'SALON', 'PLATFORM'])
  workspace?: 'CUSTOMER' | 'SALON' | 'PLATFORM';

  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password!: string;
}

export class RegisterDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'BUSINESS_OWNER'], {
    message: 'Loại tài khoản không hợp lệ',
  })
  accountType?: 'CUSTOMER' | 'BUSINESS_OWNER';

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254, { message: 'Email không được vượt quá 254 ký tự' })
  email!: string;

  @IsString()
  @MaxLength(128, { message: 'Mật khẩu không được vượt quá 128 ký tự' })
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }, {
    message: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số',
  })
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
  fullName!: string;

  @IsOptional()
  @Transform(normalizeVietnamPhone)
  @IsString()
  @Matches(/^\+84\d{9}$/, {
    message: 'Số điện thoại Việt Nam phải có 10 chữ số, bắt đầu bằng 0 hoặc +84',
  })
  phone?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}
