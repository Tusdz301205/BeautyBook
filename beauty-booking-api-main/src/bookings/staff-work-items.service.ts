import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { BOOKING_TIMING_AUDIT_INCLUDE, bookingItemActualTiming } from './booking-actual-timing';

const WORK_ITEM_SELECT = {
  id: true, bookingId: true, serviceId: true, staffId: true, serviceNameSnapshot: true,
  status: true, revision: true, durationMinutes: true, itemStartAt: true, itemEndAt: true,
  ...BOOKING_TIMING_AUDIT_INCLUDE,
  booking: { select: {
    id: true, bookingCode: true, branchId: true, status: true,
    appointmentDate: true, appointmentStartTime: true, appointmentEndTime: true,
    customer: { select: { user: { select: { fullName: true } } } },
    branch: { select: { id: true, name: true, timezone: true, businessId: true } },
  } },
} satisfies Prisma.BookingServiceSelect;
type WorkItemRow = Prisma.BookingServiceGetPayload<{ select: typeof WORK_ITEM_SELECT }>;

@Injectable()
export class StaffWorkItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): Prisma.BookingWhereInput {
    if (user.sessionType !== 'salon' || (user.workspace && user.workspace !== 'SALON')) {
      throw new ForbiddenException('Công việc cá nhân chỉ dành cho workspace SALON');
    }
    const scopes = (user.scopes ?? []).filter((s) => user.roles.includes(s.code) &&
      (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now()) && s.businessId &&
      (!user.businessId || s.businessId === user.businessId) &&
      (s.code === 'STAFF' && s.branchId || s.code === 'BUSINESS_OWNER' && !s.branchId));
    if (!scopes.length) throw new ForbiddenException('Không có phạm vi công việc còn hiệu lực');
    return { deletedAt: null, branch: { deletedAt: null, business: { deletedAt: null } },
      OR: scopes.map((s) => ({ branch: { businessId: s.businessId!,
        ...(s.code === 'STAFF' ? { id: s.branchId! } : {}) } })),
      ...(user.branchId ? { branchId: user.branchId } : {}) };
  }

  async profileId(user: AuthUser): Promise<string> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { userId: user.id, status: 'ACTIVE', deletedAt: null }, select: { id: true },
    });
    if (!staff) throw new NotFoundException({ code: 'STAFF_PROFILE_REQUIRED',
      message: 'Tài khoản chưa được liên kết hồ sơ nhân viên đang hoạt động' });
    return staff.id;
  }

  private date(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Ngày công việc không hợp lệ');
    return date;
  }

  private view(item: WorkItemRow, serverNow: Date) {
    const booking = item.booking;
    const terminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'].includes(booking.status);
    return {
      id: item.id, bookingId: item.bookingId, bookingCode: booking.bookingCode,
      branchId: booking.branchId, businessId: booking.branch.businessId,
      branch: { id: booking.branch.id, name: booking.branch.name, timezone: booking.branch.timezone },
      customer: { fullName: booking.customer.user.fullName },
      serviceId: item.serviceId, serviceNameSnapshot: item.serviceNameSnapshot, staffId: item.staffId,
      status: item.status, bookingStatus: booking.status, revision: item.revision,
      durationMinutes: item.durationMinutes, itemStartAt: item.itemStartAt, itemEndAt: item.itemEndAt,
      appointmentDate: booking.appointmentDate, appointmentStartTime: booking.appointmentStartTime,
      appointmentEndTime: booking.appointmentEndTime,
      ...bookingItemActualTiming(item), serverNow,
      canStart: item.status === 'SCHEDULED' && ['CHECKED_IN', 'IN_PROGRESS'].includes(booking.status),
      canComplete: item.status === 'IN_PROGRESS' && !terminal,
    };
  }

  async list(user: AuthUser, query: { dateFrom?: string; dateTo?: string; branchId?: string; bookingId?: string; page?: string; limit?: string } = {}) {
    const booking = this.scope(user);
    const staffId = await this.profileId(user);
    const from = this.date(query.dateFrom), to = this.date(query.dateTo);
    if (from && to && from > to) throw new BadRequestException('Khoảng ngày không hợp lệ');
    const page = Number(query.page ?? 1), limit = Number(query.limit ?? 50);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('page hoặc limit không hợp lệ');
    }
    const where: Prisma.BookingServiceWhereInput = { staffId,
      staff: { userId: user.id, status: 'ACTIVE', deletedAt: null },
      booking: { AND: [booking, ...(query.branchId ? [{ branchId: query.branchId }] : []),
        ...(query.bookingId ? [{ id: query.bookingId }] : [])],
        ...(from || to ? { appointmentDate: { gte: from, lte: to } } : {}) } };
    const [items, total] = await Promise.all([
      this.prisma.bookingService.findMany({ where, select: WORK_ITEM_SELECT,
        orderBy: [{ booking: { appointmentDate: 'asc' } }, { itemStartAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit, take: limit }),
      this.prisma.bookingService.count({ where }),
    ]);
    const serverNow = new Date();
    return { data: items.map((item) => this.view(item, serverNow)), total, page, limit, serverNow };
  }

  async detail(user: AuthUser, itemId: string) {
    const booking = this.scope(user);
    const staffId = await this.profileId(user);
    const item = await this.prisma.bookingService.findFirst({ where: { id: itemId, staffId,
      staff: { userId: user.id, status: 'ACTIVE', deletedAt: null }, booking }, select: WORK_ITEM_SELECT });
    if (!item) throw new NotFoundException('Công việc không tồn tại hoặc không còn được phân công');
    return this.view(item, new Date());
  }
}
