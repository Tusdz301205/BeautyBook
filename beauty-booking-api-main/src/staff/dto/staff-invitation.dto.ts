import { IsEmail, IsIn, IsOptional, IsString, IsStrongPassword, IsUUID, MinLength } from 'class-validator';

export class InviteStaffDto {
  @IsUUID()
  staffProfileId!: string;

  @IsEmail()
  email!: string;

  @IsIn(['BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'])
  roleCode!: 'BRANCH_MANAGER' | 'RECEPTIONIST' | 'STAFF';

  @IsUUID()
  businessId!: string;

  @IsUUID()
  branchId!: string;
}

export class ChangeStaffInvitationEmailDto {
  @IsEmail()
  email!: string;
}

export class AcceptExistingStaffInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string;
}

export class AcceptStaffInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
