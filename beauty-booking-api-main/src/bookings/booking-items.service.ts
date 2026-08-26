import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertNoOverlap, validateStaffForService } from './bookings.validation';
import { toBookingInterval } from '../common/utils/booking-datetime';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

type ItemAction = 'REMOVE' | 'SKIP' | 'REASSIGN' | 'START' | 'COMPLETE' | 'RESIZE' | 'REPRICE';

@Injectable()
export class BookingItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async add(bookingId: string, actorId: string, input: {
    serviceId: string;
    variantId?: string;
    staffId?: string;
    reason: string;
    durationMinutes?: number;
    price?: number;
  }) {
    if (!input.reason?.trim()) throw new BadRequestException('Lý do thay đổi là bắt buộc');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, deletedAt: null },
        include: { bookingServices: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy lịch hẹn');
      if (!['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(booking.status)) {
        throw new ConflictException('Không thể thêm dịch vụ vào lịch ở trạng thái hiện tại');
      }
      const service = await tx.branchServiceOffering.findFirst({
        where: { id: input.serviceId, branchId: booking.branchId, status: 'ACTIVE', bookable: true, deletedAt: null },
        include: { businessService: { select: { canonicalServiceId: true } } },
      });
      if (!service) throw new BadRequestException('Dịch vụ không khả dụng tại chi nhánh này');
      const variant = input.variantId
        ? await tx.serviceVariant.findFirst({ where: { id: input.variantId, serviceId: service.id, status: 'ACTIVE', deletedAt: null } })
        : null;
      if (input.variantId && !variant) throw new BadRequestException('Biến thể dịch vụ không hợp lệ');
      if (variant?.consultationRequired) {
        const consultation = await tx.consultationSubmission.findFirst({
          where: { customerId: booking.customerId, serviceId: service.id, status: { in: ['SUBMITTED', 'REVIEWED', 'APPROVED'] as any } },
          select: { id: true },
        });
        if (!consultation) throw new ConflictException('Dịch vụ này cần hoàn tất tư vấn trước khi thêm vào lịch');
      }
      const duration = input.durationMinutes ?? variant?.durationMinutes ?? service.durationMinutes;
      const price = input.price ?? Number(variant?.price ?? service.price);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(price) || price < 0) {
        throw new BadRequestException('Giá hoặc thời lượng không hợp lệ');
      }
      const interval = toBookingInterval(booking.appointmentDate, booking.appointmentStartTime, booking.appointmentEndTime);
      const previousEnd = booking.bookingServices[booking.bookingServices.length - 1]?.itemEndAt ?? interval.start;
      const itemStartAt = new Date(previousEnd);
      const itemEndAt = new Date(itemStartAt.getTime() + duration * 60_000);
      if (input.staffId) {
        await validateStaffForService(tx as unknown as PrismaService, input.staffId, service.id, itemStartAt, itemEndAt, booking.branchId);
        await assertNoOverlap(tx as unknown as PrismaService, input.staffId, bookingId, itemStartAt, itemEndAt);
      }
      const created = await tx.bookingService.create({
        data: {
          bookingId,
          serviceId: service.id,
          businessServiceId: service.businessServiceId,
          canonicalServiceId: service.businessService.canonicalServiceId,
          variantId: variant?.id,
          staffId: input.staffId,
          priceAtBooking: price,
          durationMinutes: duration,
          serviceNameSnapshot: variant ? `${service.name} — ${variant.name}` : service.name,
          sortOrder: booking.bookingServices.length,
          itemStartAt,
          itemEndAt,
        },
      });
      await this.recordAdjustment(tx, created, actorId, 'ADD', input.reason, {}, created, price);
      await this.applyAmountDelta(tx, booking, created.id, actorId, price, input.reason);
      await tx.booking.update({
        where: { id: bookingId },
        data: { appointmentEndTime: itemEndAt },
      });
      return this.detail(tx, bookingId);
    }, { conflictMessage: 'Lịch vừa được chỉnh sửa; vui lòng tải lại và thử lại' });
  }

  async update(bookingId: string, itemId: string, actorId: string, input: {
    action: ItemAction;
    reason: string;
    expectedRevision: number;
    staffId?: string;
    durationMinutes?: number;
    price?: number;
  }) {
    if (!input.reason?.trim()) throw new BadRequestException('Lý do thay đổi là bắt buộc');
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision không hợp lệ');
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM booking_services WHERE id = ${itemId} FOR UPDATE`;
      const item = await tx.bookingService.findFirst({
        where: { id: itemId, bookingId },
        include: { booking: true },
      });
      if (!item) throw new NotFoundException('Không tìm thấy dịch vụ trong lịch hẹn');
      if (item.revision !== input.expectedRevision) {
        throw new ConflictException('Dịch vụ vừa được người khác chỉnh sửa; vui lòng tải lại');
      }
      if (!['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(item.booking.status)) {
        throw new ConflictException('Không thể sửa dịch vụ ở trạng thái lịch hiện tại');
      }
      const before = this.snapshot(item);
      let data: Prisma.BookingServiceUncheckedUpdateManyInput = { revision: { increment: 1 } };
      let amountDelta = 0;

      if (input.action === 'REMOVE') {
        if (item.status !== 'SCHEDULED') throw new ConflictException('Chỉ dịch vụ chưa bắt đầu mới có thể xóa');
        data = { ...data, status: 'CANCELLED' };
        amountDelta = -Number(item.priceAtBooking);
      } else if (input.action === 'SKIP') {
        if (!['SCHEDULED', 'IN_PROGRESS'].includes(item.status)) throw new ConflictException('Không thể bỏ qua dịch vụ này');
        data = { ...data, status: 'SKIPPED', skippedReason: input.reason.trim() };
        amountDelta = item.status === 'SCHEDULED' ? -Number(item.priceAtBooking) : 0;
      } else if (input.action === 'REASSIGN') {
        if (!input.staffId) throw new BadRequestException('staffId là bắt buộc');
        const startAt = item.itemStartAt ?? toBookingInterval(item.booking.appointmentDate, item.booking.appointmentStartTime, item.booking.appointmentEndTime).start;
        const endAt = item.itemEndAt ?? new Date(startAt.getTime() + item.durationMinutes * 60_000);
        await validateStaffForService(tx as unknown as PrismaService, input.staffId, item.serviceId, startAt, endAt, item.booking.branchId);
        await assertNoOverlap(tx as unknown as PrismaService, input.staffId, bookingId, startAt, endAt);
        data = { ...data, staffId: input.staffId };
      } else if (input.action === 'START') {
        if (item.status !== 'SCHEDULED') throw new ConflictException('Dịch vụ không ở trạng thái chờ bắt đầu');
        if (!['CHECKED_IN', 'IN_PROGRESS'].includes(item.booking.status)) throw new ConflictException('Khách cần check-in trước khi bắt đầu dịch vụ');
        data = { ...data, status: 'IN_PROGRESS' };
        if (item.booking.status !== 'IN_PROGRESS') await tx.booking.update({ where: { id: bookingId }, data: { status: 'IN_PROGRESS' } });
      } else if (input.action === 'COMPLETE') {
        if (item.status !== 'IN_PROGRESS') throw new ConflictException('Dịch vụ cần được bắt đầu trước khi hoàn thành');
        data = { ...data, status: 'COMPLETED' };
      } else if (input.action === 'RESIZE') {
        if (!input.durationMinutes || input.durationMinutes <= 0) throw new BadRequestException('durationMinutes không hợp lệ');
        const startAt = item.itemStartAt ?? new Date();
        data = { ...data, durationMinutes: input.durationMinutes, itemEndAt: new Date(startAt.getTime() + input.durationMinutes * 60_000) };
      } else if (input.action === 'REPRICE') {
        if (input.price === undefined || input.price < 0) throw new BadRequestException('price không hợp lệ');
        amountDelta = input.price - Number(item.priceAtBooking);
        data = { ...data, priceAtBooking: input.price };
      } else {
        throw new BadRequestException('Action dịch vụ không được hỗ trợ');
      }

      const claimed = await tx.bookingService.updateMany({
        where: { id: itemId, bookingId, revision: input.expectedRevision },
        data,
      });
      if (claimed.count !== 1) throw new ConflictException('Dịch vụ vừa được chỉnh sửa');
      const after = await tx.bookingService.findUniqueOrThrow({ where: { id: itemId } });
      await this.recordAdjustment(tx, item, actorId, input.action, input.reason, before, this.snapshot(after), amountDelta);
      if (amountDelta !== 0) await this.applyAmountDelta(tx, item.booking, itemId, actorId, amountDelta, input.reason);
      return this.detail(tx, bookingId);
    }, { conflictMessage: 'Dịch vụ vừa được chỉnh sửa; vui lòng tải lại và thử lại' });
  }

  private snapshot(item: any) {
    return {
      id: item.id, status: item.status, staffId: item.staffId, variantId: item.variantId,
      price: Number(item.priceAtBooking), durationMinutes: item.durationMinutes,
      itemStartAt: item.itemStartAt, itemEndAt: item.itemEndAt, revision: item.revision,
    };
  }

  private async recordAdjustment(tx: Prisma.TransactionClient, item: any, actorId: string, action: ItemAction | 'ADD', reason: string, before: any, after: any, amountDelta: number) {
    const version = await tx.bookingServiceAdjustment.count({ where: { bookingServiceId: item.id } }) + 1;
    await tx.bookingServiceAdjustment.create({
      data: {
        bookingServiceId: item.id,
        bookingId: item.bookingId,
        actorId,
        action,
        reason: reason.trim(),
        beforeSnapshot: before as Prisma.InputJsonValue,
        afterSnapshot: after as Prisma.InputJsonValue,
        amountDelta,
        version,
      },
    });
  }

  private async applyAmountDelta(tx: Prisma.TransactionClient, booking: any, itemId: string, actorId: string, delta: number, reason: string) {
    const nextTotal = Math.max(0, Number(booking.totalAmount) + delta);
    const nextFinal = Math.max(0, Number(booking.finalAmount ?? booking.totalAmount) + delta);
    await tx.booking.update({ where: { id: booking.id }, data: { totalAmount: nextTotal, finalAmount: nextFinal } });
    await tx.priceAdjustment.create({
      data: {
        bookingId: booking.id,
        branchId: booking.branchId,
        customerId: booking.customerId,
        type: 'MANUAL',
        sourceId: itemId,
        label: delta > 0 ? 'Phần dịch vụ phát sinh cần thu' : 'Phần dịch vụ giảm có thể hoàn',
        amount: delta,
        allocation: { bookingServiceId: itemId } as Prisma.InputJsonValue,
        ruleSnapshot: { reason, actorId, previousFinal: Number(booking.finalAmount ?? booking.totalAmount), nextFinal } as Prisma.InputJsonValue,
        status: 'APPLIED',
        appliedAt: new Date(),
      },
    });
  }

  private async detail(tx: Prisma.TransactionClient, bookingId: string) {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        bookingServices: { include: { service: true, staff: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    const terminal = booking.bookingServices.every((item: any) => ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(item.status));
    return { ...booking, readyToComplete: terminal };
  }
}
