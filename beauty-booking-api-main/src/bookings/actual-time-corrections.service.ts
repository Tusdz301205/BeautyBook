import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertActualTimeCorrectionPermission, assertActualTimeGrantOwner } from '../common/permissions/actual-time-correction-permission';
import { isISO8601 } from 'class-validator';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { BOOKING_TIMING_AUDIT_INCLUDE, bookingItemActualTiming } from './booking-actual-timing';
import { ActualTimeCorrectionDto, ActualTimeGrantDto } from './dto/actual-time-correction.dto';
import { SchedulerGateway } from '../scheduler/scheduler.gateway';
import { emitCommittedBookingUpdates } from './booking-realtime';

const ITEM_INCLUDE = {
  ...BOOKING_TIMING_AUDIT_INCLUDE,
  staff: { select: { userId: true } },
  booking: { include: { branch: { select: { businessId: true } } } },
} satisfies Prisma.BookingServiceInclude;
type Item = Prisma.BookingServiceGetPayload<{ include: typeof ITEM_INCLUDE }>;
const correctable = (itemStatus: string, parentStatus: string) =>
  ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(itemStatus) &&
  ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(parentStatus);

@Injectable()
export class ActualTimeCorrectionsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly gateway?: SchedulerGateway) {}

  private reason(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) {
      throw new BadRequestException('Lý do đính chính là bắt buộc, tối đa 2000 ký tự');
    }
    return value.trim();
  }

  private resource(item: Item) {
    return { businessId: item.booking.branch.businessId, branchId: item.booking.branchId, staffUserId: item.staff?.userId };
  }

  private async ownExecution(db: Pick<Prisma.TransactionClient, 'staffProfile'>, user: AuthUser,
    item: Pick<Item, 'refs_BookingServiceAdjustment_bookingServiceId'>): Promise<boolean> {
    const ids = new Set<string>();
    for (const event of item.refs_BookingServiceAdjustment_bookingServiceId) {
      if (user.roles.includes('STAFF') && !user.roles.includes('BUSINESS_OWNER') && event.actorId === user.id && ['START', 'COMPLETE'].includes(event.action)) return true;
      for (const snapshot of [event.beforeSnapshot, event.afterSnapshot]) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
        if ('staffUserId' in snapshot && typeof snapshot.staffUserId === 'string') {
          if (snapshot.staffUserId === user.id) return true;
          // A recorded identity is authoritative; a later profile relink must
          // not turn another provider's old work into the caller's work.
          continue;
        }
        if ('staffId' in snapshot && typeof snapshot.staffId === 'string') ids.add(snapshot.staffId);
      }
    }
    if (!ids.size) return false;
    const profiles = await db.staffProfile.findMany({ where: { id: { in: [...ids] }, userId: user.id }, select: { id: true } });
    return profiles.length > 0;
  }

  private async item(db: Prisma.TransactionClient, bookingId: string, itemId: string) {
    const item = await db.bookingService.findFirst({ where: { id: itemId, bookingId,
      booking: { deletedAt: null, branch: { deletedAt: null, business: { deletedAt: null } } } }, include: ITEM_INCLUDE });
    if (!item) throw new NotFoundException('Không tìm thấy dịch vụ trong lịch hẹn');
    return item;
  }

  private interval(input: ActualTimeCorrectionDto, serverNow: Date) {
    const unknown = input.actualStartedAt === null && input.actualCompletedAt === null;
    const status = unknown ? 'UNKNOWN' as const : 'KNOWN' as const;
    if (input.actualTimingStatus !== undefined && input.actualTimingStatus !== status) {
      throw new BadRequestException('Trạng thái thời gian phải khớp với hai mốc thực tế');
    }
    if (unknown) return { actualStartedAt: null, actualCompletedAt: null, actualTimingStatus: status };
    // Require explicit ISO instants with timezone; never use planned dates or local parsing.
    const instant = (value: unknown) => {
      if (typeof value !== 'string' || !isISO8601(value, { strict: true }) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        throw new BadRequestException('Cần cung cấp cả hai mốc ISO thực tế có múi giờ hoặc null/null');
      }
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new BadRequestException('Thời gian thực tế không hợp lệ');
      return date;
    };
    const actualStartedAt = instant(input.actualStartedAt), actualCompletedAt = instant(input.actualCompletedAt);
    if (actualStartedAt >= actualCompletedAt || actualCompletedAt > serverNow) {
      throw new BadRequestException('Thời gian thực tế phải bắt đầu trước kết thúc và không ở tương lai');
    }
    return { actualStartedAt, actualCompletedAt, actualTimingStatus: status };
  }

  async correct(bookingId: string, itemId: string, user: AuthUser, input: ActualTimeCorrectionDto) {
    const reason = this.reason(input.reason);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision phải là phiên bản hiện tại');
    }
    const result = await withSerializableTransaction(this.prisma, async tx => {
      // Follow the lifecycle lock order. Serializable replays permissions, conflicts and clock checks.
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM booking_services WHERE id = ${itemId} AND booking_id = ${bookingId} FOR UPDATE`;
      const item = await this.item(tx, bookingId, itemId);
      await assertActualTimeCorrectionPermission(tx, user, this.resource(item));
      if (await this.ownExecution(tx, user, item)) {
        throw new ForbiddenException('Nhân viên không được hiệu chỉnh dịch vụ do chính mình ghi nhận thực hiện, kể cả sau khi đổi phân công');
      }
      if (!correctable(item.status, item.booking.status)) throw new ConflictException('Trạng thái dịch vụ không cho phép đính chính');
      if (item.revision !== input.expectedRevision) throw new ConflictException('Dịch vụ vừa thay đổi; tải lại trước khi đính chính');
      if (item.staffId) await tx.$queryRaw`SELECT id FROM staff_profiles WHERE id = ${item.staffId} FOR UPDATE`;
      const correctedAt = new Date();
      const actual = this.interval(input, correctedAt);
      if (item.staffId && actual.actualStartedAt && actual.actualCompletedAt) {
        // Batch-load observed intervals across all dates, including completed/cancelled history.
        // UNKNOWN has no interval to invent. An observed open START occupies time through now.
        const others = await tx.bookingService.findMany({ where: { staffId: item.staffId, id: { not: item.id } },
          include: { ...BOOKING_TIMING_AUDIT_INCLUDE, booking: { select: { statusHistory: {
            where: { status: { in: ['CANCELLED', 'REJECTED', 'EXPIRED'] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true },
          } } } } });
        for (const other of others) {
          const timing = bookingItemActualTiming(other);
          // An observed cancellation releases operational capacity; it is NOT
          // proof of actual service completion, so actualStoppedAt stays null.
          const release = other.status === 'CANCELLED' && timing.actualStartedAt
            ? other.booking?.statusHistory.find(event => event.createdAt >= timing.actualStartedAt!)?.createdAt : undefined;
          const occupiedEnd = timing.actualStoppedAt ?? release ?? (other.status === 'IN_PROGRESS' ? correctedAt : null);
          if (timing.actualStartedAt && timing.actualStartedAt < actual.actualCompletedAt && !occupiedEnd) {
            throw new ConflictException('Dịch vụ trước đã dừng nhưng thiếu bằng chứng thời điểm dừng hoặc giải phóng; cần đối soát dữ liệu đó trước khi hiệu chỉnh khoảng trùng chưa xác định.');
          }
          if (timing.actualStartedAt && timing.actualStartedAt < actual.actualCompletedAt &&
              occupiedEnd && occupiedEnd > actual.actualStartedAt) {
            throw new ConflictException('Thời gian thực tế trùng với dịch vụ khác của cùng chuyên viên');
          }
        }
      }
      const old = bookingItemActualTiming(item);
      const changed = await tx.bookingService.updateMany({ where: { id: item.id, bookingId,
        revision: input.expectedRevision, status: item.status }, data: { status: 'COMPLETED', revision: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Dịch vụ vừa thay đổi; tải lại trước khi đính chính');
      const correction = await tx.bookingServiceActualTimeCorrection.create({ data: {
        bookingServiceId: item.id, version: (item.actualTimeCorrections[0]?.version ?? 0) + 1,
        ...actual, oldActualStartedAt: old.actualStartedAt, oldActualCompletedAt: old.actualCompletedAt,
        oldActualTimingStatus: old.actualTimingStatus, oldItemStatus: item.status, newItemStatus: 'COMPLETED',
        reason, actorId: user.id, correctedAt,
      } });
      return { bookingId, itemId, status: 'COMPLETED' as const, revision: item.revision + 1,
        ...actual, actualStoppedAt: actual.actualCompletedAt, actualTimingSource: 'ACTUAL_TIME_CORRECTION' as const,
        canCorrectActualTime: true, correction, serverNow: correctedAt };
    });
    await emitCommittedBookingUpdates(this.prisma, this.gateway, [bookingId]);
    return result;
  }

  async history(bookingId: string, itemId: string, user: AuthUser) {
    return withSerializableTransaction(this.prisma, async tx => {
      const item = await this.item(tx, bookingId, itemId);
      await assertActualTimeCorrectionPermission(tx, user, this.resource(item));
      const data = await tx.bookingServiceActualTimeCorrection.findMany({ where: { bookingServiceId: itemId },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: [{ version: 'desc' }, { id: 'desc' }] });
      return { bookingId, itemId, data, serverNow: new Date() };
    });
  }

  async withCapabilities<T extends { id: string; bookingServices?: readonly { id: string }[] }>(booking: T, user: AuthUser) {
    const items = await this.prisma.bookingService.findMany({ where: { bookingId: booking.id },
      include: { ...BOOKING_TIMING_AUDIT_INCLUDE, staff: { select: { userId: true } }, booking: { include: { branch: { select: { businessId: true } } } } } });
    let allowed = false;
    if (items.length) {
      try {
        await assertActualTimeCorrectionPermission(this.prisma, user, { businessId: items[0].booking.branch.businessId,
          branchId: items[0].booking.branchId });
        allowed = true;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    const capability = new Map(await Promise.all(items.map(async item => [item.id, allowed && item.staff?.userId !== user.id &&
      !(await this.ownExecution(this.prisma, user, item)) && correctable(item.status, item.booking.status)] as const)));
    return { ...booking, bookingServices: (booking.bookingServices ?? []).map(item => ({ ...item,
      canCorrectActualTime: capability.get(item.id) ?? false })) };
  }

  async grant(user: AuthUser, input: ActualTimeGrantDto) {
    const reason = this.reason(input.reason);
    return withSerializableTransaction(this.prisma, async tx => {
      await assertActualTimeGrantOwner(tx, user, input.businessId);
      if (input.branchId) {
        const branch = await tx.branch.findFirst({ where: { id: input.branchId, businessId: input.businessId, deletedAt: null } });
        if (!branch) throw new BadRequestException('Chi nhánh cấp quyền không thuộc doanh nghiệp');
      }
      const target = await tx.userRole.findFirst({ where: { userId: input.userId, businessId: input.businessId,
        user: { isActive: true, deletedAt: null }, role: { code: { in: ['RECEPTIONIST', 'STAFF', 'BUSINESS_OWNER'] } },
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ...(input.branchId ? [{ OR: [{ branchId: null }, { branchId: input.branchId }] }] : [])] } });
      if (!target) throw new BadRequestException('Người nhận phải có vai trò vận hành còn hiệu lực trong phạm vi');
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
        throw new BadRequestException('Hạn cấp quyền phải ở tương lai');
      }
      return tx.bookingActualTimeGrant.create({ data: { userId: input.userId, businessId: input.businessId,
        branchId: input.branchId ?? null, grantedBy: user.id, grantedAt: new Date(), expiresAt, reason } });
    });
  }

  async revokeGrant(user: AuthUser, grantId: string, input: { reason: string }) {
    const reason = this.reason(input.reason);
    return withSerializableTransaction(this.prisma, async tx => {
      const grant = await tx.bookingActualTimeGrant.findUnique({ where: { id: grantId } });
      if (!grant) throw new NotFoundException('Không tìm thấy quyền được cấp');
      await assertActualTimeGrantOwner(tx, user, grant.businessId);
      const changed = await tx.bookingActualTimeGrant.updateMany({ where: { id: grantId, revokedAt: null },
        data: { revokedAt: new Date(), revokedBy: user.id, revokeReason: reason } });
      if (!changed.count) throw new ConflictException('Quyền đã được thu hồi');
      return { id: grantId, revoked: true, serverNow: new Date() };
    });
  }
}
