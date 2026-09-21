import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';
import { UploadMediaDto } from './dto/media.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')
  @RequirePermission('user:update:self')
  @Audited({ action: AuditAction.CREATE, entityType: 'MediaFile' })
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body() body: UploadMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn một tệp');
    return this.media.upload(user, file, body);
  }

  @Public()
  @Get('public/:id')
  async publicContent(@Param('id') id: string) {
    const file = await this.media.read(id, false);
    return new StreamableFile(file.buffer, {
      type: file.mimeType ?? 'application/octet-stream',
      disposition: `inline; filename="${file.safeName ?? 'download'}"`,
    });
  }

  @Get(':id/content')
  async privateContent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const file = await this.media.readForUser(id, user);
    return new StreamableFile(file.buffer, {
      type: file.mimeType ?? 'application/octet-stream',
      disposition: `${file.visibility === 'PRIVATE' ? 'attachment' : 'inline'}; filename="${file.safeName ?? 'download'}"`,
    });
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entityType: 'MediaFile' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.media.remove(id, user);
  }
}
