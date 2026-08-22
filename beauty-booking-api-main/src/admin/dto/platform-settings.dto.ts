import { IsObject } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsObject()
  settings!: Record<string, number | boolean>;
}
