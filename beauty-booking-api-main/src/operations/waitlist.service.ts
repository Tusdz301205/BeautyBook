import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { assertNoOverlap, validateStaffForService } from '../bookings/bookings.validation';

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
  ) {}

  async join(customerId: string, input: {
    branchId: string; serviceId: string; staffId?: string; windowStart: string; windowEnd: string;
  }) {
    const windowStart = new Date(input.windowStart);
    const windowEnd = new Date(input.windowEnd);
    if (!Number.isFinite(windowStart.getTime()) || !Number.isFinite(windowEnd.getTime()) || windowStart >= windowEnd || windowEnd <= new Date()) {
      throw new BadRequestException('Khoảng thời gian chờ không hợp lệ');
    }
    return withSerializableTransaction(this.prisma, async (tx) => {
      const joinKey = `${customerId}:${input.branchId}:${input.serviceId}`;
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('beautybook_waitlist_join'),
          hashtext(${joinKey})
        )
      `;
      const service = await tx.branchServiceOffering.findFirst({
        where: { id: input.serviceId, branchId: input.branchId, status: 'ACTIVE', bookable: true, deletedAt: null },
        select: { id: true, branch: { select: { businessId: true } } },
      });
      if (!service) throw new BadRequestException('Dịch vụ không khả dụng tại chi nhánh');
      if (input.staffId) {
        const staff = await tx.staffService.findFirst({
          where: { staffId: input.staffId, serviceId: input.serviceId, staff: { branchId: input.branchId, status: 'ACTIVE', isBookable: true, deletedAt: null } },
          select: { staffId: true },
        });
        if (!staff) throw new BadRequestException('Nhân viên không phục vụ dịch vụ này');
      }
      const duplicate = await tx.waitlistEntry.findFirst({
        where: { customerId, branchId: input.branchId, serviceId: input.serviceId, status: { in: ['WAITING', 'OFFERED'] } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Bạn đã ở trong danh sách chờ cho dịch vụ này');
      return tx.waitlistEntry.create({ data: {
        customerId,
        businessId: service.branch.businessId,
        branchId: input.branchId,
        serviceId: input.serviceId,
        staffId: input.staffId,
        windowStart,
        windowEnd,
      } });
    }, { conflictMessage: 'Yêu cầu danh sách chờ trùng đang được xử lý' });
  }

  async listCustomer(customerId: string) {
    await this.expireOffers();
    return this.prisma.waitlistEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listBranch(branchId: string) {
    await this.expireOffers();
    return this.prisma.waitlistEntry.findMany({
      where: { branchId },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async cancel(entryId: string, customerId: string) {
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, customerId, status: { in: ['WAITING', 'OFFERED'] } },
    });
    if (!existing) throw new ConflictException('Yêu cầu chờ không còn có thể hủy');
    const result = await this.prisma.waitlistEntry.updateMany({
      where: { id: entryId, customerId, status: { in: ['WAITING', 'OFFERED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), offerSlotKey: null, offerTokenHash: null },
    });
    if (result.count !== 1) throw new ConflictException('Yêu cầu chờ không còn có thể hủy');
    if (existing.status === 'OFFERED') await this.offerNextForReleasedSlot(existing);
    return { cancelled: true };
  }

  async offer(entryId: string, actorId: string | null, input: { startAt: string; staffId: string; ttlMinutes?: number }) {
    const startAt = new Date(input.startAt);
    if (!Number.isFinite(startAt.getTime()) || startAt <= new Date()) throw new BadRequestException('Thời gian đề nghị không hợp lệ');
    const ttl = Math.min(60, Math.max(3, input.ttlMinutes ?? 10));
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM waitlist_entries WHERE id = ${entryId} FOR UPDATE`;
      const entry = await tx.waitlistEntry.findUnique({ where: { id: entryId } });
      if (!entry || entry.status !== 'WAITING') throw new ConflictException('Khách không còn ở trạng thái chờ');
      if (startAt < entry.windowStart || startAt > entry.windowEnd) throw new BadRequestException('Slot nằm ngoài khoảng thời gian khách mong muốn');
      if (entry.staffId && entry.staffId !== input.staffId) {
        throw new BadRequestException('Slot không thuộc nhân viên khách đã chọn');
      }
      const service = await tx.branchServiceOffering.findUniqueOrThrow({ where: { id: entry.serviceId } });
      const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
      const transactionClient = tx as unknown as PrismaService;
      await validateStaffForService(
        transactionClient,
        input.staffId,
        entry.serviceId,
        startAt,
        endAt,
        entry.branchId,
      );
      await assertNoOverlap(transactionClient, input.staffId, null, startAt, endAt);
      const slotKey = `${entry.branchId}:${input.staffId}:${startAt.toISOString()}`;
      const updated = await tx.waitlistEntry.update({ where: { id: entryId }, data: {
        status: 'OFFERED', staffId: input.staffId, offeredStartAt: startAt,
        offerExpiresAt: new Date(Date.now() + ttl * 60_000), offerTokenHash: tokenHash, offerSlotKey: slotKey,
      } });
      const customer = await tx.customerProfile.findUniqueOrThrow({ where: { id: entry.customerId }, select: { userId: true } });
      await tx.notification.create({ data: {
        userId: customer.userId, type: 'SYSTEM', severity: 'INFO',
        title: 'Có lịch trống dành cho bạn', body: `Ưu đãi giữ trong ${ttl} phút`,
        targetType: 'WAITLIST', targetId: entry.id,
        actionUrl: `/customer/benefits?waitlistOffer=${entry.id}&token=${encodeURIComponent(token)}`,
      } });
      await tx.auditLog.create({ data: {
        userId: actorId, action: 'UPDATE', entityType: 'WaitlistEntry', entityId: entry.id,
        newData: { status: 'OFFERED', startAt, staffId: input.staffId, expiresAt: updated.offerExpiresAt },
      } });
      return { ...updated, claimToken: token };
    }, { conflictMessage: 'Slot vừa được đề nghị cho khách khác' });
  }

  async accept(entryId: string, customerId: string, token: string, actorId: string) {
    const tokenHash = createHash('sha256').update(token || '').digest('hex');
    const claimed = await withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM waitlist_entries WHERE id = ${entryId} FOR UPDATE`;
      const entry = await tx.waitlistEntry.findUnique({ where: { id: entryId } });
      if (!entry || entry.customerId !== customerId || entry.status !== 'OFFERED') throw new ConflictException('Đề nghị không còn khả dụng');
      if (!entry.offerExpiresAt || entry.offerExpiresAt <= new Date() || entry.offerTokenHash !== tokenHash) throw new ConflictException('Đề nghị đã hết hạn hoặc token không đúng');
      await tx.waitlistEntry.update({ where: { id: entryId }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return entry;
    }, { conflictMessage: 'Đề nghị vừa được xử lý' });
    try {
      const booking = await this.bookings.create({
        customerId,
        branchId: claimed.branchId,
        serviceIds: [claimed.serviceId],
        appointmentDate: claimed.offeredStartAt!.toISOString(),
        staffId: claimed.staffId!,
        createdBy: actorId,
        source: 'ONLINE_WEB',
      });
      await this.prisma.waitlistEntry.update({ where: { id: entryId }, data: { bookingId: booking.id, offerSlotKey: null, offerTokenHash: null } });
      return booking;
    } catch (error) {
      await this.prisma.waitlistEntry.updateMany({
        where: { id: entryId, status: 'ACCEPTED', bookingId: null },
        data: { status: 'EXPIRED', offerSlotKey: null, offerTokenHash: null },
      });
      await this.offerNextForReleasedSlot(claimed);
      throw error;
    }
  }

  async expireOffers() {
    const expired = await this.prisma.waitlistEntry.findMany({
      where: { status: 'OFFERED', offerExpiresAt: { lte: new Date() } },
      orderBy: { offerExpiresAt: 'asc' },
      take: 100,
    });
    let count = 0;
    for (const entry of expired) {
      const changed = await this.prisma.waitlistEntry.updateMany({
        where: { id: entry.id, status: 'OFFERED', offerExpiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED', offerSlotKey: null, offerTokenHash: null },
      });
      if (changed.count !== 1) continue;
      count += 1;
      await this.offerNextForReleasedSlot(entry);
    }
    return { count };
  }

  private async offerNextForReleasedSlot(entry: {
    branchId: string;
    serviceId: string;
    staffId: string | null;
    offeredStartAt: Date | null;
  }) {
    if (!entry.staffId || !entry.offeredStartAt || entry.offeredStartAt <= new Date()) return;
    const candidates = await this.prisma.waitlistEntry.findMany({
      where: {
        branchId: entry.branchId,
        serviceId: entry.serviceId,
        status: 'WAITING',
        windowStart: { lte: entry.offeredStartAt },
        windowEnd: { gte: entry.offeredStartAt },
        OR: [{ staffId: null }, { staffId: entry.staffId }],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const candidate of candidates) {
      try {
        await this.offer(candidate.id, null, {
          startAt: entry.offeredStartAt.toISOString(),
          staffId: entry.staffId,
          ttlMinutes: 10,
        });
        return;
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
  }
}
