import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { auditLog } from '../common/utils/audit';

export interface BusinessDraftInput {
  name?: string;
  slug?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  legalRepresentative?: string;
  legalDocuments?: unknown;
  companyName?: string;
  taxCode?: string;
  identityCardNumber?: string;
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

  private validateDocuments(value: unknown): LegalDocumentInput[] {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('Danh sách giấy tờ không hợp lệ');
    const types = new Set(['BUSINESS_LICENSE', 'OWNER_ID_CARD', 'TAX_DOCUMENT', 'OTHER']);
    return value.map((item, index) => {
      const document = item as Partial<LegalDocumentInput>;
      if (!document || !types.has(String(document.documentType)) || !document.documentName?.trim() || !document.documentUrl?.trim()) {
        throw new BadRequestException(`Giấy tờ số ${index + 1} cần đủ loại, tên và URL`);
      }
      const documentUrl = document.documentUrl.trim();
      if (!document.mediaId) {
        throw new BadRequestException(`Giấy tờ số ${index + 1} phải được tải lên hệ thống`);
      }
      if (!documentUrl.startsWith('/api/v1/media/') && !documentUrl.startsWith('http://') && !documentUrl.startsWith('https://')) {
        throw new BadRequestException(`Đường dẫn giấy tờ số ${index + 1} không hợp lệ`);
      }
      const expiresAt = document.expiresAt?.trim();
      if (expiresAt && Number.isNaN(new Date(`${expiresAt}T00:00:00Z`).getTime())) {
        throw new BadRequestException(`Ngày hết hạn giấy tờ số ${index + 1} không hợp lệ`);
      }
      return {
        ...document,
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
      const allowed = new Set(['HAIR_SALON', 'SPA', 'NAIL', 'BARBER', 'MAKEUP', 'MASSAGE', 'BEAUTY_STUDIO', 'MOBILE_SERVICE']);
      if (!allowed.has(String(input.businessType))) throw new BadRequestException('Loại hình doanh nghiệp không hợp lệ');
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
    if (!input.name || !input.slug) {
      throw new BadRequestException('name và slug là bắt buộc');
    }
    const owner = await this.prisma.businessOwnerProfile.findUnique({
      where: { userId: user.id },
    });
    if (!owner) throw new ForbiddenException('Business owner profile not found');

    const slugExists = await this.prisma.business.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (slugExists) throw new ConflictException('Slug đã được sử dụng');

    return this.prisma.$transaction(async (tx) => {
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
  }

  async updateDraft(
    businessId: string,
    user: AuthUser,
    input: BusinessDraftInput,
  ) {
    await assertBusinessAccess(this.prisma, user, businessId);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(business.status)) {
      throw new ConflictException('Chỉ hồ sơ draft/need-more-info mới được sửa');
    }
    return this.prisma.$transaction(async (tx) => {
      if (input.taxCode || input.companyName || input.identityCardNumber) {
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
          name: input.name,
          slug: input.slug,
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
  }

  async submit(businessId: string, user: AuthUser) {
    await assertBusinessAccess(this.prisma, user, businessId);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: { include: { user: { select: { isPhoneVerified: true } } } },
        documents: { where: { status: { not: 'ARCHIVED' } } },
      },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(business.status)) {
      throw new ConflictException('Hồ sơ không ở trạng thái có thể gửi');
    }
    const policy = await this.settings.getEffective();
    const onboarding = this.validateOnboardingData(business.onboardingData) ?? {};
    const documentTypes = new Set(business.documents.map((item) => item.documentType));
    const missing = [
      (!business.name || business.name.startsWith('Hồ sơ cơ sở của ')) && 'name',
      !business.contactEmail && 'contactEmail',
      !business.contactPhone && 'contactPhone',
      !business.addressLine && 'addressLine',
      !business.legalRepresentative && 'legalRepresentative',
      !business.owner.companyName && 'companyName',
      !business.owner.taxCode && 'taxCode',
      !onboarding.businessType && 'businessType',
      policy.requireIdVerification && !documentTypes.has('BUSINESS_LICENSE') && 'BUSINESS_LICENSE',
      policy.requireIdVerification && !documentTypes.has('OWNER_ID_CARD') && 'OWNER_ID_CARD',
      policy.requirePhoneVerification && !business.owner.user.isPhoneVerified && 'phoneVerification',
    ].filter(Boolean);
    if (missing.length) {
      throw new BadRequestException(`Thiếu thông tin: ${missing.join(', ')}`);
    }
    const fromStatus = business.status;
    const nextStatus = policy.autoApproveNewSalons ? 'APPROVED' : 'PENDING_REVIEW';
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.business.update({
        where: { id: businessId },
        data: { status: nextStatus, submittedAt: new Date(), reviewedAt: policy.autoApproveNewSalons ? new Date() : null, reviewNote: null },
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
      const row = await tx.business.update({
        where: { id: businessId },
        data: { status, reviewNote: note?.trim() || null, reviewedAt: new Date() },
      });
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
        await tx.businessDocument.update({
          where: { id: document.id },
          data: { status: documentStatus },
        });
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
        status: true,
        owner: { select: { companyName: true, taxCode: true } },
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          select: { documentType: true, status: true },
        },
      },
    });
    if (!business) return [];
    const types = new Set(business.documents.map((document) => document.documentType));
    const legalComplete = Boolean(
      business.name &&
      business.contactEmail &&
      business.contactPhone &&
      business.addressLine &&
      business.legalRepresentative &&
      business.owner.companyName &&
      business.owner.taxCode,
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
