import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auditLog } from '../common/utils/audit';

export const PLATFORM_DEFAULTS = Object.freeze({
  maxAdvanceBookingDays: 30,
  minBookingLeadTimeHours: 2,
  freeCancellationHours: 2,
  allowRescheduleRequests: true,
  maxRescheduleCountPerBooking: 2,
  pendingHoldMinutes: 30,
  appointmentReminderBeforeHours: 2,
  reviewReminderAfterHours: 24,
  emailEnabled: false,
  smsEnabled: false,
  pushEnabled: false,
  autoApproveNewSalons: false,
  requirePhoneVerification: false,
  requireIdVerification: true,
  maxBranchesPerBusiness: 10,
  reviewMinLength: 0,
  allowAnonymousReview: false,
  autoHideReviewReportThreshold: 3,
  violationSuspendThreshold: 5,
});

export type PlatformSettings = typeof PLATFORM_DEFAULTS;

const LEGACY_ALIASES: Record<string, keyof PlatformSettings> = {
  maxCancellationHours: 'freeCancellationHours',
  allowRescheduling: 'allowRescheduleRequests',
  maxReschedulePerBooking: 'maxRescheduleCountPerBooking',
  bookingReminderHours: 'appointmentReminderBeforeHours',
  reviewReminderHours: 'reviewReminderAfterHours',
  enableEmailNotifications: 'emailEnabled',
  enableSmsNotifications: 'smsEnabled',
  enablePushNotifications: 'pushEnabled',
  minReviewLength: 'reviewMinLength',
  enableAnonymousReviews: 'allowAnonymousReview',
  autoHideReviewThreshold: 'autoHideReviewReportThreshold',
  suspendSalonAfterViolations: 'violationSuspendThreshold',
};

const INTEGER_RULES: Record<string, [number, number]> = {
  maxAdvanceBookingDays: [1, 365],
  minBookingLeadTimeHours: [0, 168],
  freeCancellationHours: [0, 168],
  maxRescheduleCountPerBooking: [0, 10],
  pendingHoldMinutes: [5, 1440],
  appointmentReminderBeforeHours: [0, 168],
  reviewReminderAfterHours: [0, 720],
  maxBranchesPerBusiness: [1, 1000],
  reviewMinLength: [0, 500],
  autoHideReviewReportThreshold: [1, 100],
  violationSuspendThreshold: [1, 100],
};

const BOOLEAN_KEYS = new Set([
  'allowRescheduleRequests', 'emailEnabled', 'smsEnabled', 'pushEnabled',
  'autoApproveNewSalons', 'requirePhoneVerification', 'requireIdVerification',
  'allowAnonymousReview',
]);

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(input: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(input ?? {})) {
      const key = LEGACY_ALIASES[rawKey] ?? rawKey;
      normalized[key] = value;
    }
    return normalized;
  }

  validate(input: Record<string, unknown>) {
    const normalized = this.normalize(input);
    const known = new Set(Object.keys(PLATFORM_DEFAULTS));
    const unknown = Object.keys(normalized).filter((key) => !known.has(key));
    if (unknown.length) {
      throw new BadRequestException(`Cài đặt không hỗ trợ: ${unknown.join(', ')}`);
    }
    for (const [key, value] of Object.entries(normalized)) {
      if (INTEGER_RULES[key]) {
        const [min, max] = INTEGER_RULES[key];
        if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
          throw new BadRequestException(`${key} phải là số nguyên từ ${min} đến ${max}`);
        }
      } else if (BOOLEAN_KEYS.has(key) && typeof value !== 'boolean') {
        throw new BadRequestException(`${key} phải là true hoặc false`);
      }
    }
    return normalized as Partial<PlatformSettings>;
  }

  async getConfigured(): Promise<Partial<PlatformSettings>> {
    const record = await this.prisma.platformSetting.findUnique({ where: { key: 'platform' } });
    return this.normalize((record?.value as Record<string, unknown>) ?? {}) as Partial<PlatformSettings>;
  }

  async getEffective(): Promise<PlatformSettings> {
    return { ...PLATFORM_DEFAULTS, ...(await this.getConfigured()) } as PlatformSettings;
  }

  async getView() {
    const configured = await this.getConfigured();
    return { configured, defaults: PLATFORM_DEFAULTS, effective: { ...PLATFORM_DEFAULTS, ...configured } };
  }

  async update(settings: Record<string, unknown>, actorId: string) {
    const configured = this.validate(settings);
    const before = await this.getConfigured();
    const record = await this.prisma.platformSetting.upsert({
      where: { key: 'platform' },
      create: { key: 'platform', value: configured as any, updatedBy: actorId },
      update: { value: configured as any, updatedBy: actorId },
    });
    await auditLog(this.prisma, {
      userId: actorId, action: 'UPDATE', entityType: 'PlatformSetting', entityId: record.id,
      oldData: before, newData: configured, reason: 'Cập nhật chính sách nền tảng',
    });
    return this.getView();
  }

  async reset(actorId: string) {
    const before = await this.getConfigured();
    const record = await this.prisma.platformSetting.upsert({
      where: { key: 'platform' },
      create: { key: 'platform', value: {}, updatedBy: actorId },
      update: { value: {}, updatedBy: actorId },
    });
    await auditLog(this.prisma, {
      userId: actorId, action: 'UPDATE', entityType: 'PlatformSetting', entityId: record.id,
      oldData: before, newData: {}, reason: 'Khôi phục cài đặt nền tảng về mặc định',
    });
    return this.getView();
  }
}
