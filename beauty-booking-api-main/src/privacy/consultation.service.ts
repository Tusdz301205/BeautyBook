import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsultationFieldType,
  Prisma,
  SensitiveAnswerValueType,
  SensitiveDataField,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBusinessAccess,
} from '../common/utils/multi-tenancy';
import { can } from '../common/utils/policy';
import { auditLog } from '../common/utils/audit';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBreakGlassGrantDto,
  CreateConsultationTemplateDto,
  CreateConsultationVersionDto,
  RevokeConsultationConsentDto,
  SetConsultationRequirementDto,
  SubmitConsultationDto,
} from './dto/privacy.dto';
import { SensitiveDataCipherService } from './sensitive-data-cipher.service';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  purpose?: string;
};

type FieldDefinition = CreateConsultationVersionDto['fields'][number];

@Injectable()
export class ConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SensitiveDataCipherService,
  ) {}

  async requirementsForBooking(bookingId: string, user: AuthUser) {
    const booking = await this.customerBooking(bookingId, user);
    const serviceIds = [
      ...new Set(booking.bookingServices.map((item) => item.serviceId)),
    ];
    const requirements =
      await this.prisma.serviceConsultationRequirement.findMany({
        where: { serviceId: { in: serviceIds } },
        include: {
          service: { select: { id: true, name: true } },
          template: {
            include: {
              versions: {
                where: { publishedAt: { not: null } },
                orderBy: { version: 'desc' },
                take: 1,
                include: { fields: { orderBy: { sortOrder: 'asc' } } },
              },
            },
          },
        },
      });
    const submissions = await this.prisma.consultationSubmission.findMany({
      where: { bookingId, customerId: booking.customerId },
      select: {
        id: true,
        serviceId: true,
        status: true,
        requiresReview: true,
        submittedAt: true,
      },
    });
    const submissionByService = new Map(
      submissions.map((submission) => [submission.serviceId, submission]),
    );

    return requirements.map((requirement) => {
      const version = requirement.template.versions[0];
      return {
        service: requirement.service,
        required: requirement.required,
        timing: requirement.timing,
        template: version
          ? {
              id: requirement.template.id,
              name: requirement.template.name,
              description: requirement.template.description,
              versionId: version.id,
              version: version.version,
              noticeVersion: version.noticeVersion,
              noticeHash: version.noticeHash,
              noticeContent: version.noticeContent,
              purpose: version.purpose,
              recipientDescription: version.recipientDescription,
              retentionDays: version.retentionDays,
              fields: version.fields.map((field) => ({
                id: field.id,
                fieldKey: field.fieldKey,
                label: field.label,
                description: field.description,
                fieldType: field.fieldType,
                dataCategory: field.dataCategory,
                required: field.required,
                options: field.options,
                maxLength: field.maxLength,
                sortOrder: field.sortOrder,
              })),
            }
          : null,
        submission: submissionByService.get(requirement.serviceId) ?? null,
      };
    });
  }

  async bookingConsultationStatus(bookingId: string, user: AuthUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        branchId: true,
        branch: { select: { businessId: true } },
        bookingServices: {
          select: {
            serviceId: true,
            service: { select: { name: true } },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy lịch hẹn');
    const context = {
      tenantId: booking.branch.businessId,
      branchId: booking.branchId,
    };
    if (!can(user, 'consultation:status:branch', context)) {
      throw new ForbiddenException(
        'Bạn không có quyền xem trạng thái tư vấn của lịch hẹn này',
      );
    }
    await assertBusinessAccess(this.prisma, user, booking.branch.businessId);
    const serviceIds = booking.bookingServices.map((item) => item.serviceId);
    const [requirements, submissions] = await Promise.all([
      this.prisma.serviceConsultationRequirement.findMany({
        where: { serviceId: { in: serviceIds } },
        select: {
          serviceId: true,
          required: true,
          timing: true,
        },
      }),
      this.prisma.consultationSubmission.findMany({
        where: { bookingId },
        select: {
          id: true,
          serviceId: true,
          status: true,
          requiresReview: true,
          submittedAt: true,
        },
      }),
    ]);
    const requirementByService = new Map(
      requirements.map((item) => [item.serviceId, item]),
    );
    const submissionByService = new Map(
      submissions.map((item) => [item.serviceId, item]),
    );
    return booking.bookingServices.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      requirement: requirementByService.get(item.serviceId) ?? null,
      submission: submissionByService.get(item.serviceId) ?? null,
    }));
  }

  async submit(
    bookingId: string,
    input: SubmitConsultationDto,
    user: AuthUser,
    metadata: RequestMetadata,
  ) {
    const booking = await this.customerBooking(bookingId, user);
    if (!['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
      throw new BadRequestException(
        'Không thể gửi biểu mẫu tư vấn cho lịch hẹn đã kết thúc',
      );
    }
    const bookingService = booking.bookingServices.find(
      (item) => item.serviceId === input.serviceId,
    );
    if (!bookingService) {
      throw new BadRequestException(
        'Dịch vụ không thuộc lịch hẹn của khách hàng',
      );
    }
    const requirement =
      await this.prisma.serviceConsultationRequirement.findUnique({
        where: { serviceId: input.serviceId },
        include: {
          template: {
            include: {
              versions: {
                where: { publishedAt: { not: null } },
                orderBy: { version: 'desc' },
                take: 1,
                include: { fields: { orderBy: { sortOrder: 'asc' } } },
              },
            },
          },
        },
      });
    const version = requirement?.template.versions[0];
    if (!requirement || !version) {
      throw new BadRequestException(
        'Dịch vụ chưa có biểu mẫu tư vấn đã được xuất bản',
      );
    }
    if (version.noticeHash !== input.noticeHash) {
      throw new ConflictException(
        'Thông báo quyền riêng tư đã thay đổi; vui lòng đọc và xác nhận lại',
      );
    }

    const prepared = this.validateAndEncryptAnswers(
      version.fields,
      input.answers,
    );
    const submittedAt = new Date();
    const retentionUntil = new Date(
      submittedAt.getTime() + version.retentionDays * 86_400_000,
    );
    const consentExpiresAt = this.consentExpiry(
      booking.appointmentDate,
      booking.appointmentEndTime,
      retentionUntil,
    );
    const assignedStaff = [
      ...new Map(
        booking.bookingServices
          .filter(
            (item) =>
              item.serviceId === input.serviceId &&
              item.staff?.id &&
              item.staff.userId,
          )
          .map((item) => [item.staff!.id, item.staff!]),
      ).values(),
    ];

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.consultationSubmission.findUnique({
            where: {
              bookingId_serviceId: {
                bookingId,
                serviceId: input.serviceId,
              },
            },
            select: { id: true },
          });
          if (existing) {
            throw new ConflictException(
              'Biểu mẫu đã được gửi; dữ liệu đã gửi là bản ghi bất biến',
            );
          }
          const submission = await tx.consultationSubmission.create({
            data: {
              customerId: booking.customerId,
              businessId: booking.branch.businessId,
              branchId: booking.branchId,
              bookingId,
              serviceId: input.serviceId,
              versionId: version.id,
              status: 'SUBMITTED',
              requiresReview: prepared.some(
                (answer) => answer.field.dataCategory !== null,
              ),
              submittedAt,
              retentionUntil,
            },
          });
          await tx.sensitiveAnswer.createMany({
            data: prepared.map((answer) => ({
              submissionId: submission.id,
              fieldId: answer.field.id,
              dataCategory: answer.field.dataCategory,
              valueType: answer.valueType,
              ...answer.encrypted,
            })),
          });
          const sensitiveFields = prepared.filter(
            (answer) => answer.field.dataCategory !== null,
          );
          const recipients =
            assignedStaff.length > 0
              ? assignedStaff.map((staff) => ({
                  type: 'ASSIGNED_STAFF' as const,
                  recipientId: staff.userId,
                  assignedStaffId: staff.id,
                }))
              : [
                  {
                    type: 'BRANCH_SPECIALIST' as const,
                    recipientId: booking.branchId,
                    assignedStaffId: null,
                  },
                ];
          if (sensitiveFields.length > 0) {
            await tx.consentEvent.createMany({
              data: sensitiveFields.flatMap((answer) =>
                recipients.map((recipient) => ({
                  customerId: booking.customerId,
                  businessId: booking.branch.businessId,
                  branchId: booking.branchId,
                  bookingId,
                  serviceId: input.serviceId,
                  submissionId: submission.id,
                  fieldId: answer.field.id,
                  dataCategory: answer.field.dataCategory,
                  action: 'GRANTED' as const,
                  purpose: version.purpose,
                  recipientType: recipient.type,
                  recipientId: recipient.recipientId,
                  assignedStaffId: recipient.assignedStaffId,
                  noticeVersion: version.noticeVersion,
                  noticeHash: version.noticeHash,
                  expiresAt: consentExpiresAt,
                  ipAddress: metadata.ipAddress?.slice(0, 100),
                  userAgent: metadata.userAgent?.slice(0, 500),
                })),
              ),
            });
          }
          return {
            id: submission.id,
            status: submission.status,
            requiresReview: submission.requiresReview,
            submittedAt: submission.submittedAt,
            retentionUntil: submission.retentionUntil,
            grantedRecipientCount: recipients.length,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Biểu mẫu đã được gửi cho dịch vụ trong lịch hẹn này',
        );
      }
      throw error;
    }
  }

  async readSubmission(
    submissionId: string,
    user: AuthUser,
    metadata: RequestMetadata,
  ) {
    const submission = await this.prisma.consultationSubmission.findUnique({
      where: { id: submissionId },
      include: {
        customer: { select: { userId: true } },
        version: {
          select: {
            version: true,
            noticeVersion: true,
            noticeHash: true,
            purpose: true,
          },
        },
        booking: {
          select: {
            status: true,
            appointmentDate: true,
            appointmentStartTime: true,
            appointmentEndTime: true,
          },
        },
        service: { select: { name: true } },
        answers: {
          include: {
            field: {
              select: {
                id: true,
                fieldKey: true,
                label: true,
                fieldType: true,
                dataCategory: true,
              },
            },
          },
          orderBy: { field: { sortOrder: 'asc' } },
        },
        consentEvents: {
          where: { action: 'GRANTED' },
          include: { revokedBy: { select: { id: true, createdAt: true } } },
        },
      },
    });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy biểu mẫu tư vấn');
    }

    const decision = await this.readDecision(submission, user);
    await this.logSensitiveAccess(
      submission,
      user,
      decision.result,
      metadata,
      decision.breakGlassGrantId,
    );
    const metadataResult = {
      id: submission.id,
      bookingId: submission.bookingId,
      serviceId: submission.serviceId,
      serviceName: submission.service.name,
      status: submission.status,
      requiresReview: submission.requiresReview,
      submittedAt: submission.submittedAt,
      retentionUntil: submission.retentionUntil,
      noticeVersion: submission.version.noticeVersion,
      noticeHash: submission.version.noticeHash,
    };
    if (decision.result === 'REDACTED') {
      return {
        ...metadataResult,
        contentAccess: 'REDACTED',
        answers: [],
      };
    }
    if (decision.result === 'DENIED') {
      throw new ForbiddenException(
        'Bạn không được phép xem nội dung tư vấn nhạy cảm này',
      );
    }
    return {
      ...metadataResult,
      contentAccess: 'GRANTED',
      answers: submission.answers.map((answer) => ({
        fieldKey: answer.field.fieldKey,
        label: answer.field.label,
        fieldType: answer.field.fieldType,
        dataCategory: answer.field.dataCategory,
        value: this.cipher.decrypt({
          valueCiphertext: answer.valueCiphertext,
          encryptionIv: answer.encryptionIv,
          authenticationTag: answer.authenticationTag,
          keyVersion: answer.keyVersion,
        }),
      })),
    };
  }

  async revokeConsent(
    input: RevokeConsultationConsentDto,
    user: AuthUser,
    metadata: RequestMetadata,
  ) {
    const grant = await this.prisma.consentEvent.findUnique({
      where: { id: input.grantEventId },
      include: {
        customer: { select: { userId: true } },
        revokedBy: { select: { id: true } },
      },
    });
    if (!grant || grant.action !== 'GRANTED') {
      throw new NotFoundException('Không tìm thấy lần cấp quyền');
    }
    if (grant.customer.userId !== user.id) {
      throw new ForbiddenException('Chỉ khách hàng sở hữu dữ liệu được thu hồi');
    }
    if (grant.revokedBy) {
      throw new ConflictException('Quyền chia sẻ này đã được thu hồi');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const revoke = await tx.consentEvent.create({
          data: {
            customerId: grant.customerId,
            businessId: grant.businessId,
            branchId: grant.branchId,
            bookingId: grant.bookingId,
            serviceId: grant.serviceId,
            submissionId: grant.submissionId,
            fieldId: grant.fieldId,
            dataCategory: grant.dataCategory,
            action: 'REVOKED',
            purpose: grant.purpose,
            recipientType: grant.recipientType,
            recipientId: grant.recipientId,
            assignedStaffId: grant.assignedStaffId,
            noticeVersion: grant.noticeVersion,
            noticeHash: grant.noticeHash,
            expiresAt: grant.expiresAt,
            revokeOfEventId: grant.id,
            ipAddress: metadata.ipAddress?.slice(0, 100),
            userAgent: metadata.userAgent?.slice(0, 500),
          },
        });
        const active = await tx.consentEvent.count({
          where: {
            submissionId: grant.submissionId,
            action: 'GRANTED',
            expiresAt: { gt: new Date() },
            revokedBy: null,
          },
        });
        if (active === 0) {
          await tx.consultationSubmission.update({
            where: { id: grant.submissionId },
            data: { status: 'REVOKED' },
          });
        }
        return {
          id: revoke.id,
          grantEventId: grant.id,
          revokedAt: revoke.createdAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createBreakGlassGrant(
    input: CreateBreakGlassGrantDto,
    user: AuthUser,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: input.bookingId, deletedAt: null },
      select: {
        id: true,
        branchId: true,
        branch: { select: { businessId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy lịch hẹn');
    const context = {
      tenantId: booking.branch.businessId,
      branchId: booking.branchId,
    };
    const branchAllowed = can(
      user,
      'health_record:break_glass:branch',
      context,
    );
    const platformAllowed =
      can(user, 'health_record:break_glass:platform', context) ||
      (user.permissions ?? []).includes(
        'health_record:break_glass:platform',
      );
    if (!branchAllowed && !platformAllowed) {
      throw new ForbiddenException(
        'Tài khoản không có quyền break-glass cho dữ liệu nhạy cảm',
      );
    }
    if (!platformAllowed) {
      await assertBusinessAccess(
        this.prisma,
        user,
        booking.branch.businessId,
      );
    }
    const expiresAt = new Date(
      Date.now() + input.durationMinutes * 60_000,
    );
    const grant = await this.prisma.sensitiveBreakGlassGrant.create({
      data: {
        actorId: user.id,
        businessId: booking.branch.businessId,
        branchId: booking.branchId,
        bookingId: booking.id,
        reason: input.reason,
        explanation: input.explanation.trim(),
        grantedBy: user.id,
        expiresAt,
      },
      select: {
        id: true,
        bookingId: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'CREATE',
      entityType: 'SensitiveBreakGlassGrant',
      entityId: grant.id,
      newData: {
        bookingId: grant.bookingId,
        reason: grant.reason,
        expiresAt: grant.expiresAt,
      },
      reason: input.explanation.trim(),
    });
    return grant;
  }

  async listTemplates(user: AuthUser, businessId: string) {
    await assertBusinessAccess(this.prisma, user, businessId);
    if (
      !can(user, 'consultation:template:manage:tenant', {
        tenantId: businessId,
      }) &&
      !can(user, 'consultation:template:manage:branch')
    ) {
      throw new ForbiddenException('Không có quyền quản lý biểu mẫu tư vấn');
    }
    const branchIds = new Set(
      user.scopes
        .filter((scope) => scope.businessId === businessId && scope.branchId)
        .map((scope) => scope.branchId as string),
    );
    const tenantWide = can(user, 'consultation:template:manage:tenant', {
      tenantId: businessId,
    });
    return this.prisma.consultationFormTemplate.findMany({
      where: {
        businessId,
        ...(tenantWide
          ? {}
          : { branchId: { in: [...branchIds] } }),
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            noticeVersion: true,
            noticeHash: true,
            publishedAt: true,
            createdAt: true,
          },
        },
        requirements: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(
    input: CreateConsultationTemplateDto,
    user: AuthUser,
  ) {
    await this.assertTemplateManagement(
      user,
      input.businessId,
      input.branchId,
    );
    await this.assertBranchBelongsToBusiness(
      input.branchId,
      input.businessId,
    );
    this.validateFieldDefinitions(input.fields);
    return this.prisma.$transaction(
      async (tx) => {
        const template = await tx.consultationFormTemplate.create({
          data: {
            businessId: input.businessId,
            branchId: input.branchId,
            name: input.name.trim(),
            description: input.description?.trim(),
            createdBy: user.id,
          },
        });
        const version = await this.createVersionRecord(
          tx,
          template.id,
          1,
          input,
        );
        return { ...template, versions: [version] };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createVersion(
    templateId: string,
    input: CreateConsultationVersionDto,
    user: AuthUser,
  ) {
    const template = await this.templateForManagement(templateId, user);
    this.validateFieldDefinitions(input.fields);
    return this.prisma.$transaction(
      async (tx) => {
        const latest = await tx.consultationFormVersion.findFirst({
          where: { templateId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        return this.createVersionRecord(
          tx,
          template.id,
          (latest?.version ?? 0) + 1,
          input,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async publishVersion(
    templateId: string,
    versionId: string,
    user: AuthUser,
  ) {
    await this.templateForManagement(templateId, user);
    const version = await this.prisma.consultationFormVersion.findFirst({
      where: { id: versionId, templateId },
      select: { id: true, publishedAt: true },
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');
    if (version.publishedAt) {
      return { id: version.id, publishedAt: version.publishedAt };
    }
    return this.prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      const published = await tx.consultationFormVersion.update({
        where: { id: versionId },
        data: { publishedAt },
        select: {
          id: true,
          version: true,
          noticeVersion: true,
          noticeHash: true,
          publishedAt: true,
        },
      });
      await tx.consultationFormTemplate.update({
        where: { id: templateId },
        data: { status: 'PUBLISHED' },
      });
      return published;
    });
  }

  async setRequirement(
    input: SetConsultationRequirementDto,
    user: AuthUser,
  ) {
    const [service, template] = await Promise.all([
      this.prisma.branchServiceOffering.findFirst({
        where: { id: input.serviceId, deletedAt: null },
        select: {
          id: true,
          branchId: true,
          branch: { select: { businessId: true } },
        },
      }),
      this.prisma.consultationFormTemplate.findUnique({
        where: { id: input.templateId },
        select: {
          id: true,
          businessId: true,
          branchId: true,
          status: true,
          versions: {
            where: { publishedAt: { not: null } },
            take: 1,
            select: { id: true },
          },
        },
      }),
    ]);
    if (!service || !template) {
      throw new NotFoundException('Không tìm thấy dịch vụ hoặc biểu mẫu');
    }
    if (
      template.businessId !== service.branch.businessId ||
      (template.branchId && template.branchId !== service.branchId)
    ) {
      throw new BadRequestException(
        'Biểu mẫu và dịch vụ phải thuộc cùng doanh nghiệp/phạm vi chi nhánh',
      );
    }
    if (template.status !== 'PUBLISHED' || template.versions.length === 0) {
      throw new BadRequestException(
        'Chỉ có thể gắn biểu mẫu đã được xuất bản',
      );
    }
    await this.assertTemplateManagement(
      user,
      template.businessId,
      service.branchId,
    );
    return this.prisma.serviceConsultationRequirement.upsert({
      where: { serviceId: service.id },
      create: {
        serviceId: service.id,
        templateId: template.id,
        required: input.required,
        timing: input.timing,
      },
      update: {
        templateId: template.id,
        required: input.required,
        timing: input.timing,
      },
    });
  }

  async aggregate(user: AuthUser, businessId: string) {
    const context = { tenantId: businessId };
    if (!can(user, 'consultation:aggregate:tenant', context)) {
      throw new ForbiddenException(
        'Chủ doanh nghiệp chỉ được xem số liệu tổng hợp trong tenant của mình',
      );
    }
    await assertBusinessAccess(this.prisma, user, businessId);
    const [total, submitted, revoked, reviewRequired, byBranch] =
      await Promise.all([
        this.prisma.consultationSubmission.count({ where: { businessId } }),
        this.prisma.consultationSubmission.count({
          where: { businessId, status: 'SUBMITTED' },
        }),
        this.prisma.consultationSubmission.count({
          where: { businessId, status: 'REVOKED' },
        }),
        this.prisma.consultationSubmission.count({
          where: { businessId, requiresReview: true },
        }),
        this.prisma.consultationSubmission.groupBy({
          by: ['branchId', 'status'],
          where: { businessId },
          _count: { _all: true },
        }),
      ]);
    return { total, submitted, revoked, reviewRequired, byBranch };
  }

  private async customerBooking(bookingId: string, user: AuthUser) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
        customer: { userId: user.id },
      },
      select: {
        id: true,
        customerId: true,
        branchId: true,
        status: true,
        appointmentDate: true,
        appointmentEndTime: true,
        branch: { select: { businessId: true } },
        bookingServices: {
          select: {
            serviceId: true,
            staff: { select: { id: true, userId: true } },
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(
        'Không tìm thấy lịch hẹn thuộc tài khoản khách hàng',
      );
    }
    if (
      !can(user, 'consultation:submit:self', { ownerId: user.id }) &&
      !can(user, 'consultation:read:self', { ownerId: user.id })
    ) {
      throw new ForbiddenException('Không có quyền truy cập tư vấn cá nhân');
    }
    return booking;
  }

  private validateAndEncryptAnswers(
    fields: Array<{
      id: string;
      fieldKey: string;
      fieldType: ConsultationFieldType;
      dataCategory: SensitiveDataField | null;
      required: boolean;
      options: Prisma.JsonValue | null;
      maxLength: number | null;
    }>,
    answers: SubmitConsultationDto['answers'],
  ) {
    const answerByKey = new Map<string, unknown>();
    for (const answer of answers) {
      if (answerByKey.has(answer.fieldKey)) {
        throw new BadRequestException(
          `Trường ${answer.fieldKey} bị gửi lặp lại`,
        );
      }
      answerByKey.set(answer.fieldKey, answer.value);
    }
    const knownKeys = new Set(fields.map((field) => field.fieldKey));
    for (const key of answerByKey.keys()) {
      if (!knownKeys.has(key)) {
        throw new BadRequestException(`Trường không được phép: ${key}`);
      }
    }
    return fields.flatMap((field) => {
      const supplied = answerByKey.has(field.fieldKey);
      if (field.required && !supplied) {
        throw new BadRequestException(
          `Thiếu trường bắt buộc: ${field.fieldKey}`,
        );
      }
      if (!supplied) return [];
      const value = this.validateFieldValue(field, answerByKey.get(field.fieldKey));
      return [
        {
          field,
          valueType: this.valueType(field.fieldType),
          encrypted: this.cipher.encrypt(value),
        },
      ];
    });
  }

  private validateFieldValue(
    field: {
      fieldKey: string;
      fieldType: ConsultationFieldType;
      options: Prisma.JsonValue | null;
      maxLength: number | null;
      required: boolean;
    },
    raw: unknown,
  ): unknown {
    const options = Array.isArray(field.options)
      ? field.options.filter((item): item is string => typeof item === 'string')
      : [];
    if (field.fieldType === 'BOOLEAN') {
      if (typeof raw !== 'boolean') {
        throw new BadRequestException(`${field.fieldKey} phải là boolean`);
      }
      return raw;
    }
    if (field.fieldType === 'MULTI_SELECT') {
      if (
        !Array.isArray(raw) ||
        raw.length > 20 ||
        raw.some((item) => typeof item !== 'string' || !options.includes(item))
      ) {
        throw new BadRequestException(
          `${field.fieldKey} chứa lựa chọn không hợp lệ`,
        );
      }
      return [...new Set(raw)];
    }
    if (typeof raw !== 'string') {
      throw new BadRequestException(`${field.fieldKey} phải là chuỗi`);
    }
    const value = raw.trim();
    if (field.required && value.length === 0) {
      throw new BadRequestException(`${field.fieldKey} không được để trống`);
    }
    if (value.length > (field.maxLength ?? 4000)) {
      throw new BadRequestException(`${field.fieldKey} vượt độ dài cho phép`);
    }
    if (field.fieldType === 'SINGLE_SELECT' && !options.includes(value)) {
      throw new BadRequestException(
        `${field.fieldKey} chứa lựa chọn không hợp lệ`,
      );
    }
    if (field.fieldType === 'DATE') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException(`${field.fieldKey} phải có dạng YYYY-MM-DD`);
      }
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
      ) {
        throw new BadRequestException(`${field.fieldKey} không phải ngày hợp lệ`);
      }
    }
    return value;
  }

  private valueType(
    fieldType: ConsultationFieldType,
  ): SensitiveAnswerValueType {
    if (fieldType === 'BOOLEAN') return 'BOOLEAN';
    if (fieldType === 'MULTI_SELECT') return 'STRING_LIST';
    if (fieldType === 'DATE') return 'DATE';
    return 'TEXT';
  }

  private async readDecision(
    submission: {
      customerId: string;
      customer: { userId: string };
      businessId: string;
      branchId: string;
      bookingId: string;
      serviceId: string;
      status: string;
      retentionUntil: Date;
      booking: {
        status: string;
        appointmentDate: Date;
        appointmentStartTime: Date;
        appointmentEndTime: Date;
      };
      answers: Array<{
        fieldId: string;
        dataCategory: string | null;
      }>;
      consentEvents: Array<{
        fieldId: string | null;
        assignedStaffId: string | null;
        expiresAt: Date;
        revokedBy: { id: string; createdAt: Date } | null;
      }>;
    },
    user: AuthUser,
  ): Promise<{
    result: 'GRANTED' | 'DENIED' | 'REDACTED';
    breakGlassGrantId?: string;
  }> {
    if (submission.customer.userId === user.id) {
      return { result: 'GRANTED' };
    }
    const context = {
      tenantId: submission.businessId,
      branchId: submission.branchId,
    };
    if (user.roles.includes('RECEPTIONIST')) {
      if (!can(user, 'consultation:status:branch', context)) {
        return { result: 'DENIED' };
      }
      try {
        await assertBusinessAccess(this.prisma, user, submission.businessId);
      } catch {
        return { result: 'DENIED' };
      }
      return { result: 'REDACTED' };
    }
    if (user.roles.includes('BUSINESS_OWNER')) {
      return { result: 'DENIED' };
    }
    const now = new Date();
    if (user.roles.includes('STAFF')) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          userId: user.id,
          branchId: submission.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!staff) return { result: 'DENIED' };
      const assigned = await this.prisma.bookingService.findFirst({
        where: {
          bookingId: submission.bookingId,
          serviceId: submission.serviceId,
          staffId: staff.id,
        },
        select: { id: true },
      });
      if (!assigned || !this.staffAccessWindowIsOpen(submission.booking, now)) {
        return { result: 'DENIED' };
      }
      const sensitiveFieldIds = submission.answers
        .filter((answer) => answer.dataCategory)
        .map((answer) => answer.fieldId);
      const activeGrantedFields = new Set(
        submission.consentEvents
          .filter(
            (event) =>
              event.assignedStaffId === staff.id &&
              event.expiresAt > now &&
              !event.revokedBy &&
              event.fieldId,
          )
          .map((event) => event.fieldId as string),
      );
      if (
        submission.status === 'SUBMITTED' &&
        submission.retentionUntil > now &&
        sensitiveFieldIds.every((fieldId) => activeGrantedFields.has(fieldId))
      ) {
        return { result: 'GRANTED' };
      }
      return { result: 'DENIED' };
    }

    const breakGlassPermission =
      can(user, 'health_record:break_glass:branch', context) ||
      can(user, 'health_record:break_glass:platform', context) ||
      (user.permissions ?? []).includes(
        'health_record:break_glass:platform',
      );
    if (
      !breakGlassPermission ||
      (submission.retentionUntil <= now &&
        !('legalHoldReason' in submission && submission.legalHoldReason))
    ) {
      return { result: 'DENIED' };
    }
    const grant = await this.prisma.sensitiveBreakGlassGrant.findFirst({
      where: {
        actorId: user.id,
        bookingId: submission.bookingId,
        expiresAt: { gt: now },
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return grant
      ? { result: 'GRANTED', breakGlassGrantId: grant.id }
      : { result: 'DENIED' };
  }

  private staffAccessWindowIsOpen(
    booking: {
      status: string;
      appointmentDate: Date;
      appointmentStartTime: Date;
      appointmentEndTime: Date;
    },
    now: Date,
  ) {
    if (!['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(booking.status)) {
      return false;
    }
    const start = this.combineDateAndTime(
      booking.appointmentDate,
      booking.appointmentStartTime,
    );
    const end = this.combineDateAndTime(
      booking.appointmentDate,
      booking.appointmentEndTime,
    );
    return (
      now.getTime() >= start.getTime() - 24 * 60 * 60 * 1000 &&
      now.getTime() <= end.getTime() + 24 * 60 * 60 * 1000
    );
  }

  private async logSensitiveAccess(
    submission: {
      id: string;
      businessId: string;
      branchId: string;
      bookingId: string;
    },
    user: AuthUser,
    result: 'GRANTED' | 'DENIED' | 'REDACTED',
    metadata: RequestMetadata,
    breakGlassGrantId?: string,
  ) {
    await this.prisma.sensitiveDataAccessEvent.create({
      data: {
        submissionId: submission.id,
        actorId: user.id,
        actorRole: user.roles.join(',').slice(0, 250),
        businessId: submission.businessId,
        branchId: submission.branchId,
        bookingId: submission.bookingId,
        purpose: (metadata.purpose ?? 'BOOKING_SERVICE').slice(0, 500),
        result,
        breakGlassGrantId,
        ipAddress: metadata.ipAddress?.slice(0, 100),
        userAgent: metadata.userAgent?.slice(0, 500),
      },
    });
  }

  private validateFieldDefinitions(fields: FieldDefinition[]) {
    const keys = new Set<string>();
    for (const field of fields) {
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(field.fieldKey)) {
        throw new BadRequestException(
          `fieldKey không hợp lệ: ${field.fieldKey}`,
        );
      }
      if (keys.has(field.fieldKey)) {
        throw new BadRequestException(
          `fieldKey bị trùng: ${field.fieldKey}`,
        );
      }
      keys.add(field.fieldKey);
      const isSelect = ['SINGLE_SELECT', 'MULTI_SELECT'].includes(
        field.fieldType,
      );
      if (
        isSelect &&
        (!field.options ||
          field.options.length < 1 ||
          new Set(field.options).size !== field.options.length)
      ) {
        throw new BadRequestException(
          `${field.fieldKey} phải có danh sách lựa chọn không trùng`,
        );
      }
      if (!isSelect && field.options?.length) {
        throw new BadRequestException(
          `${field.fieldKey} không được khai báo options`,
        );
      }
    }
  }

  private async createVersionRecord(
    tx: Prisma.TransactionClient,
    templateId: string,
    version: number,
    input: CreateConsultationVersionDto,
  ) {
    const noticeContent = input.noticeContent.trim();
    return tx.consultationFormVersion.create({
      data: {
        templateId,
        version,
        noticeVersion: input.noticeVersion.trim(),
        noticeContent,
        noticeHash: createHash('sha256')
          .update(noticeContent, 'utf8')
          .digest('hex'),
        purpose: input.purpose.trim(),
        recipientDescription: input.recipientDescription.trim(),
        retentionDays: input.retentionDays,
        fields: {
          create: input.fields.map((field) => ({
            fieldKey: field.fieldKey,
            label: field.label.trim(),
            description: field.description?.trim(),
            fieldType: field.fieldType,
            dataCategory: field.dataCategory,
            required: field.required,
            options: field.options ?? Prisma.JsonNull,
            sortOrder: field.sortOrder,
            maxLength: field.maxLength,
          })),
        },
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async templateForManagement(
    templateId: string,
    user: AuthUser,
  ) {
    const template = await this.prisma.consultationFormTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, businessId: true, branchId: true },
    });
    if (!template) throw new NotFoundException('Không tìm thấy biểu mẫu');
    await this.assertTemplateManagement(
      user,
      template.businessId,
      template.branchId ?? undefined,
    );
    return template;
  }

  private async assertTemplateManagement(
    user: AuthUser,
    businessId: string,
    branchId?: string,
  ) {
    await assertBusinessAccess(this.prisma, user, businessId);
    const context = { tenantId: businessId, branchId };
    if (
      !can(user, 'consultation:template:manage:tenant', context) &&
      !can(user, 'consultation:template:manage:branch', context)
    ) {
      throw new ForbiddenException(
        'Không có quyền quản lý biểu mẫu trong phạm vi này',
      );
    }
    if (
      user.roles.includes('BRANCH_MANAGER') &&
      !branchId
    ) {
      throw new ForbiddenException(
        'Quản lý chi nhánh không thể tạo biểu mẫu toàn doanh nghiệp',
      );
    }
  }

  private async assertBranchBelongsToBusiness(
    branchId: string | undefined,
    businessId: string,
  ) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException(
        'Chi nhánh không thuộc doanh nghiệp đã chọn',
      );
    }
  }

  private consentExpiry(
    date: Date,
    endTime: Date,
    retentionUntil: Date,
  ) {
    const serviceWindowEnd = new Date(
      this.combineDateAndTime(date, endTime).getTime() + 24 * 60 * 60 * 1000,
    );
    return serviceWindowEnd < retentionUntil
      ? serviceWindowEnd
      : retentionUntil;
  }

  private combineDateAndTime(date: Date, time: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds(),
      ),
    );
  }
}
