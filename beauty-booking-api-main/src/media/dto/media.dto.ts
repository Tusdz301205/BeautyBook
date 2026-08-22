import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const MEDIA_ENTITY_TYPES = [
  'USER_AVATAR',
  'BUSINESS_LOGO',
  'BUSINESS_IMAGE',
  'BRANCH_IMAGE',
  'SERVICE_IMAGE',
  'COMBO_IMAGE',
  'STAFF_IMAGE',
  'LEGAL_DOCUMENT',
  'BRANCH_DOCUMENT',
] as const;

export class UploadMediaDto {
  @IsIn(MEDIA_ENTITY_TYPES)
  entityType!: (typeof MEDIA_ENTITY_TYPES)[number];

  @IsUUID('4')
  entityId!: string;

  @IsOptional()
  @IsUUID('4')
  businessId?: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
