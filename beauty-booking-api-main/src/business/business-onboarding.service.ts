import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBusinessAccess, restrictToRoles } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { auditLog } from '../common/utils/audit';
import { Prisma } from '@prisma/client';

export const BUSINESS_TYPE_CATALOG = [
  { code: 'HAIR_SALON', label: 'Salon tóc', active: true },
  { code: 'SPA', label: 'Spa', active: true },
  { code: 'NAIL', label: 'Nail', active: true },
  { code: 'BARBER', label: 'Barber', active: true },
  { code: 'MAKEUP', label: 'Makeup', active: true },
  { code: 'MASSAGE', label: 'Massage', active: true },
  { code: 'BEAUTY_STUDIO', label: 'Beauty studio', active: true },
  { code: 'MOBILE_SERVICE', label: 'Dịch vụ tận nơi', active: true },
] as const;

export function businessTypeLabel(onboardingData: unknown): string {
  const code = (onboardingData as OnboardingDraft | null)?.businessType;
  return BUSINESS_TYPE_CATALOG.find((item) => item.code === code)?.label ?? 'Chưa chọn loại hình dịch vụ';
}

const activeBusinessTypeCodes = () => new Set(
  BUSINESS_TYPE_CATALOG.filter((item) => item.active).map((item) => item.code),
);

const BUSINESS_DRAFT_FIELDS = new Set([
  'name', 'slug', 'description', 'contactEmail', 'contactPhone', 'addressLine',
  'legalRepresentative', 'legalDocuments', 'companyName', 'taxCode',
  'identityCardNumber', 'onboardingStep', 'onboardingData', 'marketplacePreviewed',
]);

export function isInternalBusinessDraftName(value: unknown) {
  return typeof value === 'string' && /^hồ sơ cơ sở của\b/i.test(value.trim());
}

export function assertSubmittableBusinessName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2 || name.length > 150 || isInternalBusinessDraftName(name)) {
    throw new BadRequestException('Vui lòng nhập tên thương hiệu từ 2 đến 150 ký tự trước khi gửi hồ sơ.');
  }
  return name;
}

export interface BusinessDraftInput {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  legalRepresentative?: string | null;
  legalDocuments?: unknown;
  companyName?: string | null;
  taxCode?: string | null;
  identityCardNumber?: string | null;
  onboardingStep?: number;
  onboardingData?: unknown;
  marketplacePreviewed?: boolean;
}

interface LegalDocumentInput {
  documentType: 'BUSINESS_LICENSE' | 'OWNER_ID_CARD' | 'TAX_DOCUMENT' | 'OTHER';
  documentName: string;
  documentNumber?: string;
  expiresAt?: string;
  documentUrl: string;
  mediaId?: string;
  note?: string;
}

type OnboardingDraft = {
  businessType?: string;
  completedSteps?: number[];
  branch?: Record<string, unknown>;
  services?: Record<string, unknown>[];
  staff?: Record<string, unknown>[];
  bookingPolicy?: Record<string, unknown>;
  media?: Record<string, unknown>;
  privacy?: Record<string, unknown>;
  previewAcknowledged?: boolean;
};

@Injectable()
export class BusinessOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
  ) {}

  async getOnboardingConfig(userId: string) {
    const policy = await this.settings.getEffective();
    const user = policy.requirePhoneVerification
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { isPhoneVerified: true } })
      : null;
    return {
      businessTypes: BUSINESS_TYPE_CATALOG.filter((item) => item.active).map(({ code, label }) => ({ code, label })),
      requiredDocuments: policy.requireIdVerification ? ['BUSINESS_LICENSE', 'OWNER_ID_CARD'] : [],
      requirePhoneVerification: policy.requirePhoneVerification,
      phoneVerified: policy.requirePhoneVerification ? user?.isPhoneVerified === true : true,
    };
  }

  private normalizeDraftInput(input: BusinessDraftInput): BusinessDraftInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Thông tin hồ sơ không hợp lệ');
    }
    const unknown = Object.keys(input).filter((key) => !BUSINESS_DRAFT_FIELDS.has(key));
    if (unknown.length) throw new BadRequestException('Hồ sơ có trường thông tin không được hỗ trợ');
    const result: BusinessDraftInput = { ...input };
    const textFields: Array<[keyof BusinessDraftInput, string, number]> = [
      ['name', 'Tên thương hiệu', 150],
      ['slug', 'Đường dẫn BeautyBook', 70],
      ['description', 'Giới thiệu doanh nghiệp', 2000],
      ['contactEmail', 'Email liên hệ', 254],
      ['contactPhone', 'Số điện thoại', 30],
      ['addressLine', 'Địa chỉ đăng ký', 500],
      ['legalRepresentative', 'Người đại diện', 150],
      ['companyName', 'Tên pháp nhân', 255],
      ['taxCode', 'Mã số thuế', 100],
      ['identityCardNumber', 'Số định danh', 100],
    ];
    for (const [key, label, maxLength] of textFields) {
      const value = input[key];
      if (value === undefined) continue;
      if (value === null) {
        (result as Record<string, unknown>)[key] = null;
        continue;
      }
      if (typeof value !== 'string') throw new BadRequestException(`${label} không hợp lệ`);
      const trimmed = value.trim();
      if (trimmed.length > maxLength) throw new BadRequestException(`${label} không được vượt quá ${maxLength} ký tự`);
      (result as Record<string, unknown>)[key] = trimmed || null;
    }
    if (typeof result.slug === 'string') {
      result.slug = result.slug.toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)) {
        throw new BadRequestException('Đường dẫn chỉ gồm chữ không dấu, số và dấu gạch nối');
      }
    }
    if (typeof result.contactEmail === 'string'
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail)) {
      throw new BadRequestException('Email liên hệ không hợp lệ');
    }
    if (typeof result.contactEmail === 'string') result.contactEmail = result.contactEmail.toLowerCase();
    if (typeof result.contactPhone === 'string') {
      const compact = result.contactPhone.replace(/[\s().-]/g, '');
      const normalized = compact.startsWith('0') ? `+84${compact.slice(1)}` : compact;
      if (!/^\+84\d{9}$/.test(normalized)) {
        throw new BadRequestException('Dùng số điện thoại Việt Nam gồm 10 chữ số, bắt đầu bằng 0 hoặc +84');
      }
      result.contactPhone = normalized;
    }
    return result;
  }

  private throwFriendlyUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
      if (/tax_code/i.test(target)) throw new ConflictException('Mã số thuế này đã được sử dụng trong một hồ sơ khác.');
      if (/slug/i.test(target)) throw new ConflictException('Đường dẫn này đã được sử dụng. Hãy chọn đường dẫn khác.');
    }
    throw error;
  }

  private validateDocuments(value: unknown): LegalDocumentInput[] {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('Danh sách giấy tờ không hợp lệ');
    const types = new Set(['BUSINESS_LICENSE', 'OWNER_ID_CARD', 'TAX_DOCUMENT', 'OTHER']);
    return value.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`Giấy tờ số ${index + 1} không hợp lệ`);
      }
      const document = item as Partial<LegalDocumentInput>;
      for (const field of ['documentName', 'documentUrl', 'mediaId', 'documentNumber', 'expiresAt', 'note'] as const) {
        if (document[field] !== undefined && typeof document[field] !== 'string') {
          throw new BadRequestException(`Thông tin giấy tờ số ${index + 1} không hợp lệ`);
        }
      }
      if (!types.has(String(document.documentType)) || !document.documentName?.trim() || !document.documentUrl?.trim()) {
        throw new BadRequestException(`Giấy tờ số ${index + 1} cần đủ loại, tên và URL`);
      }
      if (document.documentName.trim().length > 255
        || (document.documentNumber?.trim().length ?? 0) > 100
        || (document.note?.trim().length ?? 0) > 1000) {
        throw new BadRequestException(`Thông tin giấy tờ số ${index + 1} vượt quá độ dài cho phép`);
      }
      const documentUrl = document.documentUrl.trim();
      if (!document.mediaId) {
        throw new BadRequestException(`Giấy tờ số ${index + 1} phải được tải lên hệ thống`);
      }
      if (!documentUrl.startsWith('/api/v1/media/') && !documentUrl.startsWith('http://') && !documentUrl.startsWith('https://')) {
        throw new BadRequestException(`Đường dẫn giấy tờ số ${index + 1} không hợp lệ`);
      }
      const expiresAt = document.expiresAt?.trim();
      if (expiresAt) {
        const date = new Date(`${expiresAt}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) || Number.isNaN(date.getTime())
          || date.toISOString().slice(0, 10) !== expiresAt) {
          throw new BadRequestException(`Ngày hết hạn giấy tờ số ${index + 1} không hợp lệ`);
        }
      }
      return {
        documentType: document.documentType,
        mediaId: document.mediaId,
        documentName: document.documentName.trim(),
        documentNumber: document.documentNumber?.trim() || undefined,
        expiresAt: expiresAt || undefined,
        documentUrl,
        note: document.note?.trim(),
      } as LegalDocumentInput;
    });
  }

  private text(value: unknown, label: string, max = 500, required = false) {
    if (value == null || value === '') {
      if (required) throw new BadRequestException(`${label} là bắt buộc`);
      return undefined;
    }
    if (typeof value !== 'string' || value.trim().length > max) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
    return value.trim();
  }

  private number(value: unknown, label: string, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
    return parsed;
  }

  private validateOnboardingData(value: unknown): OnboardingDraft | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Dữ liệu onboarding không hợp lệ');
    }
    const input = value as Record<string, unknown>;
    const result: OnboardingDraft = {};
    if (input.businessType !== undefined) {
      if (!activeBusinessTypeCodes().has(String(input.businessType) as (typeof BUSINESS_TYPE_CATALOG)[number]['code'])) {
        throw new BadRequestException('Loại hình doanh nghiệp không còn khả dụng. Hãy chọn một loại hình đang được hỗ trợ.');
      }
      result.businessType = String(input.businessType);
    }
    if (input.completedSteps !== undefined) {
      if (!Array.isArray(input.completedSteps) || input.completedSteps.some((step) => !Number.isInteger(step) || step < 1 || step > 10)) {
        throw new BadRequestException('Tiến trình onboarding không hợp lệ');
      }
      result.completedSteps = [...new Set(input.completedSteps as number[])].sort((a, b) => a - b);
    }
    if (input.branch !== undefined) {
      const branch = input.branch as Record<string, unknown>;
      if (!branch || typeof branch !== 'object' || Array.isArray(branch)) throw new BadRequestException('Thông tin chi nhánh không hợp lệ');
      const serviceMode = branch.serviceMode === undefined ? undefined : String(branch.serviceMode);
      if (serviceMode && !['AT_LOCATION', 'MOBILE', 'BOTH'].includes(serviceMode)) throw new BadRequestException('Hình thức phục vụ không hợp lệ');
      result.branch = {
        name: this.text(branch.name, 'Tên chi nhánh', 150),
        address: this.text(branch.address, 'Địa chỉ chi nhánh', 500),
        timezone: this.text(branch.timezone, 'Múi giờ', 80),
        phone: this.text(branch.phone, 'Số điện thoại chi nhánh', 30),
        serviceMode,
        openingHours: Array.isArray(branch.openingHours)
          ? branch.openingHours.slice(0, 7).map((row, index) => {
              const hour = row as Record<string, unknown>;
              return {
                dayOfWeek: this.number(hour.dayOfWeek ?? index, 'Ngày trong tuần', 0, 6),
                isClosed: Boolean(hour.isClosed),
                openTime: this.text(hour.openTime, 'Giờ mở cửa', 5),
                closeTime: this.text(hour.closeTime, 'Giờ đóng cửa', 5),
              };
            })
          : [],
      };
    }
    if (input.services !== undefined) {
      if (!Array.isArray(input.services) || input.services.length > 30) throw new BadRequestException('Danh sách dịch vụ không hợp lệ');
      result.services = input.services.map((row, index) => {
        const service = row as Record<string, unknown>;
        return {
          tempId: this.text(service.tempId, `Mã dịch vụ ${index + 1}`, 80, true),
          name: this.text(service.name, `Tên dịch vụ ${index + 1}`, 150, true),
          category: this.text(service.category, `Nhóm dịch vụ ${index + 1}`, 100, true),
          price: this.number(service.price, `Giá dịch vụ ${index + 1}`, 0, 1_000_000_000),
          durationMinutes: this.number(service.durationMinutes, `Thời lượng dịch vụ ${index + 1}`, 5, 1440),
          bufferBeforeMinutes: this.number(service.bufferBeforeMinutes ?? 0, `Buffer trước dịch vụ ${index + 1}`, 0, 240),
          bufferAfterMinutes: this.number(service.bufferAfterMinutes ?? 0, `Buffer sau dịch vụ ${index + 1}`, 0, 240),
          bookable: service.bookable !== false,
        };
      });
    }
    if (input.staff !== undefined) {
      if (!Array.isArray(input.staff) || input.staff.length > 50) throw new BadRequestException('Danh sách nhân viên không hợp lệ');
      result.staff = input.staff.map((row, index) => {
        const staff = row as Record<string, unknown>;
        const assignments = Array.isArray(staff.serviceTempIds)
          ? staff.serviceTempIds.slice(0, 30).map((id) => this.text(id, 'Dịch vụ phân công', 80, true))
          : [];
        return {
          tempId: this.text(staff.tempId, `Mã nhân viên ${index + 1}`, 80, true),
          fullName: this.text(staff.fullName, `Tên nhân viên ${index + 1}`, 150, true),
          jobTitle: this.text(staff.jobTitle, `Chức danh nhân viên ${index + 1}`, 100, true),
          serviceTempIds: assignments,
          isBookable: staff.isBookable !== false,
          schedule: this.text(staff.schedule, 'Lịch làm dự kiến', 500),
        };
      });
    }
    if (input.bookingPolicy !== undefined) {
      const policy = input.bookingPolicy as Record<string, unknown>;
      const confirmationMode = String(policy.confirmationMode || '');
      const staffAssignmentMode = String(policy.staffAssignmentMode || '');
      if (!['AUTO_CONFIRMATION', 'MANUAL_CONFIRMATION'].includes(confirmationMode)) throw new BadRequestException('Cách xác nhận booking không hợp lệ');
      if (!['CUSTOMER_SELECTS_STAFF', 'AUTO_ASSIGN_IF_ANY_STAFF', 'MANUAL_ASSIGN_BY_RECEPTIONIST'].includes(staffAssignmentMode)) throw new BadRequestException('Cách phân công nhân viên không hợp lệ');
      result.bookingPolicy = {
        confirmationMode,
        staffAssignmentMode,
        cancellationPolicy: this.text(policy.cancellationPolicy, 'Chính sách hủy', 2000),
        noShowPolicy: this.text(policy.noShowPolicy, 'Chính sách no-show', 2000),
        leadTimeHours: this.number(policy.leadTimeHours ?? 2, 'Thời gian đặt trước', 0, 720),
        pendingHoldMinutes: this.number(policy.pendingHoldMinutes ?? 30, 'Thời gian giữ chỗ', 5, 1440),
        depositPercent: this.number(policy.depositPercent ?? 0, 'Tỷ lệ đặt cọc', 0, 100),
      };
    }
    if (input.media !== undefined) {
      const media = input.media as Record<string, unknown>;
      result.media = {
        logoMediaId: this.text(media.logoMediaId, 'Logo', 80),
        coverMediaId: this.text(media.coverMediaId, 'Ảnh bìa', 80),
        galleryMediaIds: Array.isArray(media.galleryMediaIds)
          ? media.galleryMediaIds.slice(0, 20).map((id) => this.text(id, 'Ảnh gallery', 80, true))
          : [],
      };
    }
    if (input.privacy !== undefined) {
      const privacy = input.privacy as Record<string, unknown>;
      result.privacy = {
        requiredServiceTempIds: Array.isArray(privacy.requiredServiceTempIds)
          ? privacy.requiredServiceTempIds.slice(0, 30).map((id) => this.text(id, 'Dịch vụ cần form', 80, true))
          : [],
        templateName: this.text(privacy.templateName, 'Tên form tư vấn', 150),
        recipient: this.text(privacy.recipient, 'Người nhận dữ liệu', 250),
        expiryDays: this.number(privacy.expiryDays ?? 90, 'Thời hạn chia sẻ', 1, 3650),
        notice: this.text(privacy.notice, 'Thông báo quyền riêng tư', 5000),
      };
    }
    if (input.previewAcknowledged !== undefined) result.previewAcknowledged = Boolean(input.previewAcknowledged);
    return result;
  }

  private async syncDocuments(
    tx: any,
    businessId: string,
    actorId: string,
    documents: LegalDocumentInput[],
  ) {
    const duplicateTypes = documents
      .filter((item) => item.documentType !== 'OTHER')
      .map((item) => item.documentType);
    if (new Set(duplicateTypes).size !== duplicateTypes.length) {
      throw new BadRequestException('Mỗi loại giấy tờ chỉ được có một bản đang hiệu lực');
    }
    const mediaIds = documents.map((item) => item.mediaId).filter(Boolean) as string[];
    if (mediaIds.length) {
      const ownedMedia = await tx.mediaFile.count({
        where: {
          id: { in: mediaIds },
          businessId,
          entityType: 'LEGAL_DOCUMENT',
          visibility: 'PRIVATE',
        },
      });
      if (ownedMedia !== new Set(mediaIds).size) {
        throw new BadRequestException('Có giấy tờ không thuộc hồ sơ doanh nghiệp này');
      }
    }
    const existing = await tx.businessDocument.findMany({
      where: { businessId, status: { not: 'ARCHIVED' } },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const retained = new Set<string>();
    for (const input of documents) {
      const current = existing.find((item: any) =>
        !retained.has(item.id) && item.documentType === input.documentType);
      if (!current) {
        await tx.businessDocument.create({
          data: {
            businessId,
            documentType: input.documentType,
            documentNumber: input.documentNumber || null,
            expiresAt: input.expiresAt
              ? new Date(`${input.expiresAt}T00:00:00Z`)
              : null,
            status: 'DRAFT',
            versions: {
              create: {
                version: 1,
                mediaId: input.mediaId!,
                documentName: input.documentName,
                note: input.note || null,
                createdBy: actorId,
              },
            },
          },
        });
        continue;
      }
      retained.add(current.id);
      const latest = current.versions[0];
      const hasChanged =
        latest?.mediaId !== input.mediaId ||
        latest?.documentName !== input.documentName ||
        (latest?.note || '') !== (input.note || '');
      await tx.businessDocument.update({
        where: { id: current.id },
        data: {
          status: 'DRAFT',
          documentNumber: input.documentNumber || null,
          expiresAt: input.expiresAt
            ? new Date(`${input.expiresAt}T00:00:00Z`)
            : null,
          ...(hasChanged
            ? {
                currentVersion: { increment: 1 },
                versions: {
                  create: {
                    version: current.currentVersion + 1,
                    mediaId: input.mediaId!,
                    documentName: input.documentName,
                    note: input.note || null,
                    createdBy: actorId,
                  },
                },
              }
            : {}),
        },
      });
    }
    const removed = existing.filter((item: any) => !retained.has(item.id));
    if (removed.length) {
      await tx.businessDocument.updateMany({
        where: { id: { in: removed.map((item: any) => item.id) } },
        data: { status: 'ARCHIVED' },
      });
    }
  }

  async createDraft(user: AuthUser, input: BusinessDraftInput) {
    input = this.normalizeDraftInput(input);
    if (!input.name || input.name.length < 2 || !input.slug) {
      throw new BadRequestException('Nhập tên thương hiệu (ít nhất 2 ký tự) và đường dẫn trước khi lưu hồ sơ.');
    }
    const owner = await this.prisma.businessOwnerProfile.findUnique({
      where: { userId: user.id },
    });
    if (!owner) throw new ForbiddenException('Business owner profile not found');

    if (input.taxCode) {
      const taxCodeOwner = await this.prisma.businessOwnerProfile.findUnique({
        where: { taxCode: input.taxCode }, select: { id: true },
      });
      if (taxCodeOwner && taxCodeOwner.id !== owner.id) {
        throw new ConflictException('Mã số thuế này đã được sử dụng trong một hồ sơ khác.');
      }
    }

    const slugExists = await this.prisma.business.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (slugExists) throw new ConflictException('Đường dẫn BeautyBook đã được sử dụng. Hãy chọn đường dẫn khác.');

    try {
      return await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          ownerId: owner.id,
          name: input.name!,
          slug: input.slug!,
          description: input.description,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          addressLine: input.addressLine,
          legalRepresentative: input.legalRepresentative,
          legalDocuments: this.validateDocuments(input.legalDocuments) as any,
          onboardingStep: input.onboardingStep ?? 1,
          onboardingData: this.validateOnboardingData(input.onboardingData) as any,
          marketplacePreviewedAt: input.marketplacePreviewed ? new Date() : null,
          status: 'DRAFT',
        },
      });
      await tx.businessOwnerProfile.update({
        where: { id: owner.id },
        data: {
          companyName: input.companyName,
          taxCode: input.taxCode,
          identityCardNumber: input.identityCardNumber,
        },
      });
      const ownerRole = await tx.userRole.findFirst({
        where: { userId: user.id, role: { code: 'BUSINESS_OWNER' } },
      });
      if (ownerRole && !ownerRole.businessId) {
        await tx.userRole.update({
          where: { id: ownerRole.id },
          data: { businessId: business.id },
        });
      }
      const documents = this.validateDocuments(input.legalDocuments);
      if (documents.length) await this.syncDocuments(tx, business.id, user.id, documents);
      return business;
      });
    } catch (error) {
      this.throwFriendlyUniqueConflict(error);
    }
  }

  async updateDraft(
    businessId: string,
    user: AuthUser,
    input: BusinessDraftInput,
  ) {
    input = this.normalizeDraftInput(input);
    await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER']), businessId);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(business.status)) {
      throw new ConflictException('Chỉ hồ sơ draft/need-more-info mới được sửa');
    }
    if (input.taxCode) {
      const taxCodeOwner = await this.prisma.businessOwnerProfile.findUnique({
        where: { taxCode: input.taxCode }, select: { id: true },
      });
      if (taxCodeOwner && taxCodeOwner.id !== business.ownerId) {
        throw new ConflictException('Mã số thuế này đã được sử dụng trong một hồ sơ khác.');
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const current = await tx.business.findUnique({ where: { id: businessId }, select: { status: true, updatedAt: true } });
      if (!current || current.status !== business.status || current.updatedAt.getTime() !== business.updatedAt.getTime()) {
        throw new ConflictException('Hồ sơ vừa thay đổi; vui lòng tải lại');
      }
      if (input.taxCode !== undefined || input.companyName !== undefined || input.identityCardNumber !== undefined) {
        await tx.businessOwnerProfile.update({
          where: { id: business.ownerId },
          data: {
            companyName: input.companyName,
            taxCode: input.taxCode,
            identityCardNumber: input.identityCardNumber,
          },
        });
      }
      return tx.business.update({
        where: { id: businessId },
        data: {
          // These columns cannot be null. A temporarily empty form field must not
          // erase the last persisted value; submit validation still requires a brand.
          name: input.name ?? undefined,
          slug: input.slug ?? undefined,
          description: input.description,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          addressLine: input.addressLine,
          legalRepresentative: input.legalRepresentative,
          legalDocuments: input.legalDocuments === undefined ? undefined : this.validateDocuments(input.legalDocuments) as any,
          onboardingStep: input.onboardingStep === undefined
            ? undefined
            : this.validOnboardingStep(input.onboardingStep),
          onboardingData: this.validateOnboardingData(input.onboardingData) as any,
          marketplacePreviewedAt: input.marketplacePreviewed ? new Date() : undefined,
          reviewNote: null,
        },
      }).then(async (updated) => {
        if (input.legalDocuments !== undefined) {
          await this.syncDocuments(tx, businessId, user.id, this.validateDocuments(input.legalDocuments));
        }
        return updated;
      });
      });
    } catch (error) {
      this.throwFriendlyUniqueConflict(error);
    }
  }

  async submit(businessId: string, user: AuthUser) {
    await assertBusinessAccess(this.prisma, restrictToRoles(user, ['BUSINESS_OWNER']), businessId);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: { include: { user: { select: { isPhoneVerified: true } } } },
        documents: { where: { status: { not: 'ARCHIVED' } } },
      },
    });
    if (!business) throw new NotFoundException('Business not found');
    const businessName = assertSubmittableBusinessName(business.name);
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(business.status)) {
      throw new ConflictException('Hồ sơ không ở trạng thái có thể gửi');
    }
    const policy = await this.settings.getEffective();
    const onboarding = this.validateOnboardingData(business.onboardingData) ?? {};
    const documentTypes = new Set(business.documents.map((item) => item.documentType));
    const missing = [
      (!business.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.contactEmail)) && 'email liên hệ hợp lệ',
      (!business.contactPhone || !/^\+84\d{9}$/.test(business.contactPhone)) && 'số điện thoại Việt Nam hợp lệ',
      !business.addressLine?.trim() && 'địa chỉ đăng ký',
      (!business.legalRepresentative?.trim() || business.legalRepresentative.trim().length < 2) && 'tên người đại diện hợp lệ',
      (!business.owner.companyName?.trim() || business.owner.companyName.trim().length < 2) && 'tên pháp nhân hợp lệ',
      !business.owner.taxCode?.trim() && 'mã số thuế',
      !onboarding.businessType && 'loại hình dịch vụ',
      policy.requireIdVerification && !documentTypes.has('BUSINESS_LICENSE') && 'giấy phép kinh doanh đã tải lên',
      policy.requireIdVerification && !documentTypes.has('OWNER_ID_CARD') && 'giấy tờ người đại diện đã tải lên',
      policy.requirePhoneVerification && !business.owner.user.isPhoneVerified && 'xác minh số điện thoại tài khoản',
    ].filter(Boolean);
    if (missing.length) {
      throw new BadRequestException(`Hoàn thiện trước khi gửi hồ sơ: ${missing.join('; ')}.`);
    }
    const fromStatus = business.status;
    const nextStatus = policy.autoApproveNewSalons ? 'APPROVED' : 'PENDING_REVIEW';
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const current = await tx.business.findUnique({ where: { id: businessId }, select: { status: true, updatedAt: true } });
      if (!current || current.status !== fromStatus || current.updatedAt.getTime() !== business.updatedAt.getTime()) {
        throw new ConflictException('Hồ sơ vừa thay đổi; vui lòng tải lại');
      }
      const row = await tx.business.update({
        where: { id: businessId },
        data: { name: businessName, status: nextStatus, submittedAt: new Date(), reviewedAt: policy.autoApproveNewSalons ? new Date() : null, reviewNote: null },
      });
      await tx.businessReviewEvent.create({ data: {
        businessId, actorId: user.id, action: fromStatus === 'NEED_MORE_INFO' ? 'RESUBMIT' : policy.autoApproveNewSalons ? 'AUTO_APPROVE' : 'SUBMIT',
        fromStatus, toStatus: nextStatus,
      } });
      for (const document of business.documents) {
        await tx.businessDocument.update({
          where: { id: document.id },
          data: { status: 'SUBMITTED' },
        });
        await tx.documentReviewEvent.create({ data: {
          documentId: document.id,
          actorId: user.id,
          action: 'SUBMIT',
          fromStatus: document.status,
          toStatus: 'SUBMITTED',
        } });
      }
      return row;
    });
    await auditLog(this.prisma, { userId: user.id, action: 'STATUS_CHANGE', entityType: 'BusinessOnboarding', entityId: businessId, oldData: { status: fromStatus }, newData: { status: nextStatus }, reason: fromStatus === 'NEED_MORE_INFO' ? 'Gửi lại hồ sơ sau bổ sung' : 'Gửi hồ sơ xét duyệt' });
    return updated;
  }

  async review(
    businessId: string,
    decision: 'APPROVE' | 'REQUEST_INFO' | 'REJECT',
    note: string | undefined,
    actorId: string,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { documents: { where: { status: { not: 'ARCHIVED' } } } },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (business.status !== 'PENDING_REVIEW') {
      throw new ConflictException('Business không chờ review');
    }
    if (decision !== 'APPROVE' && !note) {
      throw new BadRequestException('Cần ghi rõ lý do');
    }
    const status = decision === 'APPROVE'
      ? 'APPROVED'
      : decision === 'REQUEST_INFO'
        ? 'NEED_MORE_INFO'
        : 'REJECTED';
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.business.updateMany({
        where: { id: businessId, status: 'PENDING_REVIEW', updatedAt: business.updatedAt },
        data: { status, reviewNote: note?.trim() || null, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Hồ sơ vừa được xử lý; vui lòng tải lại');
      const row = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
      await tx.businessReviewEvent.create({ data: {
        businessId, actorId, action: decision, fromStatus: business.status, toStatus: status, reason: note?.trim() || null,
      } });
      const documentStatus = decision === 'APPROVE'
        ? 'APPROVED'
        : decision === 'REQUEST_INFO'
          ? 'NEED_MORE_INFO'
          : 'REJECTED';
      const documentAction = decision === 'APPROVE'
        ? 'APPROVE'
        : decision === 'REQUEST_INFO'
          ? 'REQUEST_INFO'
          : 'REJECT';
      for (const document of business.documents) {
        const documentChanged = await tx.businessDocument.updateMany({
          where: { id: document.id, status: document.status },
          data: { status: documentStatus },
        });
        if (documentChanged.count !== 1) throw new ConflictException('Tài liệu vừa được cập nhật; vui lòng tải lại');
        await tx.documentReviewEvent.create({ data: {
          documentId: document.id,
          actorId,
          action: documentAction,
          fromStatus: document.status,
          toStatus: documentStatus,
          reason: note?.trim() || null,
        } });
      }
      return row;
    });
    await auditLog(this.prisma, { userId: actorId, action: 'STATUS_CHANGE', entityType: 'BusinessOnboarding', entityId: businessId, oldData: { status: business.status }, newData: { status }, reason: note?.trim() || `Hồ sơ ${decision.toLowerCase()}` });
    return updated;
  }

  async findMine(user: AuthUser) {
    const owner = await this.prisma.businessOwnerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!owner) throw new NotFoundException('Không tìm thấy hồ sơ chủ doanh nghiệp');
    const business = await this.prisma.business.findFirst({
      where: { ownerId: owner.id, deletedAt: null },
      include: {
        owner: { select: { id: true, userId: true, companyName: true, taxCode: true, identityCardNumber: true } },
        branches: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
            reviewStatus: true,
            operationalStatus: true,
            reviewNote: true,
            onboardingProgress: {
              select: { currentStep: true, completedSteps: true, updatedAt: true },
            },
          },
        },
        reviewEvents: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { fullName: true } } } },
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { createdAt: 'asc' },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              include: { media: { select: { id: true, originalName: true, mimeType: true, fileSize: true, url: true } } },
            },
            reviewEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!business) return null;
    const legalDocuments = business.documents.map((document) => {
      const version = document.versions[0];
      return {
        id: document.id,
        documentType: document.documentType,
        documentName: version?.documentName ?? document.documentType,
        documentNumber: document.documentNumber ?? '',
        expiresAt: document.expiresAt?.toISOString().slice(0, 10) ?? '',
        documentUrl: version?.mediaId ? `/api/v1/media/${version.mediaId}/content` : '',
        mediaId: version?.mediaId ?? '',
        media: version?.media ?? null,
        note: version?.note ?? '',
        status: document.status,
        currentVersion: document.currentVersion,
        reviewEvents: document.reviewEvents,
      };
    });
    return { ...business, legalDocuments, checklist: await this.checklist(business.id) };
  }

  private validOnboardingStep(value: number) {
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Bước onboarding không hợp lệ');
    }
    return Math.max(1, Math.min(10, Math.trunc(value)));
  }

  async checklist(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        contactEmail: true,
        contactPhone: true,
        addressLine: true,
        legalRepresentative: true,
        onboardingData: true,
        status: true,
        owner: { select: { companyName: true, taxCode: true } },
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          select: { documentType: true, status: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { mediaId: true } } },
        },
      },
    });
    if (!business) return [];
    const types = new Set(business.documents.filter((document) => document.versions[0]?.mediaId).map((document) => document.documentType));
    let validName = false;
    try { assertSubmittableBusinessName(business.name); validName = true; } catch { /* Incomplete drafts are expected. */ }
    const onboarding = business.onboardingData as OnboardingDraft | null;
    const legalComplete = Boolean(
      validName &&
      activeBusinessTypeCodes().has(onboarding?.businessType as (typeof BUSINESS_TYPE_CATALOG)[number]['code']) &&
      business.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.contactEmail) &&
      business.contactPhone && /^\+84\d{9}$/.test(business.contactPhone) &&
      business.addressLine?.trim() &&
      (business.legalRepresentative?.trim().length ?? 0) >= 2 &&
      (business.owner.companyName?.trim().length ?? 0) >= 2 &&
      business.owner.taxCode?.trim(),
    );
    return [
      { key: 'business', label: 'Hoàn tất thông tin doanh nghiệp và pháp nhân', completed: legalComplete },
      { key: 'license', label: 'Đính kèm giấy phép kinh doanh', completed: types.has('BUSINESS_LICENSE') },
      { key: 'identity', label: 'Đính kèm giấy tờ chủ sở hữu', completed: types.has('OWNER_ID_CARD') },
      { key: 'submitted', label: 'Gửi hồ sơ xác minh', completed: !['DRAFT', 'NEED_MORE_INFO'].includes(business.status) },
      { key: 'verified', label: 'Doanh nghiệp được xác minh', completed: ['APPROVED', 'ACTIVE'].includes(business.status) },
    ];
  }
}
