import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { combineAppointmentDateTime } from '../common/utils/booking-datetime';
import { auditLog } from '../common/utils/audit';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { BranchStateService } from '../branches/branch-state.service';

interface TrustMetrics {
  totalBookings: number;
  cancellationRate: number;
  noShowRate: number;
  avgRejectTimeMinutes: number;
  lateCancelBySalonRate: number;
  trustScore: number;
  alertLevel: 'OK' | 'WARN' | 'DANGER';
}

/**
 * Tính trust score cho 1 salon dựa trên 4 chỉ số:
 *  - Salon-caused cancellation rate cao → giảm điểm
 *  - Customer no-show được theo dõi nhưng không phạt salon
 *  - Thời gian duyệt booking trung bình >24h → giảm (admin escalation)
 *  - Salon hay huỷ trễ (cancelByType=SALON, gần giờ hẹn) → giảm nặng
 *
 * threshold gợi ý:
 *  - trustScore >= 80 → OK
 *  - 60..80 → WARN
 *  - < 60 → DANGER (admin cần can thiệt)
 */
@Injectable()
export class TrustSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly branchState: BranchStateService,
  ) {}

  async computeForBusiness(businessId: string): Promise<TrustMetrics> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        branch: { businessId },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // 90 ngày
        deletedAt: null,
      },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          where: { status: 'CONFIRMED' },
          take: 1,
        },
      },
    });

    const total = bookings.length;
    if (total === 0) {
      return {
        totalBookings: 0,
        cancellationRate: 0,
        noShowRate: 0,
        avgRejectTimeMinutes: 0,
        lateCancelBySalonRate: 0,
        trustScore: 100,
        alertLevel: 'OK',
      };
    }

    const cancelledByCustomer = bookings.filter(
      (b) => b.status === 'CANCELLED' && b.cancelledByType === 'CUSTOMER',
    ).length;
    const cancelledBySalon = bookings.filter(
      (b) => b.status === 'CANCELLED' && b.cancelledByType === 'SALON',
    ).length;
    const noShow = bookings.filter((b) => b.status === 'NO_SHOW').length;

    // Late cancel by salon: status=CANCELLED, cancelledByType=SALON,
    // cancelledAt nằm trong vòng 2h trước appointmentStartTime.
    const lateCancelBySalon = bookings.filter((b) => {
      if (b.status !== 'CANCELLED' || b.cancelledByType !== 'SALON') return false;
      if (!b.cancelledAt || !b.appointmentStartTime) return false;
      const appointmentStart = combineAppointmentDateTime(
        b.appointmentDate,
        b.appointmentStartTime,
      );
      const diffMs = appointmentStart.getTime() - b.cancelledAt.getTime();
      return diffMs < 2 * 60 * 60 * 1000 && diffMs >= 0;
    }).length;

    // `cancellationRate` is deliberately salon-caused only. Customer
    // cancellation/no-show remain observable metrics but must not reduce the
    // establishment's trust score.
    const cancellationRate = cancelledBySalon / total;
    const noShowRate = noShow / total;
    const lateCancelBySalonRate = cancelledBySalon > 0
      ? lateCancelBySalon / cancelledBySalon
      : 0;

    const rejectTimes = bookings
      .map((b) => {
        const created = new Date(b.createdAt).getTime();
        const confirmed = b.statusHistory[0]?.createdAt;
        if (!confirmed) return null;
        const diff = (new Date(confirmed).getTime() - created) / 60000;
        return diff;
      })
      .filter((d): d is number => d !== null && d > 0);
    const avgRejectTimeMinutes = rejectTimes.length > 0
      ? rejectTimes.reduce((s, v) => s + v, 0) / rejectTimes.length
      : 0;

    // trust score 100 trừ dần:
    let score = 100;
    score -= Math.round(cancellationRate * 100 * 0.5); // tối đa -50
    score -= Math.round(lateCancelBySalonRate * 100 * 1.0);
    if (avgRejectTimeMinutes > 24 * 60) score -= 15; // SLA 24h
    if (avgRejectTimeMinutes > 48 * 60) score -= 15;
    score = Math.max(0, score);

    const alertLevel = score >= 80 ? 'OK' : score >= 60 ? 'WARN' : 'DANGER';

    return {
      totalBookings: total,
      cancellationRate,
      noShowRate,
      avgRejectTimeMinutes,
      lateCancelBySalonRate,
      trustScore: score,
      alertLevel,
    };
  }

  async upsertSnapshot(businessId: string): Promise<void> {
    const m = await this.computeForBusiness(businessId);
    await this.prisma.salonTrustSnapshot.upsert({
      where: { businessId },
      create: {
        businessId,
        ...m,
      },
      update: m,
    });
  }

  async listAllSnapshots() {
    const items = await this.prisma.salonTrustSnapshot.findMany({
      include: {
        business: { select: { id: true, name: true, status: true, bookingRestrictedAt: true, bookingRestrictionReason: true, branches: { where: { deletedAt: null }, select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } } } },
      },
      orderBy: { trustScore: 'asc' },
    });
    const lastComputedAt = items.reduce<Date | null>((latest, item) =>
      !latest || item.computedAt > latest ? item.computedAt : latest, null);
    return {
      periodDays: 90,
      lastComputedAt,
      totalBusinesses: items.length,
      warningCount: items.filter((item) => item.alertLevel === 'WARN').length,
      dangerCount: items.filter((item) => item.alertLevel === 'DANGER').length,
      monitoredCount: items.filter((item) => item.alertLevel !== 'OK').length,
      data: items.map((item) => ({
        ...item,
        avgConfirmationTimeMinutes: item.avgRejectTimeMinutes,
        reasons: this.reasons(item),
      })),
    };
  }

  private reasons(item: { cancellationRate: number; lateCancelBySalonRate: number; avgRejectTimeMinutes: number; trustScore: number }) {
    const reasons: string[] = [];
    if (item.cancellationRate >= 0.1) reasons.push(`Tỷ lệ cơ sở hủy lịch ${(item.cancellationRate * 100).toFixed(1)}%`);
    if (item.lateCancelBySalonRate >= 0.2) reasons.push(`Tỷ lệ hủy sát giờ bởi cơ sở ${(item.lateCancelBySalonRate * 100).toFixed(1)}%`);
    if (item.avgRejectTimeMinutes > 24 * 60) reasons.push(`Thời gian xác nhận trung bình ${Math.round(item.avgRejectTimeMinutes)} phút`);
    if (!reasons.length && item.trustScore < 100) reasons.push('Điểm trust giảm theo dữ liệu vận hành 90 ngày');
    return reasons;
  }

  async rebuildAll(actorId: string) {
    const businesses = await this.prisma.business.findMany({
      where: { status: { in: ['APPROVED', 'ACTIVE', 'SUSPENDED'] }, deletedAt: null },
      select: { id: true },
    });
    for (const business of businesses) await this.upsertSnapshot(business.id);
    await auditLog(this.prisma, {
      userId: actorId, action: 'UPDATE', entityType: 'SalonTrustSnapshot',
      newData: { businesses: businesses.length, periodDays: 90 }, reason: 'Tạo/cập nhật trust snapshot thủ công',
    });
    return this.listAllSnapshots();
  }

  async performAction(params: {
    actorId: string;
    businessId: string;
    branchId?: string;
    action: 'WARNING_SENT' | 'EXPLANATION_REQUESTED' | 'MONITORING_STARTED' | 'BOOKING_RESTRICTED' | 'SUSPENDED' | 'RESTORED' | 'NOTE_ADDED';
    reason: string;
    internalNote?: string;
  }) {
    if (!params.reason?.trim()) throw new BadRequestException('Lý do xử lý là bắt buộc');
    const business = await this.prisma.business.findUnique({ where: { id: params.businessId } });
    if (!business) throw new NotFoundException('Doanh nghiệp không tồn tại');
    const branch = params.branchId
      ? await this.prisma.branch.findFirst({ where: { id: params.branchId, businessId: params.businessId } })
      : null;
    if (params.branchId && !branch) throw new NotFoundException('Chi nhánh không thuộc doanh nghiệp');
    const restoreTarget = params.action === 'RESTORED'
      ? await this.prisma.trustAction.findFirst({
          where: {
            businessId: business.id,
            branchId: branch?.id ?? null,
            action: { in: ['BOOKING_RESTRICTED', 'SUSPENDED'] },
            restoredBy: null,
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    if (params.action === 'RESTORED' && !restoreTarget) {
      throw new BadRequestException(
        'Không có quyết định hạn chế hoặc tạm ngưng chưa được khôi phục',
      );
    }

    const policy = await this.settings.getEffective();
    const adverseActions = ['WARNING_SENT', 'EXPLANATION_REQUESTED', 'BOOKING_RESTRICTED', 'SUSPENDED'] as const;
    const recentViolations = adverseActions.includes(params.action as any)
      ? await this.prisma.trustAction.count({ where: { businessId: business.id, action: { in: [...adverseActions] }, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } })
      : 0;
    const autoSuspend = !branch && params.action !== 'RESTORED' && adverseActions.includes(params.action as any) && recentViolations + 1 >= policy.violationSuspendThreshold;

    const statusBefore = branch?.status ?? business.status;
    let statusAfter: string = statusBefore;
    if (branch && ['BOOKING_RESTRICTED', 'SUSPENDED', 'RESTORED'].includes(params.action)) {
      const action = params.action === 'BOOKING_RESTRICTED' ? 'PAUSE' : params.action === 'SUSPENDED' ? 'SUSPEND' : 'RESTORE';
      const result = await this.branchState.transition(branch.id, action, params.actorId, params.reason);
      if (!result.transitioned || !('branch' in result)) {
        throw new ConflictException(`Cần xử lý toàn bộ lịch bị ảnh hưởng trước${'impactCase' in result ? ` (case ${result.impactCase?.id})` : ''}`);
      }
      statusAfter = result.branch.status;
    }
    await this.prisma.$transaction(async (tx) => {
      if (params.action === 'BOOKING_RESTRICTED') {
        if (!branch) await tx.business.update({ where: { id: business.id }, data: { bookingRestrictedAt: new Date(), bookingRestrictionReason: params.reason.trim() } });
        statusAfter = 'BOOKING_RESTRICTED';
      } else if (params.action === 'SUSPENDED') {
        if (!branch) {
          await tx.business.update({ where: { id: business.id }, data: { status: 'SUSPENDED', bookingRestrictedAt: new Date(), bookingRestrictionReason: params.reason.trim() } });
          statusAfter = 'SUSPENDED';
        }
      } else if (params.action === 'RESTORED') {
        if (!branch) {
          const restoredStatus =
            restoreTarget?.action === 'SUSPENDED' &&
            restoreTarget.statusBefore &&
            restoreTarget.statusBefore !== 'SUSPENDED'
              ? restoreTarget.statusBefore
              : business.status;
          await tx.business.update({
            where: { id: business.id },
            data: {
              status: restoredStatus as any,
              bookingRestrictedAt: null,
              bookingRestrictionReason: null,
            },
          });
          statusAfter = restoredStatus;
        }
      }
      if (autoSuspend && statusAfter !== 'SUSPENDED') {
        await tx.business.update({ where: { id: business.id }, data: { status: 'SUSPENDED', bookingRestrictedAt: new Date(), bookingRestrictionReason: `Tự động tạm ngưng khi đạt ${policy.violationSuspendThreshold} tín hiệu vi phạm. ${params.reason.trim()}` } });
        statusAfter = 'SUSPENDED';
      }
      await tx.trustAction.create({ data: {
        businessId: business.id, branchId: branch?.id, actorId: params.actorId,
        action: params.action, reason: params.reason.trim(), internalNote: params.internalNote?.trim() || null,
        statusBefore, statusAfter, restoreOfActionId: restoreTarget?.id ?? null,
      } });
      if (['WARNING_SENT', 'EXPLANATION_REQUESTED', 'BOOKING_RESTRICTED', 'SUSPENDED', 'RESTORED'].includes(params.action)) {
        const recipients = await tx.salonMember.findMany({ where: { businessId: business.id, isActive: true, deletedAt: null }, select: { userId: true } });
        if (recipients.length) await tx.notification.createMany({ data: recipients.map(({ userId }) => ({
          userId, type: 'SALON_VIOLATION_ALERT', title: params.action === 'RESTORED' ? 'Đã khôi phục hoạt động' : 'Thông báo Trust & Safety', body: params.reason.trim(),
        })) });
      }
    });
    await auditLog(this.prisma, {
      userId: params.actorId, action: params.action === 'RESTORED' ? 'STATUS_CHANGE' : 'ESCALATION',
      entityType: branch ? 'BranchTrustAction' : 'BusinessTrustAction', entityId: branch?.id ?? business.id,
      oldData: { status: statusBefore }, newData: { status: statusAfter, action: params.action }, reason: params.reason.trim(),
    });
    return this.prisma.trustAction.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { fullName: true, email: true } }, branch: { select: { name: true } } } });
  }

  async listActions(businessId?: string) {
    return this.prisma.trustAction.findMany({
      where: businessId ? { businessId } : undefined,
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { business: { select: { name: true } }, branch: { select: { name: true } }, actor: { select: { fullName: true, email: true } } },
    });
  }
}
