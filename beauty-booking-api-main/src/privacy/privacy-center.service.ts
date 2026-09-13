import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { auditLog } from '../common/utils/audit';
import { can } from '../common/utils/policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDataSubjectRequestDto,
  CreatePrivacyExportDto,
  MarketingPreferenceDto,
} from './dto/privacy.dto';
import { SensitiveDataCipherService } from './sensitive-data-cipher.service';

@Injectable()
export class PrivacyCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SensitiveDataCipherService,
    private readonly config: ConfigService,
  ) {}

  async center(user: AuthUser) {
    const customer = await this.customer(user);
    const [
      bookingCount,
      dataRequests,
      marketing,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId: customer.id, deletedAt: null },
      }),
      this.prisma.dataSubjectRequest.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          deadlineAt: true,
          resolution: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketingPreference.findUnique({
        where: { customerId: customer.id },
        select: {
          emailMarketing: true,
          smsMarketing: true,
          pushMarketing: true,
          personalizedPromotions: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      account: {
        email: customer.user.email,
        fullName: customer.user.fullName,
        createdAt: customer.user.createdAt,
      },
      summary: {
        bookingCount,
        submissionCount: 0,
        activeShareCount: 0,
        accessEventCount: 0,
      },
      sections: {
        // Health records and consultation data are no longer collected or exposed.
        shares: [],
        accessHistory: [],
        retention: [],
        dataRequests,
        marketing:
          marketing ??
          {
            emailMarketing: false,
            smsMarketing: false,
            pushMarketing: false,
            personalizedPromotions: false,
            updatedAt: null,
          },
      },
    };
  }

  async createDataRequest(
    input: CreateDataSubjectRequestDto,
    user: AuthUser,
  ) {
    this.requirePermission(user, 'privacy_request:manage:self');
    const customer = await this.customer(user);
    const activeDuplicate = await this.prisma.dataSubjectRequest.findFirst({
      where: {
        customerId: customer.id,
        type: input.type,
        status: {
          in: ['RECEIVED', 'IDENTITY_VERIFICATION', 'IN_PROGRESS'],
        },
      },
      select: { id: true, status: true, createdAt: true },
    });
    if (activeDuplicate) {
      return { ...activeDuplicate, duplicate: true };
    }
    return this.prisma.dataSubjectRequest.create({
      data: {
        customerId: customer.id,
        type: input.type,
        reason: input.reason?.trim(),
        deadlineAt: new Date(Date.now() + 30 * 86_400_000),
      },
      select: {
        id: true,
        type: true,
        status: true,
        deadlineAt: true,
        createdAt: true,
      },
    });
  }

  async listDataRequests(user: AuthUser) {
    this.requirePermission(user, 'privacy_request:manage:self');
    const customer = await this.customer(user);
    return this.prisma.dataSubjectRequest.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        type: true,
        status: true,
        reason: true,
        identityVerifiedAt: true,
        legalHoldReason: true,
        resolution: true,
        deadlineAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMarketingPreferences(user: AuthUser) {
    this.requirePermission(user, 'marketing_preference:manage:self');
    const customer = await this.customer(user);
    return (
      (await this.prisma.marketingPreference.findUnique({
        where: { customerId: customer.id },
        select: {
          emailMarketing: true,
          smsMarketing: true,
          pushMarketing: true,
          personalizedPromotions: true,
          updatedAt: true,
        },
      })) ?? {
        emailMarketing: false,
        smsMarketing: false,
        pushMarketing: false,
        personalizedPromotions: false,
        updatedAt: null,
      }
    );
  }

  async updateMarketingPreferences(
    input: MarketingPreferenceDto,
    user: AuthUser,
  ) {
    this.requirePermission(user, 'marketing_preference:manage:self');
    const customer = await this.customer(user);
    const result = await this.prisma.marketingPreference.upsert({
      where: { customerId: customer.id },
      create: { customerId: customer.id, ...input },
      update: input,
      select: {
        emailMarketing: true,
        smsMarketing: true,
        pushMarketing: true,
        personalizedPromotions: true,
        updatedAt: true,
      },
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'UPDATE',
      entityType: 'MarketingPreference',
      entityId: customer.id,
      newData: result,
    });
    return result;
  }

  async createExport(input: CreatePrivacyExportDto, user: AuthUser) {
    this.requirePermission(user, 'privacy_request:manage:self');
    const customer = await this.customer(user);
    const passwordOk = await bcrypt.compare(
      input.currentPassword,
      customer.user.passwordHash,
    );
    if (!passwordOk) {
      throw new UnauthorizedException(
        'Mật khẩu hiện tại không đúng; không thể xuất dữ liệu',
      );
    }
    const payload = await this.buildExportPayload(customer.id, user.id);
    const encrypted = this.cipher.encrypt(payload, 2 * 1024 * 1024);
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const ttlMinutes = Math.min(
      60,
      Math.max(
        5,
        Number(this.config.get<string>('PRIVACY_EXPORT_TTL_MINUTES') ?? 15),
      ),
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.dataSubjectRequest.create({
          data: {
            customerId: customer.id,
            type: 'EXPORT',
            status: 'COMPLETED',
            identityVerifiedAt: now,
            deadlineAt: new Date(now.getTime() + 30 * 86_400_000),
            completedAt: now,
            resolution: 'Gói dữ liệu mã hóa đã được tạo',
          },
        });
        const exportPackage = await tx.privacyExportPackage.create({
          data: {
            customerId: customer.id,
            requestId: request.id,
            downloadTokenHash: tokenHash,
            expiresAt,
            payloadCiphertext: encrypted.valueCiphertext,
            encryptionIv: encrypted.encryptionIv,
            authenticationTag: encrypted.authenticationTag,
            keyVersion: encrypted.keyVersion,
          },
          select: { id: true, requestId: true, expiresAt: true },
        });
        return { request, exportPackage };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'CREATE',
      entityType: 'PrivacyExportPackage',
      entityId: result.exportPackage.id,
      newData: {
        requestId: result.request.id,
        expiresAt,
      },
      reason: 'Customer re-authenticated privacy export',
    });
    return {
      id: result.exportPackage.id,
      requestId: result.request.id,
      expiresAt,
      downloadToken: rawToken,
      oneTime: true,
    };
  }

  async downloadExport(
    packageId: string,
    rawToken: string | undefined,
    user: AuthUser,
  ) {
    const customer = await this.customer(user);
    if (!rawToken || rawToken.length < 20) {
      throw new ForbiddenException('Thiếu download token hợp lệ');
    }
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const exportPackage = await this.prisma.privacyExportPackage.findFirst({
      where: {
        id: packageId,
        customerId: customer.id,
        downloadTokenHash: tokenHash,
        expiresAt: { gt: new Date() },
        downloadedAt: null,
      },
    });
    if (!exportPackage) {
      throw new NotFoundException(
        'Gói xuất không tồn tại, đã hết hạn hoặc đã được tải',
      );
    }
    const claimed = await this.prisma.privacyExportPackage.updateMany({
      where: {
        id: exportPackage.id,
        customerId: customer.id,
        downloadTokenHash: tokenHash,
        expiresAt: { gt: new Date() },
        downloadedAt: null,
      },
      data: { downloadedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new NotFoundException('Gói xuất đã được tải bởi yêu cầu khác');
    }
    const payload = this.cipher.decrypt<Record<string, unknown>>({
      valueCiphertext: exportPackage.payloadCiphertext,
      encryptionIv: exportPackage.encryptionIv,
      authenticationTag: exportPackage.authenticationTag,
      keyVersion: exportPackage.keyVersion,
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'READ',
      entityType: 'PrivacyExportPackage',
      entityId: exportPackage.id,
      newData: { downloadedAt: new Date() },
      reason: 'One-time customer privacy export download',
    });
    return payload;
  }

  async cleanupExpiredPackages() {
    return this.prisma.privacyExportPackage.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            downloadedAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    });
  }

  private async buildExportPayload(customerId: string, userId: string) {
    const [
      profile,
      bookings,
      reviews,
      notifications,
      dataRequests,
      marketingPreferences,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          address: true,
          gender: true,
          dateOfBirth: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { customerId },
        select: {
          id: true,
          bookingCode: true,
          appointmentDate: true,
          appointmentStartTime: true,
          appointmentEndTime: true,
          status: true,
          source: true,
          totalAmount: true,
          finalAmount: true,
          voucherDiscountAmount: true,
          cancelReason: true,
          createdAt: true,
          branch: {
            select: {
              id: true,
              name: true,
              business: { select: { id: true, name: true } },
            },
          },
          bookingServices: {
            select: {
              serviceId: true,
              priceAtBooking: true,
              durationMinutes: true,
              service: { select: { name: true } },
              staff: { select: { fullName: true } },
            },
          },
          statusHistory: {
            select: { status: true, note: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              transactionRef: true,
              paidAt: true,
              createdAt: true,
              refundRequests: {
                select: {
                  id: true,
                  amount: true,
                  reason: true,
                  status: true,
                  settlementReference: true,
                  failureReason: true,
                  processedAt: true,
                  createdAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Health records and consultation submissions are retired. Keep them
      // out of exports; legacy tables are handled by retention tooling only.
      this.prisma.review.findMany({
        where: { customerId },
        select: {
          id: true,
          bookingId: true,
          overallRating: true,
          comment: true,
          isAnonymous: true,
          status: true,
          createdAt: true,
          serviceRatings: {
            select: {
              rating: true,
              comment: true,
              bookingServiceId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          body: true,
          isRead: true,
          readAt: true,
          targetType: true,
          targetId: true,
          relatedBookingId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataSubjectRequest.findMany({
        where: { customerId },
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          identityVerifiedAt: true,
          legalHoldReason: true,
          resolution: true,
          deadlineAt: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketingPreference.findUnique({
        where: { customerId },
        select: {
          emailMarketing: true,
          smsMarketing: true,
          pushMarketing: true,
          personalizedPromotions: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      formatVersion: 'beautybook-privacy-export-v1',
      profile,
      bookings,
      // Health records and consultation answers are intentionally excluded from
      // exports because the feature has been retired. Existing legacy rows are
      // retained only for controlled migration/retention handling.
      reviews,
      notifications,
      dataSubjectRequests: dataRequests,
      marketingPreferences:
        marketingPreferences ?? {
          emailMarketing: false,
          smsMarketing: false,
          pushMarketing: false,
          personalizedPromotions: false,
        },
    };
  }

  private requirePermission(user: AuthUser, permission: string) {
    if (!can(user, permission, { ownerId: user.id })) {
      throw new ForbiddenException(`Thiếu quyền ${permission}`);
    }
  }

  private async customer(user: AuthUser) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            fullName: true,
            passwordHash: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    }
    return customer;
  }
}
