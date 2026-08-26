import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingItemsService } from '../bookings/booking-items.service';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsService } from '../payments/payments.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { ALL_TENANTS } from '../common/utils/multi-tenancy';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingItems: BookingItemsService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}

  list(businessIds: string[], branchIds?: string[]) {
    return this.prisma.operationalImpactCase.findMany({
      where: {
        ...(businessIds.includes(ALL_TENANTS) ? {} : { businessId: { in: businessIds } }),
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      orderBy: [{ status: 'asc' }, { deadlineAt: 'asc' }],
    });
  }

  detail(caseId: string) {
    return this.prisma.operationalImpactCase.findUnique({
      where: { id: caseId },
    }).then(async (impact) => {
      if (!impact) throw new NotFoundException('Impact case không tồn tại');
      const items = await this.prisma.operationalImpactItem.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
      });
      const bookings = await this.prisma.booking.findMany({
        where: { id: { in: items.map((item) => item.bookingId) } },
        include: { bookingServices: { include: { service: true, staff: true } }, payments: true },
      });
      const byId = new Map(bookings.map((booking) => [booking.id, booking]));
      return { ...impact, items: items.map((item) => ({ ...item, booking: byId.get(item.bookingId) })) };
    });
  }

  async resolveItem(caseId: string, itemId: string, user: AuthUser, input: {
    resolution: 'REASSIGN' | 'RESCHEDULE' | 'TRANSFER_BRANCH' | 'CANCEL_REFUND' | 'APPROVED_EXCEPTION';
    reason: string;
    replacementStaffId?: string;
    replacementBranchId?: string;
    proposedStartAt?: string;
  }) {
    if (!input.reason?.trim()) throw new BadRequestException('Lý do xử lý là bắt buộc');
    const claimed = await this.prisma.operationalImpactItem.updateMany({
      where: { id: itemId, caseId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count !== 1) throw new ConflictException('Booking ảnh hưởng không còn chờ xử lý');

    let finalized = false;
    try {
      const item = await this.prisma.operationalImpactItem.findFirst({
        where: { id: itemId, caseId, status: 'PROCESSING' },
      });
      if (!item) throw new ConflictException('Không thể khóa booking ảnh hưởng để xử lý');
      const impact = await this.prisma.operationalImpactCase.findUniqueOrThrow({ where: { id: caseId } });
      const booking = await this.prisma.booking.findUnique({
        where: { id: item.bookingId },
        include: {
          customer: { select: { userId: true } },
          bookingServices: { include: { staff: { select: { userId: true } } } },
          payments: { include: { refundRequests: true } },
        },
      });
      if (!booking) throw new NotFoundException('Booking không tồn tại');

      if (input.resolution === 'REASSIGN') {
        if (!input.replacementStaffId) throw new BadRequestException('replacementStaffId là bắt buộc');
        for (const service of booking.bookingServices.filter((row) => ['SCHEDULED', 'IN_PROGRESS'].includes(row.status))) {
          await this.bookingItems.update(booking.id, service.id, user.id, {
            action: 'REASSIGN', reason: input.reason, expectedRevision: service.revision, staffId: input.replacementStaffId,
          });
        }
      } else if (input.resolution === 'RESCHEDULE') {
        if (!input.proposedStartAt) throw new BadRequestException('proposedStartAt là bắt buộc');
        const start = new Date(input.proposedStartAt);
        if (!Number.isFinite(start.getTime())) throw new BadRequestException('proposedStartAt không hợp lệ');
        const currentDuration = Number(booking.appointmentEndTime) - Number(booking.appointmentStartTime);
        const end = new Date(start.getTime() + Math.max(0, currentDuration));
        await this.bookings.moveBooking(booking.id, start.toISOString(), end.toISOString(), input.replacementStaffId ?? booking.bookingServices[0]?.staffId ?? '');
      } else if (input.resolution === 'TRANSFER_BRANCH') {
        if (!input.replacementBranchId) throw new BadRequestException('replacementBranchId là bắt buộc');
        await this.transferBranch(booking, input.replacementBranchId, input.replacementStaffId, user.id, input.reason);
      } else if (input.resolution === 'CANCEL_REFUND') {
        if (!['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status)) {
          await this.bookings.updateStatus(booking.id, 'CANCELLED', user.id, input.reason, 'SALON', user.roles);
        }
        for (const payment of booking.payments.filter((row) => ['PAID', 'PARTIALLY_REFUNDED'].includes(row.status))) {
          const already = payment.refundRequests
            .filter((refund) => ['PENDING', 'APPROVED', 'REFUNDED'].includes(refund.status))
            .reduce((sum, refund) => sum + Number(refund.amount), 0);
          const refundable = Math.max(0, Number(payment.amount) - already);
          if (refundable > 0) await this.payments.requestRefund(payment.id, refundable, input.reason, { impactCaseId: caseId }, user);
        }
      } else if (input.resolution !== 'APPROVED_EXCEPTION') {
        throw new BadRequestException('Resolution không hợp lệ');
      }

      const replacementStaff = input.replacementStaffId
        ? await this.prisma.staffProfile.findUnique({ where: { id: input.replacementStaffId }, select: { userId: true } })
        : null;
      const salonUserIds = new Set(
        booking.bookingServices.map((row) => row.staff?.userId).filter((id): id is string => Boolean(id)),
      );
      if (replacementStaff?.userId) salonUserIds.add(replacementStaff.userId);
      const resolutionLabels: Record<typeof input.resolution, string> = {
        REASSIGN: 'đổi nhân viên phụ trách',
        RESCHEDULE: 'đổi thời gian thực hiện',
        TRANSFER_BRANCH: 'chuyển sang chi nhánh khác',
        CANCEL_REFUND: 'hủy và xử lý hoàn tiền',
        APPROVED_EXCEPTION: 'giữ nguyên theo ngoại lệ đã được phê duyệt',
      };
      const label = resolutionLabels[input.resolution];
      const outboxRows: Prisma.NotificationOutboxCreateManyInput[] = [{
        userId: booking.customer.userId,
        type: 'SYSTEM',
        severity: input.resolution === 'CANCEL_REFUND' ? 'WARNING' : 'INFO',
        title: `Lịch hẹn ${booking.bookingCode} đã được cập nhật`,
        body: `Cơ sở đã ${label}. Lý do: ${input.reason.trim()}`,
        targetType: 'BOOKING',
        targetId: booking.id,
        actionUrl: `/customer/appointments/${booking.id}`,
        relatedBookingId: booking.id,
        metadata: { impactCaseId: caseId, impactItemId: itemId, resolution: input.resolution },
        dedupeKey: `impact:${caseId}:${itemId}:${input.resolution}:customer:${booking.customer.userId}`,
      }];
      for (const salonUserId of salonUserIds) {
        outboxRows.push({
          userId: salonUserId,
          type: 'SYSTEM',
          severity: 'INFO',
          title: `Phân công lịch ${booking.bookingCode} đã thay đổi`,
          body: `Phương án xử lý: ${label}.`,
          targetType: 'BOOKING',
          targetId: booking.id,
          actionUrl: `/salon/appointments?bookingId=${encodeURIComponent(booking.id)}`,
          relatedBookingId: booking.id,
          metadata: { impactCaseId: caseId, impactItemId: itemId, resolution: input.resolution },
          dedupeKey: `impact:${caseId}:${itemId}:${input.resolution}:salon:${salonUserId}`,
        });
      }

      await withSerializableTransaction(this.prisma, async (tx) => {
        const updated = await tx.operationalImpactItem.updateMany({
          where: { id: itemId, caseId, status: 'PROCESSING' },
          data: {
            resolution: input.resolution,
            status: 'RESOLVED',
            replacementStaffId: input.replacementStaffId,
            replacementBranchId: input.replacementBranchId,
            proposedStartAt: input.proposedStartAt ? new Date(input.proposedStartAt) : null,
            reason: input.reason.trim(),
            resolvedBy: user.id,
            resolvedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new ConflictException('Booking ảnh hưởng vừa được xử lý bởi thao tác khác');
        await tx.notificationOutbox.createMany({ data: outboxRows, skipDuplicates: true });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE',
            entityType: 'OperationalImpactItem',
            entityId: itemId,
            oldData: { status: 'PENDING', bookingId: booking.id },
            newData: { status: 'RESOLVED', resolution: input.resolution, caseId: impact.id },
            reason: input.reason.trim(),
          },
        });
        const unresolved = await tx.operationalImpactItem.count({ where: { caseId, status: { not: 'RESOLVED' } } });
        await tx.operationalImpactCase.update({
          where: { id: caseId },
          data: { status: unresolved === 0 ? 'READY_TO_COMPLETE' : 'IN_PROGRESS' },
        });
      }, { conflictMessage: 'Impact item vừa thay đổi' });
      finalized = true;
    } catch (error) {
      if (!finalized) {
        await this.prisma.operationalImpactItem.updateMany({
          where: { id: itemId, caseId, status: 'PROCESSING' },
          data: { status: 'PENDING' },
        }).catch(() => undefined);
      }
      throw error;
    }
    return this.detail(caseId);
  }

  async resolveBatch(caseId: string, user: AuthUser, input: {
    itemIds: string[];
    resolution: 'REASSIGN' | 'RESCHEDULE' | 'TRANSFER_BRANCH' | 'CANCEL_REFUND' | 'APPROVED_EXCEPTION';
    reason: string;
    replacementStaffId?: string;
    replacementBranchId?: string;
    proposedStartAt?: string;
  }) {
    const itemIds = [...new Set(input.itemIds ?? [])].slice(0, 100);
    if (!itemIds.length) throw new BadRequestException('Cần chọn ít nhất một booking ảnh hưởng');
    const results: Array<{ itemId: string; ok: boolean; error?: string }> = [];
    for (const itemId of itemIds) {
      try {
        await this.resolveItem(caseId, itemId, user, input);
        results.push({ itemId, ok: true });
      } catch (error) {
        results.push({ itemId, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { results, impact: await this.detail(caseId) };
  }

  async complete(caseId: string, actorId: string) {
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM operational_impact_cases WHERE id = ${caseId} FOR UPDATE`;
      const impact = await tx.operationalImpactCase.findUnique({ where: { id: caseId } });
      if (!impact || impact.status !== 'READY_TO_COMPLETE') throw new ConflictException('Impact case chưa sẵn sàng hoàn tất');
      const pending = await tx.operationalImpactItem.count({ where: { caseId, status: { not: 'RESOLVED' } } });
      if (pending) throw new ConflictException('Vẫn còn booking chưa được xử lý');
      const updated = await tx.operationalImpactCase.update({ where: { id: caseId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'STATUS_CHANGE', entityType: 'OperationalImpactCase', entityId: caseId, newData: { status: 'COMPLETED' } } });
      return updated;
    }, { conflictMessage: 'Impact case vừa thay đổi' });
  }

  private async transferBranch(booking: any, branchId: string, staffId: string | undefined, actorId: string, reason: string) {
    return withSerializableTransaction(this.prisma, async (tx) => {
      const branch = await tx.branch.findFirst({ where: { id: branchId, status: 'ACTIVE', operationalStatus: 'ACTIVE', deletedAt: null } });
      if (!branch) throw new BadRequestException('Chi nhánh đích không nhận lịch');
      const source = await tx.branch.findUniqueOrThrow({ where: { id: booking.branchId } });
      if (branch.businessId !== source.businessId) throw new BadRequestException('Chỉ được chuyển lịch trong cùng doanh nghiệp');
      for (const item of booking.bookingServices) {
        const replacement = await tx.branchServiceOffering.findFirst({ where: { branchId, businessServiceId: item.businessServiceId, status: 'ACTIVE', bookable: true, deletedAt: null } });
        if (!replacement) throw new ConflictException(`Chi nhánh đích không có dịch vụ ${item.serviceNameSnapshot}`);
        await tx.bookingService.update({ where: { id: item.id }, data: { serviceId: replacement.id, staffId: staffId ?? null, revision: { increment: 1 } } });
      }
      await tx.booking.update({ where: { id: booking.id }, data: { branchId } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'UPDATE', entityType: 'Booking', entityId: booking.id, oldData: { branchId: booking.branchId }, newData: { branchId }, reason } });
    }, { conflictMessage: 'Booking vừa được chuyển bởi thao tác khác' });
  }
}
