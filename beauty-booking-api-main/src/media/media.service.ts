import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBranchAccess, assertBusinessAccess, restrictToRoles } from '../common/utils/multi-tenancy';
import type { UploadMediaDto } from './dto/media.dto';
import { auditLog } from '../common/utils/audit';
import { canAccessStoredMedia } from './media-access';

type IncomingFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

const ALLOWED: Record<string, { mime: string; extension: string }> = {
  jpeg: { mime: 'image/jpeg', extension: '.jpg' },
  png: { mime: 'image/png', extension: '.png' },
  webp: { mime: 'image/webp', extension: '.webp' },
  avif: { mime: 'image/avif', extension: '.avif' },
  pdf: { mime: 'application/pdf', extension: '.pdf' },
};

@Injectable()
export class MediaService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR') ?? join(process.cwd(), 'uploads'));
  }

  async upload(user: AuthUser, file: IncomingFile, input: UploadMediaDto) {
    const kind = this.detectKind(file.buffer);
    const allowed = ALLOWED[kind];
    if (!allowed || allowed.mime !== file.mimetype) {
      throw new BadRequestException('Nội dung tệp không khớp định dạng JPG, PNG, WebP, AVIF hoặc PDF được hỗ trợ');
    }
    const suppliedExtension = extname(file.originalname).toLowerCase();
    const acceptedExtensions = allowed.extension === '.jpg' ? ['.jpg', '.jpeg'] : [allowed.extension];
    if (!acceptedExtensions.includes(suppliedExtension)) {
      throw new BadRequestException('Phần mở rộng tệp không khớp nội dung tệp');
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Tệp phải có dung lượng từ 1 byte đến 10 MB');
    }
    const documentUpload = ['LEGAL_DOCUMENT', 'BRANCH_DOCUMENT'].includes(input.entityType);
    if (kind === 'pdf' && !documentUpload) {
      throw new BadRequestException('PDF chỉ được dùng cho hồ sơ pháp lý');
    }
    if (kind !== 'pdf' && documentUpload) {
      throw new BadRequestException('Hồ sơ pháp lý phải là tệp PDF');
    }

    const scope = await this.resolveScope(user, input);
    const now = new Date();
    const storageKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${allowed.extension}`;
    const destination = this.safePath(storageKey);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, file.buffer, { flag: 'wx' });

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const media = await tx.mediaFile.create({
          data: {
            url: '',
            storageKey,
            originalName: file.originalname.slice(0, 255),
            safeName: storageKey.split('/').pop(),
            mimeType: allowed.mime,
            extension: allowed.extension,
            fileType: kind === 'pdf' ? 'DOCUMENT' : 'IMAGE',
            fileSize: file.size,
            uploadedBy: user.id,
            businessId: scope.businessId,
            branchId: scope.branchId,
            entityType: input.entityType,
            entityId: input.entityId,
            visibility: documentUpload ? 'PRIVATE' : 'PUBLIC',
          },
        });
        const publicUrl = `/api/v1/media/public/${media.id}`;
        const saved = await tx.mediaFile.update({ where: { id: media.id }, data: { url: publicUrl } });
        await this.attach(tx as any, input.entityType, input.entityId, media.id);
        return saved;
      });
      if (documentUpload) {
        await auditLog(this.prisma, {
          userId: user.id,
          action: 'CREATE',
          entityType: 'LegalDocumentFile',
          entityId: saved.id,
          newData: { businessId: scope.businessId, mimeType: saved.mimeType, fileSize: saved.fileSize },
          reason: 'Tải tài liệu pháp lý riêng tư',
        });
      }
      return saved;
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  async read(id: string, allowPrivate: boolean) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media || !media.storageKey || !media.mimeType || !media.safeName) throw new NotFoundException('Tệp không tồn tại');
    if (media.visibility === 'PRIVATE' && !allowPrivate) throw new NotFoundException('Tệp không tồn tại');
    return { ...media, buffer: await readFile(this.safePath(media.storageKey)) };
  }

  async readForUser(id: string, user: AuthUser) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Tệp không tồn tại');
    if (media.visibility === 'PRIVATE') {
      const permitted = canAccessStoredMedia(user, media, 'read');
      if (!permitted) {
        throw new ForbiddenException('Bạn không có quyền xem tài liệu riêng tư này');
      }
    } else if (
      media.uploadedBy !== user.id &&
      !user.roles.includes('PLATFORM_ADMIN')
    ) {
      if (media.businessId) await assertBusinessAccess(this.prisma, user, media.businessId);
      else throw new ForbiddenException('Bạn không có quyền xem tệp này');
    }
    const file = await this.read(id, true);
    if (media.visibility === 'PRIVATE') {
      await auditLog(this.prisma, {
        userId: user.id,
        action: 'READ',
        entityType: 'LegalDocumentFile',
        entityId: media.id,
        newData: { businessId: media.businessId, branchId: media.branchId },
        reason: 'Đọc tài liệu pháp lý riêng tư',
      });
    }
    return file;
  }

  async remove(id: string, user: AuthUser) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Tệp không tồn tại');
    if (media.visibility === 'PRIVATE') {
      const permitted = canAccessStoredMedia(user, media, 'delete');
      if (!permitted) {
        throw new ForbiddenException('Bạn không có quyền xóa tài liệu riêng tư này');
      }
    } else if (!canAccessStoredMedia(user, media, 'delete')) {
      throw new ForbiddenException('Bạn không có quyền xóa tệp tại cơ sở hoặc chi nhánh này');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({ where: { avatarMediaId: id }, data: { avatarMediaId: null } });
      await tx.business.updateMany({ where: { logoMediaId: id }, data: { logoMediaId: null } });
      await tx.businessImage.deleteMany({ where: { mediaId: id } });
      await tx.branchImage.deleteMany({ where: { mediaId: id } });
      await tx.serviceImage.deleteMany({ where: { mediaId: id } });
      await tx.comboImage.deleteMany({ where: { mediaId: id } });
      await tx.staffImage.deleteMany({ where: { mediaId: id } });
      await tx.mediaFile.delete({ where: { id } });
    });
    if (media.storageKey) await unlink(this.safePath(media.storageKey)).catch(() => undefined);
    if (['LEGAL_DOCUMENT', 'BRANCH_DOCUMENT'].includes(media.entityType ?? '')) {
      await auditLog(this.prisma, {
        userId: user.id,
        action: 'DELETE',
        entityType: 'LegalDocumentFile',
        entityId: media.id,
        oldData: { businessId: media.businessId, mimeType: media.mimeType, fileSize: media.fileSize },
        reason: 'Xóa tài liệu pháp lý riêng tư',
      });
    }
    return { ok: true };
  }

  private async resolveScope(user: AuthUser, input: UploadMediaDto) {
    if (input.entityType === 'USER_AVATAR') {
      if (input.entityId !== user.id && !user.roles.includes('PLATFORM_ADMIN')) {
        throw new ForbiddenException('Bạn chỉ có thể đổi ảnh đại diện của chính mình');
      }
      const target = await this.prisma.user.findUnique({
        where: { id: input.entityId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Tài khoản không tồn tại');
      if (input.businessId || input.branchId) {
        throw new BadRequestException('Ảnh đại diện không mang scope của cơ sở');
      }
      return { businessId: null, branchId: null };
    }

    let businessId: string;
    let branchId: string | null = null;
    if (['BUSINESS_LOGO', 'BUSINESS_IMAGE', 'LEGAL_DOCUMENT'].includes(input.entityType)) {
      const business = await this.prisma.business.findFirst({
        where: { id: input.entityId, deletedAt: null },
        select: { id: true },
      });
      if (!business) throw new NotFoundException('Cơ sở không tồn tại');
      businessId = business.id;
    } else if (['BRANCH_IMAGE', 'BRANCH_DOCUMENT'].includes(input.entityType)) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.entityId, deletedAt: null },
        select: { id: true, businessId: true },
      });
      if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
      businessId = branch.businessId;
      branchId = branch.id;
    } else if (input.entityType === 'SERVICE_IMAGE') {
      const service = await this.prisma.branchServiceOffering.findFirst({
        where: { id: input.entityId, deletedAt: null },
        select: { branchId: true, branch: { select: { businessId: true } } },
      });
      if (!service) throw new NotFoundException('Dịch vụ không tồn tại');
      businessId = service.branch.businessId;
      branchId = service.branchId;
    } else if (input.entityType === 'COMBO_IMAGE') {
      const combo = await this.prisma.combo.findFirst({
        where: { id: input.entityId, deletedAt: null },
        select: { branchId: true, branch: { select: { businessId: true } } },
      });
      if (!combo) throw new NotFoundException('Combo không tồn tại');
      businessId = combo.branch.businessId;
      branchId = combo.branchId;
    } else {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { id: input.entityId, deletedAt: null },
        select: { branchId: true, branch: { select: { businessId: true } } },
      });
      if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
      businessId = staff.branch.businessId;
      branchId = staff.branchId;
    }

    if (input.businessId && input.businessId !== businessId) {
      throw new BadRequestException('Cơ sở gửi lên không khớp thực thể đích');
    }
    if (input.branchId && input.branchId !== branchId) {
      throw new BadRequestException('Chi nhánh gửi lên không khớp thực thể đích');
    }
    const administrator = restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']);
    if (branchId) await assertBranchAccess(this.prisma, administrator, branchId);
    else await assertBusinessAccess(this.prisma, administrator, businessId);
    return { businessId, branchId };
  }

  private async attach(tx: any, entityType: UploadMediaDto['entityType'], entityId: string, mediaId: string) {
    if (entityType === 'USER_AVATAR') await tx.user.update({ where: { id: entityId }, data: { avatarMediaId: mediaId } });
    if (entityType === 'BUSINESS_LOGO') await tx.business.update({ where: { id: entityId }, data: { logoMediaId: mediaId } });
    if (entityType === 'BUSINESS_IMAGE') await tx.businessImage.create({ data: { businessId: entityId, mediaId } });
    if (entityType === 'BRANCH_IMAGE') await tx.branchImage.create({ data: { branchId: entityId, mediaId } });
    if (entityType === 'SERVICE_IMAGE') await tx.serviceImage.create({ data: { serviceId: entityId, mediaId } });
    if (entityType === 'COMBO_IMAGE') await tx.comboImage.create({ data: { comboId: entityId, mediaId } });
    if (entityType === 'STAFF_IMAGE') await tx.staffImage.create({ data: { staffId: entityId, mediaId } });
  }

  private safePath(storageKey: string) {
    const target = resolve(this.uploadDir, storageKey);
    if (target !== this.uploadDir && !target.startsWith(`${this.uploadDir}${sep}`)) throw new BadRequestException('Đường dẫn lưu trữ không hợp lệ');
    return target;
  }

  private detectKind(buffer: Buffer): keyof typeof ALLOWED | '' {
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 12).includes('ftypavif')) return 'avif';
    if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
    return '';
  }
}
