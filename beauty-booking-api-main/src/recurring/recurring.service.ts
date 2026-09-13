import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { validateStaffForService } from '../bookings/bookings.validation';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { CreateRecurringPlanDto, RecurringPreviewDto } from './dto/recurring.dto';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService, private readonly bookings: BookingsService) {}

  async preview(input: RecurringPreviewDto, user: AuthUser) {
    await this.customerId(user);
    const resolved = await this.resolveServices(input);
    const dates = this.generateDates(input);
    const occurrences = [] as Array<{ appointmentDate: string; available: boolean; staffId: string | null; reason?: string }>;
    for (const appointmentDate of dates) {
      const start = this.toInstant(appointmentDate, input.preferredTime);
      const end = new Date(start.getTime() + resolved.durationMinutes * 60_000);
      const staffId = await this.findStaff(input, resolved.serviceIds, start, end);
      occurrences.push({
        appointmentDate: start.toISOString(),
        available: Boolean(staffId),
        staffId,
        ...(!staffId ? { reason: 'Không còn nhân viên phù hợp trong khung giờ này' } : {}),
      });
    }
    return {
      serviceIds: resolved.serviceIds,
      comboId: input.comboId ?? null,
      durationMinutes: resolved.durationMinutes,
      occurrences,
      availableCount: occurrences.filter((item) => item.available).length,
      conflictCount: occurrences.filter((item) => !item.available).length,
    };
  }

  async create(input: CreateRecurringPlanDto, user: AuthUser) {
    const customerId = await this.customerId(user);
    const preview = await this.preview(input, user);
    if (preview.conflictCount > 0 && !input.skipConflicts) {
      throw new ConflictException({
        message: 'Một số kỳ bị trùng lịch. Hãy đổi giờ hoặc chọn bỏ qua các kỳ xung đột.',
        occurrences: preview.occurrences,
      });
    }
    const candidates = preview.occurrences.filter((item) => item.available);
    if (candidates.length === 0) throw new ConflictException('Không có kỳ nào còn chỗ');
    const plan = await this.prisma.recurringBookingPlan.create({
      data: {
        customerId,
        branchId: input.branchId,
        frequency: input.frequency,
        serviceIds: preview.serviceIds,
        comboId: input.comboId,
        staffId: input.staffMode === 'SAME_STAFF' ? input.staffId : null,
        staffMode: input.staffMode,
        preferredTime: input.preferredTime,
        occurrenceCount: candidates.length,
        dayOfWeek: new Date(input.startDate).getUTCDay(),
        dayOfMonth: new Date(input.startDate).getUTCDate(),
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        status: 'CREATING',
        createdOccurrenceCount: 0,
      },
    });
    const createdIds: string[] = [];
    try {
      for (const occurrence of candidates) {
        const booking = await this.bookings.create({
          customerId,
          branchId: input.branchId,
          serviceIds: preview.serviceIds,
          comboId: input.comboId,
          staffId: input.staffMode === 'SAME_STAFF' ? input.staffId : occurrence.staffId ?? undefined,
          appointmentDate: occurrence.appointmentDate,
          recurringPlanId: plan.id,
          note: input.note,
          createdBy: user.id,
          source: 'ONLINE_WEB',
        });
        createdIds.push(booking.id);
      }
      const activated = await this.prisma.recurringBookingPlan.updateMany({
        where: { id: plan.id, status: 'CREATING', deletedAt: null },
        data: {
          status: 'ACTIVE',
          createdOccurrenceCount: createdIds.length,
          failureReason: null,
        },
      });
      if (activated.count !== 1) throw new ConflictException('Chuỗi lịch đã dừng tạo. Vui lòng kiểm tra các kỳ đã có.');
    } catch (error) {
      // Claim failure before compensation. A recovered/cancelled plan must not
      // be overwritten or have its retained occurrences cancelled by a late caller.
      const pendingReason = 'Tạo chuỗi thất bại; đang kiểm tra hoàn tác các kỳ đã tạo';
      const committedIds = await withSerializableTransaction(this.prisma, async (tx) => {
        const claim = await tx.recurringBookingPlan.updateMany({
          where: { id: plan.id, status: 'CREATING', deletedAt: null },
          data: { status: 'FAILED', failureReason: pendingReason },
        });
        if (claim.count !== 1) return null;
        // Includes a booking committed before create() failed during its response
        // or notification phase, even if its id never reached this process.
        const rows = await tx.booking.findMany({
          where: { recurringPlanId: plan.id, deletedAt: null }, select: { id: true },
        });
        await tx.recurringBookingPlan.update({
          where: { id: plan.id }, data: { createdOccurrenceCount: rows.length },
        });
        return rows.map((row) => row.id);
      });
      if (!committedIds) throw error;
      let compensationFailed = false;
      try {
        await this.bookings.compensateCreatedBookings(
          committedIds,
          'Hoàn tác do không thể tạo trọn vẹn chuỗi lịch',
        );
      } catch {
        compensationFailed = true;
      }
      await this.prisma.recurringBookingPlan.updateMany({
        where: { id: plan.id, status: 'FAILED', failureReason: pendingReason },
        data: {
          status: 'FAILED',
          createdOccurrenceCount: committedIds.length,
          failureReason: compensationFailed
            ? 'Tạo chuỗi thất bại; hoàn tác chưa hoàn tất và cần kiểm tra thủ công'
            : 'Tạo chuỗi thất bại; các kỳ đã tạo được hoàn tác bằng trạng thái CANCELLED',
        },
      });
      if (compensationFailed) {
        throw new ConflictException(
          'Tạo chuỗi thất bại và hệ thống chưa thể hoàn tác đầy đủ; mã chuỗi cần được kiểm tra thủ công',
        );
      }
      throw error;
    }
    return this.prisma.recurringBookingPlan.findUnique({
      where: { id: plan.id },
      include: { bookings: { include: { branch: true, bookingServices: { include: { service: true, staff: true } } }, orderBy: { appointmentDate: 'asc' } } },
    });
  }

  async mine(user: AuthUser) {
    const customerId = await this.customerId(user);
    return this.prisma.recurringBookingPlan.findMany({
      where: { customerId, deletedAt: null },
      include: {
        branch: { include: { business: { select: { id: true, name: true } } } },
        combo: true,
        staff: true,
        bookings: { where: { deletedAt: null }, include: { bookingServices: { include: { service: true, staff: true } } }, orderBy: { appointmentDate: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changeStatus(id: string, status: 'ACTIVE' | 'PAUSED', user: AuthUser) {
    const plan = await this.owned(id, user);
    if (!['ACTIVE', 'PAUSED'].includes(plan.status)) throw new BadRequestException('Chuỗi lịch này không thể thay đổi');
    const changed = await this.prisma.recurringBookingPlan.updateMany({
      where: { id, customerId: plan.customerId, status: plan.status, deletedAt: null }, data: { status },
    });
    if (changed.count !== 1) throw new ConflictException('Chuỗi lịch vừa thay đổi, vui lòng tải lại');
    return this.prisma.recurringBookingPlan.findUnique({ where: { id } });
  }

  async cancelOccurrence(id: string, bookingId: string, user: AuthUser) {
    await this.owned(id, user);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, recurringPlanId: id, deletedAt: null } });
    if (!booking) throw new NotFoundException('Kỳ lịch hẹn không tồn tại');
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw new BadRequestException('Kỳ này không còn có thể huỷ');
    await this.bookings.updateStatus(
      bookingId,
      'CANCELLED',
      user.id,
      'Khách hủy một kỳ trong chuỗi lịch',
      'CUSTOMER',
      user.roles,
    );
    return { ok: true };
  }

  async cancel(id: string, user: AuthUser) {
    const plan = await this.owned(id, user);
    if (plan.status === 'CREATING') throw new ConflictException('Chuỗi lịch đang được tạo, vui lòng chờ và tải lại');
    const cancellable = await this.prisma.booking.findMany({
      where: { recurringPlanId: id, deletedAt: null, status: { in: ['PENDING', 'CONFIRMED'] } }, select: { id: true },
    });
    const ids = cancellable.map((item) => item.id);
    const cancelledOccurrences =
      await this.bookings.cancelRecurringPlanOccurrences(
        id,
        ids,
        user.id,
        'Khách hủy chuỗi lịch',
      );
    return { ok: true, cancelledOccurrences };
  }

  private async owned(id: string, user: AuthUser) {
    const customerId = await this.customerId(user);
    const plan = await this.prisma.recurringBookingPlan.findFirst({ where: { id, customerId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Chuỗi lịch không tồn tại');
    return plan;
  }

  private async customerId(user: AuthUser) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!profile) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return profile.id;
  }

  private async resolveServices(input: RecurringPreviewDto) {
    let serviceIds = input.serviceIds ?? [];
    let quantities = new Map(serviceIds.map((id) => [id, 1]));
    if (input.comboId) {
      const combo = await this.prisma.combo.findFirst({
        where: { id: input.comboId, branchId: input.branchId, status: 'ACTIVE', deletedAt: null },
        include: { comboServices: true },
      });
      if (!combo) throw new BadRequestException('Combo không hợp lệ');
      quantities = new Map(combo.comboServices.map((item) => [item.serviceId, item.quantity]));
      serviceIds = [...quantities.keys()];
    }
    const services = await this.prisma.branchServiceOffering.findMany({ where: { id: { in: serviceIds }, branchId: input.branchId, status: 'ACTIVE', deletedAt: null } });
    if (services.length !== new Set(serviceIds).size) throw new BadRequestException('Dịch vụ không hợp lệ hoặc khác chi nhánh');
    return {
      serviceIds,
      durationMinutes: services.reduce((sum, item) => sum + item.durationMinutes * (quantities.get(item.id) ?? 1), 0),
    };
  }

  private generateDates(input: RecurringPreviewDto) {
    const dates: string[] = [];
    let cursor = new Date(input.startDate);
    const end = input.endDate ? new Date(input.endDate) : null;
    for (let i = 0; i < input.occurrenceCount; i += 1) {
      if (end && cursor > end) break;
      dates.push(cursor.toISOString().slice(0, 10));
      const next = new Date(cursor);
      if (input.frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1);
      else next.setUTCDate(next.getUTCDate() + (input.frequency === 'BIWEEKLY' ? 14 : 7));
      cursor = next;
    }
    return dates;
  }

  private toInstant(date: string, time: string) {
    const instant = new Date(`${date}T${time}:00+07:00`);
    if (Number.isNaN(instant.getTime())) throw new BadRequestException('Ngày hoặc giờ lặp không hợp lệ');
    return instant;
  }

  private async findStaff(input: RecurringPreviewDto, serviceIds: string[], start: Date, end: Date) {
    const candidates = await this.prisma.staffProfile.findMany({
      where: {
        ...(input.staffMode === 'SAME_STAFF' && input.staffId ? { id: input.staffId } : {}),
        branchId: input.branchId, status: 'ACTIVE', deletedAt: null, isBookable: true,
        OR: [{ userId: null }, { user: { is: { isActive: true, deletedAt: null } } }],
        staffServices: { every: {} },
      },
      include: { staffServices: { where: { serviceId: { in: serviceIds } } } }, orderBy: { id: 'asc' },
    });
    for (const candidate of candidates) {
      if (new Set(candidate.staffServices.map((item) => item.serviceId)).size !== serviceIds.length) continue;
      try {
        for (const serviceId of serviceIds) await validateStaffForService(this.prisma, candidate.id, serviceId, start, end, input.branchId);
        return candidate.id;
      } catch {
        // Try the next eligible staff member.
      }
    }
    return null;
  }
}
