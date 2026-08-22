import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';
import { assertBusinessAccess } from '../common/utils/multi-tenancy';
import { SensitiveConsent, SensitiveDataField } from '@prisma/client';

/**
 * HealthRecordsService — ACL-bounded access to PDPA VN sensitive health data
 * (skin condition, allergies, medications, ...). Plan §2.3 mandates a
 * separate table with its own policy; we never log the payload in plain
 * `audit_logs`, we always gate reads behind the `health_record:read:sensitive`
 * permission, AND we verify the consent row is still valid (granted, not
 * revoked).
 *
 * Allowed callers:
 *   - The customer (SELF scope, for their own records)
 *   - STAFF/RECEPTIONIST/BRANCH_MANAGER/BUSINESS_OWNER of the branch hosting
 *     the booking (with health_record:read:sensitive permission)
 *   - PLATFORM_ADMIN (health_record:delete:sensitive only — read by default
 *     is gated the same way as for the salon, to enforce least-privilege)
 */
@Injectable()
export class HealthRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async listConsents(user: AuthUser) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    const consents = await this.prisma.sensitiveConsent.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        scope: true,
        granted: true,
        grantedAt: true,
        revokedAt: true,
        policyVersion: true,
        healthRecords: {
          select: {
            id: true,
            field: true,
            createdAt: true,
            lastAccessedAt: true,
            booking: {
              select: {
                id: true,
                bookingCode: true,
                branch: {
                  select: {
                    id: true,
                    name: true,
                    business: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { scope: 'asc' },
    });
    return {
      legacy: true,
      grantDisabled: true,
      replacement: '/privacy/center',
      consents,
    };
  }

  /**
   * Customer-side: add a health-record row tied to their booking.
   * Always requires consent for the field; the consent row must not be revoked.
   */
  async create(
    caller: AuthUser,
    bookingId: string,
    field: SensitiveDataField,
    payload: unknown,
  ) {
    if (Boolean(caller)) {
      throw new GoneException(
        'Luồng health-record JSON cũ đã đóng. Hãy dùng Privacy Consultation theo từng lịch hẹn và dịch vụ.',
      );
    }
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        customer: { select: { id: true, userId: true } },
        branch: { select: { businessId: true } },
        bookingServices: {
          select: { staff: { select: { userId: true } } },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isCustomerSelf =
      booking.customer.userId === caller.id &&
      can(caller, 'health_record:create:self');
    const canCreateInBranch = can(caller, 'health_record:create:branch', {
      tenantId: booking.branch.businessId,
      branchId: booking.branchId,
    });
    if (!isCustomerSelf && !canCreateInBranch) {
      throw new ForbiddenException(
        'Permission required: health_record:create:self|branch',
      );
    }
    if (caller.roles.includes('STAFF')) {
      const assigned = booking.bookingServices.some(
        (service) => service.staff?.userId === caller.id,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'Staff chỉ được tạo health record cho booking được phân công',
        );
      }
    }

    const consent = await this.requireActiveConsent(
      booking.customer.id,
      this.scopeForField(field),
    );

    return this.prisma.bookingHealthRecord.upsert({
      where: { bookingId_field: { bookingId, field } },
      create: {
        bookingId,
        customerId: booking.customer.id,
        consentId: consent.id,
        field,
        payload: payload as any,
      },
      update: {
        consentId: consent.id,
        payload: payload as any,
      },
    });
  }

  /**
   * Read a single health record row, masking if the caller is not entitled.
   * Staff/owner/receptionist read the raw payload (necessary for service);
   * the customer also sees raw. Anyone else returns `null` payload + a
   * redacted marker.
   */
  async read(
    caller: AuthUser,
    recordId: string,
    access: { ipAddress?: string; userAgent?: string; purpose?: string } = {},
  ) {
    const record = await this.prisma.bookingHealthRecord.findUnique({
      where: { id: recordId },
      include: {
        booking: { include: { branch: true, customer: true } },
        consent: true,
      },
    });
    if (!record) throw new NotFoundException('Health record not found');

    try {
      await this.assertCanRead(caller, record);
    } catch (error) {
      await this.logAccess(caller, record, 'READ', 'DENIED', access);
      throw error;
    }
    await this.logAccess(caller, record, 'READ', 'GRANTED', access);
    await this.touchAccess(recordId, caller.id);

    if (!record.consent.granted || record.consent.revokedAt) {
      // Treat as if deleted once consent is revoked.
      return { ...record, payload: null, revoked: true };
    }
    return record;
  }

  /** List records for a booking (e.g. UI side panel). */
  async listForBooking(
    caller: AuthUser,
    bookingId: string,
    access: { ipAddress?: string; userAgent?: string; purpose?: string } = {},
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: { branch: true, customer: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const records = await this.prisma.bookingHealthRecord.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
      include: { consent: { select: { scope: true, granted: true, revokedAt: true } } },
    });
    try {
      if (records.length === 0) {
        await this.assertCanRead(caller, booking);
      } else {
        for (const record of records) {
          await this.assertCanRead(caller, record);
        }
      }
    } catch (error) {
      if (records.length > 0) {
        await this.prisma.healthRecordAccessLog.createMany({
          data: records.map((record) => ({
            actorId: caller.id,
            actorRole: caller.roles.join(','),
            recordId: record.id,
            bookingId,
            customerId: booking.customerId,
            businessId: booking.branch.businessId,
            branchId: booking.branchId,
            consentId: record.consentId,
            purpose: access.purpose ?? 'BOOKING_SERVICE',
            action: 'LIST',
            result: 'DENIED',
            ipAddress: access.ipAddress,
            userAgent: access.userAgent,
          })),
        });
      }
      throw error;
    }
    if (records.length > 0) {
      await this.prisma.healthRecordAccessLog.createMany({
        data: records.map((record) => ({
          actorId: caller.id,
          actorRole: caller.roles.join(','),
          recordId: record.id,
          bookingId,
          customerId: booking.customerId,
          businessId: booking.branch.businessId,
          branchId: booking.branchId,
          consentId: record.consentId,
          purpose: access.purpose ?? 'BOOKING_SERVICE',
          action: 'LIST',
          result: 'GRANTED',
          ipAddress: access.ipAddress,
          userAgent: access.userAgent,
        })),
      });
    }
    return records.map((record) =>
      !record.consent.granted || record.consent.revokedAt
        ? { ...record, payload: null, revoked: true }
        : record,
    );
  }

  /** Grant a consent (customer action). */
  async grantConsent(
    caller: AuthUser,
    scope: SensitiveConsent['scope'],
    policyVersion = 'pdpa-vn-91/2025',
  ) {
    if (Boolean(caller)) {
      throw new GoneException(
        'Consent toàn cục đã bị loại bỏ. Hãy cấp consent trong biểu mẫu tư vấn của từng lịch hẹn.',
      );
    }
    if (!can(caller, 'health_record:consent:manage:self')) {
      throw new ForbiddenException(
        'Permission required: health_record:consent:manage:self',
      );
    }
    const customer = await this.prisma.customerProfile.findFirst({
      where: { userId: caller.id },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }
    return this.prisma.sensitiveConsent.upsert({
      where: { customerId_scope: { customerId: customer.id, scope } },
      create: {
        customerId: customer.id,
        scope,
        granted: true,
        policyVersion,
      },
      update: {
        granted: true,
        revokedAt: null,
        policyVersion,
      },
    });
  }

  /** Revoke a previously-granted consent. Revoking cascades to the access
   *  policy in `read`/`listForBooking`. */
  async revokeConsent(caller: AuthUser, scope: SensitiveConsent['scope']) {
    if (Boolean(caller)) {
      throw new GoneException(
        'Consent toàn cục đã bị loại bỏ. Hãy thu hồi đúng lần cấp quyền trong Privacy Center.',
      );
    }
    if (!can(caller, 'health_record:consent:manage:self')) {
      throw new ForbiddenException(
        'Permission required: health_record:consent:manage:self',
      );
    }
    const customer = await this.prisma.customerProfile.findFirst({
      where: { userId: caller.id },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }
    return this.prisma.sensitiveConsent.upsert({
      where: { customerId_scope: { customerId: customer.id, scope } },
      create: {
        customerId: customer.id,
        scope,
        granted: false,
        revokedAt: new Date(),
      },
      update: {
        granted: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Hard-delete (use sparingly; PDPA right-to-erasure). Only platforms with
   * `health_record:delete:sensitive` may invoke.
   */
  async hardDelete(caller: AuthUser, recordId: string) {
    if (!can(caller, 'health_record:delete:sensitive')) {
      throw new ForbiddenException(
        'Permission required: health_record:delete:sensitive',
      );
    }
    await this.prisma.bookingHealthRecord.delete({ where: { id: recordId } });
    return { ok: true, deletedId: recordId };
  }

  // ---------------- helpers ----------------

  private async assertCanRead(
    caller: AuthUser,
    target: {
      id?: string;
      bookingId?: string;
      branchId?: string;
      customerId: string;
      field?: SensitiveDataField;
    },
  ): Promise<void> {
    if (!target) throw new NotFoundException('Record not found');

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: target.customerId },
      select: { userId: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (customer.userId === caller.id) return; // self always OK

    const bookingId = target.bookingId ?? target.id;
    if (!bookingId) throw new NotFoundException('Booking not found');
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        branchId: true,
        status: true,
        appointmentDate: true,
        appointmentStartTime: true,
        appointmentEndTime: true,
        branch: { select: { businessId: true } },
        bookingServices: { select: { staffId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const branchId = booking.branchId;
    const businessId = booking.branch.businessId;
    const context = { tenantId: businessId, branchId };

    if (
      caller.roles.includes('RECEPTIONIST') ||
      caller.roles.includes('BUSINESS_OWNER')
    ) {
      throw new ForbiddenException(
        'Vai trò này chỉ được xem trạng thái hoặc số liệu tổng hợp, không được xem nội dung sức khỏe',
      );
    }

    if (caller.roles.includes('STAFF')) {
      await assertBusinessAccess(this.prisma, caller, businessId);
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          userId: caller.id,
          branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (
        !staff ||
        !booking.bookingServices.some(
          (service) => service.staffId === staff.id,
        ) ||
        !this.staffAccessWindowIsOpen(booking)
      ) {
        throw new ForbiddenException(
          'Nhân viên chỉ được xem dữ liệu của lịch hẹn đang được phân công trong cửa sổ phục vụ',
        );
      }
      if (!target.field) return;
      const activeContextualGrant = await this.prisma.consentEvent.findFirst({
        where: {
          bookingId,
          dataCategory: target.field,
          action: 'GRANTED',
          assignedStaffId: staff.id,
          expiresAt: { gt: new Date() },
          revokedBy: null,
          submission: {
            status: 'SUBMITTED',
            retentionUntil: { gt: new Date() },
          },
        },
        select: { id: true },
      });
      if (activeContextualGrant) return;
      throw new ForbiddenException(
        'Không có consent còn hiệu lực cho dữ liệu và lịch hẹn này',
      );
    }

    const hasBreakGlassPermission =
      can(caller, 'health_record:break_glass:branch', context) ||
      can(caller, 'health_record:break_glass:platform', context) ||
      (caller.permissions ?? []).includes(
        'health_record:break_glass:platform',
      );
    if (hasBreakGlassPermission) {
      const grant = await this.prisma.sensitiveBreakGlassGrant.findFirst({
        where: {
          actorId: caller.id,
          bookingId,
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
        select: { id: true },
      });
      if (grant) return;
    }
    throw new ForbiddenException(
      'Không có quyền truy cập dữ liệu sức khỏe hoặc thiếu break-glass còn hiệu lực',
    );
  }

  private staffAccessWindowIsOpen(booking: {
    status: string;
    appointmentDate: Date;
    appointmentStartTime: Date;
    appointmentEndTime: Date;
  }) {
    if (!['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(booking.status)) {
      return false;
    }
    const combine = (time: Date) =>
      new Date(
        Date.UTC(
          booking.appointmentDate.getUTCFullYear(),
          booking.appointmentDate.getUTCMonth(),
          booking.appointmentDate.getUTCDate(),
          time.getUTCHours(),
          time.getUTCMinutes(),
          time.getUTCSeconds(),
        ),
      );
    const now = Date.now();
    return (
      now >= combine(booking.appointmentStartTime).getTime() - 86_400_000 &&
      now <= combine(booking.appointmentEndTime).getTime() + 86_400_000
    );
  }

  private async requireActiveConsent(
    customerId: string,
    scope: SensitiveConsent['scope'],
  ) {
    const consent = await this.prisma.sensitiveConsent.findUnique({
      where: { customerId_scope: { customerId, scope } },
    });
    if (!consent || !consent.granted || consent.revokedAt) {
      throw new ForbiddenException(
        `Consent scope=${scope} chưa được cấp hoặc đã bị thu hồi`,
      );
    }
    return consent;
  }

  private scopeForField(field: SensitiveDataField): SensitiveConsent['scope'] {
    // Map each data field to its required consent scope. Mirrors the
    // catalog of consent types defined in the schema.
    switch (field) {
      case 'SKIN_CONDITION':
        return 'SKIN_CONDITION';
      case 'ALLERGY':
        return 'ALLERGY';
      case 'MEDICATION':
        return 'MEDICATION';
      case 'PREGNANCY':
        return 'PREGNANCY';
      case 'GENERAL_HEALTH':
        return 'GENERAL_HEALTH';
      default:
        throw new BadRequestException(`Unsupported field ${field}`);
    }
  }

  private async touchAccess(recordId: string, userId: string): Promise<void> {
    await this.prisma.bookingHealthRecord.update({
      where: { id: recordId },
      data: {
        lastAccessedAt: new Date(),
        lastAccessedBy: userId,
      },
    });
  }

  private async logAccess(
    caller: AuthUser,
    record: {
      id: string;
      bookingId: string;
      customerId: string;
      consentId: string;
      booking: { branchId: string; branch: { businessId: string } };
    },
    action: string,
    result: string,
    access: { ipAddress?: string; userAgent?: string; purpose?: string },
  ): Promise<void> {
    await this.prisma.healthRecordAccessLog.create({
      data: {
        actorId: caller.id,
        actorRole: caller.roles.join(','),
        recordId: record.id,
        bookingId: record.bookingId,
        customerId: record.customerId,
        businessId: record.booking.branch.businessId,
        branchId: record.booking.branchId,
        consentId: record.consentId,
        purpose: access.purpose ?? 'BOOKING_SERVICE',
        action,
        result,
        ipAddress: access.ipAddress,
        userAgent: access.userAgent,
      },
    });
  }
}
