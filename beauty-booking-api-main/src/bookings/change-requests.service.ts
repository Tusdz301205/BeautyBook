import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertFutureAppointment,
  assertNoOverlap,
  assertCustomerNotDoubleBooked,
  assertStatusTransition,
  validateStaffForService,
} from './bookings.validation';
import {
  resolveCancellationPolicy,
  resolveRescheduleCutoffHours,
} from '../common/utils/policy';
import { notifyBookingBothParties } from '../common/utils/notify';
import {
  combineAppointmentDateTime,
  normalizeAppointmentForStorage,
  sameAppointmentDate,
  toBookingInterval,
} from '../common/utils/booking-datetime';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { BookingsService } from './bookings.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { cancelUnfinishedBookingItems } from './booking-item-lifecycle';

@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly bookings: BookingsService,
  ) {}

  async expirePending(bookingId?: string): Promise<number> {
    const result = await this.prisma.appointmentChangeRequest.updateMany({
      where: {
        ...(bookingId ? { bookingId } : {}),
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  /**
   * Khách (CUSTOMER) hoặc Salon (SALON) gửi yêu cầu thay đổi lịch.
   *
   * QUY TẮC NGHIỆP VỤ:
   *  - Phải qua AppointmentChangeRequest, KHÔNG update trực tiếp booking.
   *    → giữ dấu vết yêu cầu gốc.
   *  - expiresAt: ví dụ 24h để salon phản hồi, nếu quá → EXPIRED.
   */
  async create(
    bookingId: string,
    requestedBy: string,
    requestedByType: 'CUSTOMER' | 'SALON' | 'ADMIN' | 'SYSTEM',
    body: {
      requestType: 'RESCHEDULE' | 'STAFF_CHANGE' | 'CANCEL';
      proposedStartTime?: string;
      proposedEndTime?: string;
      proposedStaffId?: string;
      reason?: string;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { bookingServices: true, branch: { select: { businessId: true } } },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(
        'Lịch hẹn không còn ở trạng thái cho phép gửi yêu cầu thay đổi',
      );
    }

    if (requestedByType === 'CUSTOMER' && body.requestType === 'RESCHEDULE') {
      const policy = await this.platformSettings.getEffective();
      if (!policy.allowRescheduleRequests) {
        throw new ForbiddenException('Nền tảng hiện không cho phép gửi yêu cầu đổi lịch.');
      }
      const rescheduleCount = await this.prisma.appointmentChangeRequest.count({
        where: { bookingId, requestType: 'RESCHEDULE' },
      });
      if (rescheduleCount >= policy.maxRescheduleCountPerBooking) {
        throw new BadRequestException('Lịch hẹn này đã đạt số lần đổi lịch tối đa.');
      }
    }

    const now = new Date();
    await this.expirePending(bookingId);
    const existingPending = await this.prisma.appointmentChangeRequest.findFirst({
      where: { bookingId, status: 'PENDING', expiresAt: { gt: now } },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException('Booking đã có yêu cầu thay đổi đang chờ xử lý');
    }

    // Auto-expire 24h sau khi tạo
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.prisma.appointmentChangeRequest.create({
      data: {
        bookingId,
        requestedBy,
        requestedByType,
        requestType: body.requestType,
        proposedStartTime: body.proposedStartTime ? new Date(body.proposedStartTime) : null,
        proposedEndTime: body.proposedEndTime ? new Date(body.proposedEndTime) : null,
        proposedStaffId: body.proposedStaffId ?? null,
        reason: body.reason,
        expiresAt,
      },
    });
  }

  /**
   * Liệt kê yêu cầu PENDING (cho salon queue).
   */
  async listPending(allowedBusinessIds?: string[], allowedBranchIds?: string[]) {
    const now = new Date();
    await this.expirePending();
    const where: any = { status: 'PENDING', expiresAt: { gt: now } };
    if (allowedBranchIds) {
      where.booking = { branchId: { in: allowedBranchIds } };
    } else if (allowedBusinessIds && allowedBusinessIds.length > 0) {
      where.booking = {
        branch: { businessId: { in: allowedBusinessIds } },
      };
    }
    const reqs = await this.prisma.appointmentChangeRequest.findMany({
      where,
      include: {
        booking: {
          include: {
            branch: { include: { business: true } },
            bookingServices: { include: { service: true } },
            customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
          },
        },
        proposedStaff: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
        requestedByUser: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return reqs;
  }

  /**
   * Salon duyệt yêu cầu → áp dụng thay đổi vào booking.
   */
  async approve(reqId: string, reviewerId: string, reviewNote?: string) {
    const req = await this.prisma.appointmentChangeRequest.findUnique({
      where: { id: reqId },
      include: {
        booking: {
          include: {
            bookingServices: true,
            branch: { select: { id: true, businessId: true } },
          },
        },
      },
    });
    if (!req) throw new NotFoundException('Yêu cầu không tồn tại');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Yêu cầu đã xử lý');
    }
    if (req.expiresAt <= new Date()) {
      await this.prisma.appointmentChangeRequest.updateMany({
        where: { id: reqId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      throw new ConflictException('Yêu cầu đã hết hạn');
    }

    const updates: any = {};
    if (req.requestType === 'RESCHEDULE' && req.proposedStartTime && req.proposedEndTime) {
      // Validate theo policy salon
      const cutoff = await resolveRescheduleCutoffHours(
        this.prisma,
        req.booking.branch.businessId,
      );
      const currentStart = combineAppointmentDateTime(
        req.booking.appointmentDate,
        req.booking.appointmentStartTime,
      );
      const diffMs = currentStart.getTime() - Date.now();
      if (diffMs < cutoff * 60 * 60 * 1000) {
        throw new BadRequestException(`Đổi lịch phải trước giờ hẹn ${cutoff}h`);
      }
      assertFutureAppointment(req.proposedStartTime);
      if (!sameAppointmentDate(req.proposedStartTime, req.proposedEndTime)) {
        throw new BadRequestException('Booking qua ngày chưa được hỗ trợ');
      }
      const currentInterval = toBookingInterval(
        req.booking.appointmentDate,
        req.booking.appointmentStartTime,
        req.booking.appointmentEndTime,
      );
      if (
        req.proposedEndTime.getTime() - req.proposedStartTime.getTime() !==
        currentInterval.end.getTime() - currentInterval.start.getTime()
      ) {
        throw new BadRequestException('Đổi lịch phải giữ nguyên thời lượng dịch vụ');
      }
      const storedAppointment = normalizeAppointmentForStorage(
        req.proposedStartTime,
        req.proposedEndTime,
      );
      updates.appointmentDate = storedAppointment.appointmentDate;
      updates.appointmentStartTime = storedAppointment.appointmentStartTime;
      updates.appointmentEndTime = storedAppointment.appointmentEndTime;
    }
    if (req.requestType === 'STAFF_CHANGE' && req.proposedStaffId) {
      const currentInterval = toBookingInterval(
        req.booking.appointmentDate,
        req.booking.appointmentStartTime,
        req.booking.appointmentEndTime,
      );
      if (req.booking.bookingServices[0]?.serviceId) {
        await validateStaffForService(
          this.prisma,
          req.proposedStaffId,
          req.booking.bookingServices[0].serviceId,
          currentInterval.start,
          currentInterval.end,
          req.booking.branch.id,
        );
      }
    }
    if (req.requestType === 'CANCEL') {
      updates.status = 'CANCELLED';
      updates.pendingExpiresAt = null;
      updates.cancelledAt = new Date();
      updates.cancelledBy = reviewerId;
      updates.cancelledByType = 'SALON';
      updates.cancelReason = reviewNote ?? req.reason;
    }

    const updated = await withSerializableTransaction(this.prisma, async (tx) => {
      const claimed = await tx.appointmentChangeRequest.updateMany({
        where: { id: reqId, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Yêu cầu đã hết hạn hoặc được xử lý bởi người khác');
      }
      await tx.$queryRaw`SELECT 1 FROM bookings WHERE id = ${req.bookingId} FOR UPDATE`;
      const lockedBooking = await tx.booking.findUnique({
        where: { id: req.bookingId },
        include: {
          bookingServices: true,
          branch: { select: { id: true, businessId: true } },
        },
      });
      if (!lockedBooking) {
        throw new NotFoundException('Không tìm thấy lịch hẹn');
      }
      if (!['PENDING', 'CONFIRMED'].includes(lockedBooking.status)) {
        throw new ConflictException(
          'Lịch hẹn đã sang trạng thái không còn cho phép thay đổi yêu cầu này',
        );
      }

      const transactionClient = tx as unknown as PrismaService;
      if (
        req.requestType === 'RESCHEDULE' &&
        req.proposedStartTime &&
        req.proposedEndTime
      ) {
        const cutoff = await resolveRescheduleCutoffHours(
          transactionClient,
          lockedBooking.branch.businessId,
        );
        const lockedStart = combineAppointmentDateTime(
          lockedBooking.appointmentDate,
          lockedBooking.appointmentStartTime,
        );
        if (lockedStart.getTime() - Date.now() < cutoff * 60 * 60 * 1000) {
          throw new BadRequestException(
            `Đổi lịch phải trước giờ hẹn ${cutoff}h`,
          );
        }
        const currentInterval = toBookingInterval(
          lockedBooking.appointmentDate,
          lockedBooking.appointmentStartTime,
          lockedBooking.appointmentEndTime,
        );
        const shiftMs = req.proposedStartTime.getTime() - currentInterval.start.getTime();
        for (const item of lockedBooking.bookingServices) {
          const targetStaffId = req.proposedStaffId ?? item.staffId;
          const itemStartAt = item.itemStartAt
            ? new Date(item.itemStartAt.getTime() + shiftMs)
            : req.proposedStartTime;
          const itemEndAt = item.itemEndAt
            ? new Date(item.itemEndAt.getTime() + shiftMs)
            : req.proposedEndTime;
          if (targetStaffId) {
            await validateStaffForService(
              transactionClient,
              targetStaffId,
              item.serviceId,
              itemStartAt,
              itemEndAt,
              lockedBooking.branchId,
            );
            await assertNoOverlap(
              transactionClient,
              targetStaffId,
              req.bookingId,
              itemStartAt,
              itemEndAt,
            );
          }
        }
        await assertCustomerNotDoubleBooked(
          transactionClient,
          lockedBooking.customerId,
          req.bookingId,
          req.proposedStartTime,
          req.proposedEndTime,
        );
      }

      if (req.requestType === 'STAFF_CHANGE' && req.proposedStaffId) {
        const interval = toBookingInterval(
          lockedBooking.appointmentDate,
          lockedBooking.appointmentStartTime,
          lockedBooking.appointmentEndTime,
        );
        for (const serviceId of new Set(
          lockedBooking.bookingServices.map((item) => item.serviceId),
        )) {
          await validateStaffForService(
            transactionClient,
            req.proposedStaffId,
            serviceId,
            interval.start,
            interval.end,
            lockedBooking.branchId,
          );
        }
        await assertNoOverlap(
          transactionClient,
          req.proposedStaffId,
          req.bookingId,
          interval.start,
          interval.end,
        );
      }

      if (req.requestType === 'CANCEL') {
        assertStatusTransition(lockedBooking.status, 'CANCELLED');
        const platformPolicy = await this.platformSettings.getEffective();
        const cancellation = await resolveCancellationPolicy(
          transactionClient,
          lockedBooking.branch.businessId,
          Number(lockedBooking.totalAmount),
          combineAppointmentDateTime(
            lockedBooking.appointmentDate,
            lockedBooking.appointmentStartTime,
          ),
          new Date(),
          platformPolicy.freeCancellationHours,
        );
        if (cancellation.policy === 'too_late') {
          throw new BadRequestException(
            cancellation.notes ??
              'Yêu cầu hủy đã qua thời hạn cho phép',
          );
        }
        // Cancellation fees are retired; clear any legacy snapshot.
        updates.cancellationFeeAmount = null;
        if (cancellation.policy === 'warn_late_cancel') {
          updates.cancelReason =
            `[Cảnh báo: ${cancellation.notes ?? 'hủy sát giờ'}] ` +
            (reviewNote ?? req.reason ?? '');
        }
      }
      if (
        req.requestType === 'RESCHEDULE' &&
        req.proposedStartTime &&
        req.proposedEndTime
      ) {
        const currentInterval = toBookingInterval(
          lockedBooking.appointmentDate,
          lockedBooking.appointmentStartTime,
          lockedBooking.appointmentEndTime,
        );
        const shiftMs = req.proposedStartTime.getTime() - currentInterval.start.getTime();
        const orderedItems = [...lockedBooking.bookingServices].sort((left, right) =>
          (req.proposedStaffId ?? left.staffId ?? '').localeCompare(
            req.proposedStaffId ?? right.staffId ?? '',
          ) || left.id.localeCompare(right.id),
        );
        for (const item of orderedItems) {
          await tx.bookingService.update({
            where: { id: item.id },
            data: {
              staffId: req.proposedStaffId ?? item.staffId,
              itemStartAt: item.itemStartAt
                ? new Date(item.itemStartAt.getTime() + shiftMs)
                : req.proposedStartTime,
              itemEndAt: item.itemEndAt
                ? new Date(item.itemEndAt.getTime() + shiftMs)
                : req.proposedEndTime,
            },
          });
        }
      } else if (req.requestType === 'STAFF_CHANGE' && req.proposedStaffId) {
        await tx.bookingService.updateMany({
          where: { bookingId: req.bookingId },
          data: { staffId: req.proposedStaffId },
        });
      }

      if (req.requestType === 'CANCEL') {
        await cancelUnfinishedBookingItems(tx, req.bookingId);
      }

      const b = await tx.booking.update({
        where: { id: req.bookingId },
        data: updates,
        include: {
          customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
          branch: { include: { business: true } },
          bookingServices: true,
        },
      });

      if (req.requestType === 'CANCEL') {
        await this.bookings.releaseBookingBenefits(
          tx,
          req.bookingId,
          lockedBooking.voucherId,
          lockedBooking.bookingServices.find((item) => item.comboId)?.comboId ??
            null,
        );
      }

      // Ghi status_history
      if (Object.keys(updates).length > 0) {
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: req.bookingId,
            status: (updates.status ?? b.status) as any,
            changedBy: reviewerId,
            note: `Duyệt ${req.requestType}: ${reviewNote ?? ''}`.trim(),
          },
        });
      }
      return b;
    }, {
      conflictMessage:
        'Yêu cầu hoặc lịch hẹn vừa thay đổi, vui lòng tải lại',
    });

    await notifyBookingBothParties(
      this.prisma,
      req.bookingId,
      'BOOKING_RESCHEDULE_APPROVED' as any,
      req.requestType === 'CANCEL' ? 'Đã huỷ theo yêu cầu' : 'Yêu cầu đã được duyệt',
      reviewNote ?? 'Salon đã chấp nhận yêu cầu của bạn',
    );

    return updated;
  }

  async reject(reqId: string, reviewerId: string, reviewNote?: string) {
    const req = await this.prisma.appointmentChangeRequest.findUnique({
      where: { id: reqId },
    });
    if (!req) throw new NotFoundException('Yêu cầu không tồn tại');
    if (req.status !== 'PENDING') throw new BadRequestException('Yêu cầu đã xử lý');

    await this.prisma.$transaction(async (tx) => {
      const rejected = await tx.appointmentChangeRequest.updateMany({
        where: { id: reqId, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote,
        },
      });
      if (rejected.count !== 1) {
        throw new ConflictException('Yêu cầu đã hết hạn hoặc được xử lý bởi người khác');
      }
      const booking = await tx.booking.findUnique({
        where: { id: req.bookingId },
        select: { status: true },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: req.bookingId,
          status: (booking?.status ?? 'PENDING') as any,
          changedBy: reviewerId,
          note: `Từ chối yêu cầu ${req.requestType}: ${reviewNote ?? ''}`.trim(),
        },
      });
    });

    await notifyBookingBothParties(
      this.prisma,
      req.bookingId,
      'BOOKING_RESCHEDULE_REJECTED' as any,
      'Yêu cầu bị từ chối',
      reviewNote ?? 'Salon không chấp nhận yêu cầu của bạn',
    );

    return { ok: true };
  }

}
