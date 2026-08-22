import { Injectable, BadRequestException, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SchedulerGateway } from '../scheduler/scheduler.gateway';
import {
  assertCustomerNotDoubleBooked,
  assertFutureAppointment,
  assertNoOverlap,
  assertStatusTransition,
  assertActorStatusTransition,
  assertTimeAllowedForStatusTransition,
  evaluateTimeAllowedForStatusTransition,
  assertValidDuration,
  evaluateCancelPolicy,
  validateStaffForService,
  BLOCKING_BOOKING_STATUSES,
} from './bookings.validation';
import { applyVoucher } from '../common/utils/voucher';
import {
  resolveCancellationPolicy,
  resolveRescheduleCutoffHours,
} from '../common/utils/policy';
import { auditLog } from '../common/utils/audit';
import {
  notifyBookingBothParties,
  notifyBookingCustomer,
  notifySalonMembers,
} from '../common/utils/notify';
import {
  appointmentDateFromInstant,
  combineAppointmentDateTime,
  normalizeAppointmentForStorage,
  sameAppointmentDate,
  toBookingInterval,
} from '../common/utils/booking-datetime';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly schedulerGateway: SchedulerGateway,
    private readonly platformSettings: PlatformSettingsService,
    @Optional() private readonly payments?: PaymentsService,
  ) {}

  private async assertStaffNotAbsent(
    staffId: string,
    branchId: string,
    workDate: Date,
    db: PrismaService = this.prisma,
  ) {
    const absent = await db.staffAttendance.findFirst({
      where: { staffId, branchId, workDate: appointmentDateFromInstant(workDate), status: 'ABSENT' },
      select: { id: true },
    });
    if (absent) throw new ConflictException('Nhân viên vắng mặt trong ngày đã chọn');
  }

  /**
   * Lấy danh sách lịch hẹn cho Admin (có filter, search, sort, phân trang)
   * + hỗ trợ filter cứng theo multi-tenancy.
   *
   * @param query.customerId - chỉ Customer
   * @param query.allowedBranchIds - chỉ các branch thuộc salon của Owner/Staff/Admin
   */
  async findAll(query: {
    search?: string;
    status?: string;
    branchId?: string;
    categoryId?: string;
    serviceId?: string;
    businessId?: string;
    customerQuery?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'newest' | 'oldest';
    page?: number;
    limit?: number;
    customerId?: string;
    allowedBranchIds?: string[];
    staffId?: string;
  }) {
    const {
      search,
      status,
      branchId,
      categoryId,
      serviceId,
      businessId,
      customerQuery,
      source,
      dateFrom,
      dateTo,
      sortOrder = 'newest',
      page = 1,
      limit = 50,
      customerId,
      allowedBranchIds,
      staffId,
    } = query;
    // An explicitly empty scope means the caller has no accessible branch.
    // Do not run even the maintenance query outside that empty scope.
    if (allowedBranchIds === undefined || allowedBranchIds.length > 0) {
      await this.expirePendingHolds(branchId);
    }

    const where: any = {
      deletedAt: null,
    };

    // Filter by status (map Vietnamese status to BookingStatus enum)
    if (status && status !== 'Tất cả') {
      const statusMap: Record<string, string> = {
        'Mới': 'PENDING',
        'Đã xác nhận': 'CONFIRMED',
        'Đang thực hiện': 'IN_PROGRESS',
        'Hoàn thành': 'COMPLETED',
        'Đã huỷ': 'CANCELLED',
        'No-show': 'NO_SHOW',
        'Đã từ chối': 'REJECTED',
        'Đã hết hạn': 'EXPIRED',
      };
      const bookingStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'];
      if (bookingStatuses.includes(status)) where.status = status;
      else if (statusMap[status]) where.status = statusMap[status];
    }

    // Filter by branch
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds) {
      where.branchId = { in: allowedBranchIds };
    }

    // Filter by customer (customer self-view)
    if (customerId) {
      where.customerId = customerId;
    }

    if (businessId) {
      where.AND = [...(where.AND ?? []), { branch: { businessId } }];
    }

    // Filter by service category
    if (categoryId) {
      where.AND = [...(where.AND ?? []), { bookingServices: { some: { service: { categoryId } } } }];
    }
    if (serviceId) {
      where.AND = [...(where.AND ?? []), { bookingServices: { some: { serviceId } } }];
    }
    if (staffId) {
      where.AND = [
        ...(where.AND ?? []),
        { bookingServices: { some: { staffId } } },
      ];
    }
    if (source) where.source = source;

    if (customerQuery) {
      where.AND = [
        ...(where.AND ?? []),
        {
          customer: {
            user: {
              OR: [
                { fullName: { contains: customerQuery, mode: 'insensitive' } },
                { email: { contains: customerQuery, mode: 'insensitive' } },
                { phone: { contains: customerQuery, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.appointmentDate = {};
      if (dateFrom) where.appointmentDate.gte = new Date(dateFrom);
      if (dateTo) where.appointmentDate.lte = new Date(dateTo);
    }

    // Search by booking code or customer name
    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            user: {
              fullName: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, phone: true },
              },
            },
          },
          branch: {
            include: {
              business: { select: { id: true, name: true } },
            },
          },
          bookingServices: {
            include: {
              service: {
                include: {
                  category: { select: { id: true, name: true } },
                },
              },
              staff: {
                include: {
                  user: { select: { fullName: true } },
                },
              },
            },
          },
          payments: true,
        },
        orderBy: { createdAt: sortOrder === 'newest' ? 'desc' : 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Map status enum to Vietnamese label
    const statusLabelMap: Record<string, string> = {
      PENDING: 'Mới',
      CONFIRMED: 'Đã xác nhận',
      CHECKED_IN: 'Đã check-in',
      IN_PROGRESS: 'Đang thực hiện',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
      NO_SHOW: 'No-show',
    };

    const data = bookings.map((b) => ({
      id: b.bookingCode,
      bookingId: b.id,
      customer_id: b.customer?.user?.id,
      customer_name: b.customer?.user?.fullName || 'N/A',
      customer_phone: b.customer?.user?.phone || '',
      salon_id: b.branch?.business?.id,
      branchId: b.branchId,
      salon_name: b.branch?.business?.name || b.branch?.name || 'N/A',
      branch_name: b.branch?.name,
      service_category:
        b.bookingServices?.[0]?.service?.category?.name || 'N/A',
      services: b.bookingServices?.map((bs) => ({
        name: bs.service?.name,
        price: bs.priceAtBooking,
        duration: bs.durationMinutes,
        staff: bs.staff?.user?.fullName || bs.staff?.fullName || null,
      })),
      appointment_time: b.appointmentDate,
      appointment_start: b.appointmentStartTime,
      appointment_end: b.appointmentEndTime,
      status: statusLabelMap[b.status] || b.status,
      statusEnum: b.status,
      source: b.source,
      total_amount: b.totalAmount,
      note: b.note,
      cancel_reason: b.cancelReason,
      created_at: b.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết lịch hẹn theo ID (đã soft-delete sẽ trả null)
   */
  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
        branch: {
          include: {
            business: { select: { id: true, name: true } },
          },
        },
        bookingServices: {
          include: {
            service: {
              include: { category: true },
            },
            staff: {
              select: {
                id: true,
                fullName: true,
                position: true,
                bio: true,
                user: {
                  select: { id: true, fullName: true, avatarMediaId: true },
                },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        payments: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }
    const interval = toBookingInterval(
      booking.appointmentDate,
      booking.appointmentStartTime,
      booking.appointmentEndTime,
    );
    const candidateByStatus: Record<string, string | undefined> = {
      CONFIRMED: 'CHECKED_IN',
      CHECKED_IN: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    };
    const candidate = candidateByStatus[booking.status];
    return {
      ...booking,
      transitionAvailability: candidate
        ? {
            [candidate]: evaluateTimeAllowedForStatusTransition({
              fromStatus: booking.status,
              toStatus: candidate,
              appointmentStartTime: interval.start,
              appointmentEndTime: interval.end,
            }),
          }
        : {},
    };
  }

  /**
   * Cập nhật trạng thái lịch hẹn — có state-machine guard + salon policy + audit + fan-out.
   *
   * Notification fan-out (đã chốt trong review nghiệp vụ):
   *  - Status thay đổi → NOTI đến customer_id của booking (KHÔNG PHẢI account salon).
   *  - CONFIRM/REJECT/DONE → đồng thời email cho khách.
   *  - CANCELLED do salon (changedByType = SALON) → đặc biệt, vì ảnh hưởng uy tín salon.
   *  - Admin ép FORCE_CANCEL → audit + notify cả 2 bên.
   */
  async updateStatus(
    id: string,
    newStatus: string,
    changedBy?: string,
    note?: string,
    changedByType: 'CUSTOMER' | 'SALON' | 'ADMIN' | 'SYSTEM' = 'SALON',
    actorRoles: string[] = [],
  ) {
    const statusMap: Record<string, string> = {
      'Mới': 'PENDING',
      'Đã xác nhận': 'CONFIRMED',
      'Đang thực hiện': 'IN_PROGRESS',
      'Hoàn thành': 'COMPLETED',
      'Đã huỷ': 'CANCELLED',
      'No-show': 'NO_SHOW',
      'Đã từ chối': 'REJECTED',
      'Đã hết hạn': 'EXPIRED',
    };
    const mappedStatus = statusMap[newStatus] || newStatus;

    const existing = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        appointmentDate: true,
        appointmentStartTime: true,
        appointmentEndTime: true,
        totalAmount: true,
        finalAmount: true,
        voucherId: true,
        bookingServices: {
          where: { comboId: { not: null } },
          select: { comboId: true },
          take: 1,
        },
        paymentTransactions: {
          select: { amount: true, status: true },
        },
        payments: {
          select: {
            amount: true,
            status: true,
            transactions: { select: { id: true } },
            refundRequests: {
              where: { status: 'REFUNDED' },
              select: { amount: true },
            },
          },
        },
        branch: { select: { businessId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lịch hẹn');

    if (
      mappedStatus === 'COMPLETED' &&
      ('paymentTransactions' in existing || 'payments' in existing)
    ) {
      const verified = (existing.paymentTransactions ?? [])
        .filter((item) => item.status === 'VERIFIED')
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const reversed = (existing.paymentTransactions ?? [])
        .filter((item) => item.status === 'REVERSED')
        .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
      const legacy = (existing.payments ?? [])
        .filter((item) =>
          item.transactions.length === 0 &&
          ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(item.status),
        )
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const refunded = (existing.payments ?? [])
        .filter((item) => item.transactions.length === 0)
        .flatMap((item) => item.refundRequests)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const required = Number(existing.finalAmount ?? existing.totalAmount);
      if (verified - reversed + legacy - refunded < required) {
        throw new ConflictException(
          'Dịch vụ tiêu chuẩn chỉ được hoàn thành khi số dư thanh toán đã đủ',
        );
      }
    }

    assertStatusTransition(existing.status, mappedStatus);
    assertActorStatusTransition(actorRoles, existing.status, mappedStatus);
    const interval = toBookingInterval(
      existing.appointmentDate,
      existing.appointmentStartTime,
      existing.appointmentEndTime,
    );
    assertTimeAllowedForStatusTransition({
      fromStatus: existing.status,
      toStatus: mappedStatus,
      appointmentStartTime: interval.start,
      appointmentEndTime: interval.end,
    });

    // Cancel policy cấp salon
    let cancellationFeeAmount: number | null = null;
    if (mappedStatus === 'CANCELLED') {
      const platformPolicy = await this.platformSettings.getEffective();
      const policyDecision = await resolveCancellationPolicy(
        this.prisma,
        existing.branch.businessId,
        Number(existing.totalAmount),
        combineAppointmentDateTime(
          existing.appointmentDate,
          existing.appointmentStartTime,
        ),
        new Date(),
        platformPolicy.freeCancellationHours,
      );
      if (policyDecision.policy === 'too_late') {
        throw new BadRequestException(
          policyDecision.notes ??
            'Không thể huỷ lịch sau giờ hẹn. Vui lòng liên hệ cơ sở.',
        );
      }
      if (policyDecision.policy === 'warn_late_cancel') {
        cancellationFeeAmount = policyDecision.feeAmount;
        const warningNote = `[Cảnh báo: ${policyDecision.notes ?? 'huỷ trễ, có tính phí'}] ${note ?? ''}`.trim();
        note = warningNote;
      }
    }

    const updatedBooking = await withSerializableTransaction(
      this.prisma,
      async (tx) => {
        // Compare-and-set inside SERIALIZABLE prevents two concurrent
        // transitions from both committing from the same stale status.
        const claimed = await tx.booking.updateMany({
          where: { id, status: existing.status },
          data: {
            status: mappedStatus as any,
            ...(mappedStatus !== 'PENDING' ? { pendingExpiresAt: null } : {}),
            ...(mappedStatus === 'CANCELLED'
              ? {
                  cancelledAt: new Date(),
                  cancelledBy: changedBy,
                  cancelledByType: changedByType,
                  cancelReason: note,
                  cancellationFeeAmount,
                }
              : {}),
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Trạng thái lịch hẹn vừa thay đổi, vui lòng tải lại và thử lại',
          );
        }

        const updated = await tx.booking.findUnique({
          where: { id },
          include: {
            customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
            branch: { include: { business: true } },
            bookingServices: { include: { service: true } },
          },
        });
        if (!updated) {
          throw new NotFoundException('Không tìm thấy lịch hẹn');
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            status: mappedStatus as any,
            changedBy,
            note,
          },
        });

        if (mappedStatus === 'CONFIRMED' && existing.voucherId) {
          await tx.customerVoucher.updateMany({
            where: {
              usedBookingId: id,
              voucherId: existing.voucherId,
              status: 'RESERVED',
            },
            data: { status: 'USED', usedAt: new Date() },
          });
        }

        if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(mappedStatus)) {
          await this.releaseBookingBenefits(
            tx,
            id,
            existing.voucherId,
            existing.bookingServices[0]?.comboId ?? null,
          );
          await this.payments?.redeemPackageEntitlements(id, 'CANCELLED', tx);
        }

        if (mappedStatus === 'COMPLETED') {
          await this.payments?.redeemPackageEntitlements(id, 'COMPLETED', tx);
        }

        return updated;
      },
      {
        conflictMessage:
          'Trạng thái lịch hẹn vừa thay đổi, vui lòng tải lại và thử lại',
      },
    );

    // Email + fan-out notification đến customer của booking (không phải account salon)
    const customerEmail = updatedBooking.customer?.user?.email;
    const details = {
      customerName: updatedBooking.customer?.user?.fullName || 'Khách hàng',
      time: updatedBooking.appointmentDate
        ? updatedBooking.appointmentDate.toLocaleString('vi-VN')
        : 'N/A',
      salonName:
        updatedBooking.branch?.business?.name ||
        updatedBooking.branch?.name ||
        'N/A',
      serviceName:
        updatedBooking.bookingServices?.[0]?.service?.name || 'Dịch vụ',
    };

    if (customerEmail) {
      if (mappedStatus === 'CONFIRMED') {
        await this.mailService.sendBookingConfirmation(
          customerEmail,
          updatedBooking.bookingCode,
          details,
        );
      } else if (mappedStatus === 'CANCELLED') {
        await this.mailService.sendBookingCancellation(
          customerEmail,
          updatedBooking.bookingCode,
          details,
          note || 'Hệ thống huỷ',
        );
      } else if (mappedStatus === 'COMPLETED') {
        await this.mailService.sendBookingConfirmation(
          customerEmail,
          updatedBooking.bookingCode,
          details,
        );
      }
    }

    // In-app notification — gửi đến customer của booking
    const notifTitleByStatus: Record<string, string> = {
      CONFIRMED: 'Lịch hẹn đã được xác nhận',
      COMPLETED: 'Dịch vụ đã hoàn thành — vui lòng đánh giá',
      CANCELLED: 'Lịch hẹn đã bị huỷ',
      IN_PROGRESS: 'Dịch vụ đang thực hiện',
      NO_SHOW: 'Bạn đã không đến — vui lòng liên hệ cơ sở',
      REJECTED: 'Lịch hẹn đã bị từ chối',
      EXPIRED: 'Lịch hẹn đã hết thời gian giữ chỗ',
    };
    const notifTypeByStatus: Record<string, any> = {
      CONFIRMED: 'BOOKING_CONFIRMED',
      COMPLETED: 'BOOKING_COMPLETED',
      CANCELLED: 'BOOKING_CANCELLED',
      IN_PROGRESS: 'BOOKING_REMINDER',
      NO_SHOW: 'BOOKING_CANCELLED',
      REJECTED: 'BOOKING_CANCELLED',
      EXPIRED: 'BOOKING_CANCELLED',
    };
    if (notifTitleByStatus[mappedStatus]) {
      await notifyBookingBothParties(
        this.prisma,
        id,
        notifTypeByStatus[mappedStatus],
        notifTitleByStatus[mappedStatus],
        note ? `${details.serviceName} — ${note}` : details.serviceName,
      );
    }

    // Audit: chỉ ghi khi admin ép (FORCE_CANCEL); còn lại status_history đã đủ.
    if (changedByType === 'ADMIN' && mappedStatus === 'CANCELLED') {
      await auditLog(this.prisma, {
        userId: changedBy ?? null,
        action: 'FORCE_CANCEL',
        entityType: 'Booking',
        entityId: id,
        oldData: { status: existing.status },
        newData: { status: mappedStatus, cancellationFeeAmount },
        reason: note,
      });
    }

    if (mappedStatus === 'COMPLETED' && this.payments) {
      await this.prisma.$transaction((tx) => this.payments!.ensurePlatformFee(tx, id));
    }
    this.schedulerGateway.notifyBookingUpdated(updatedBooking);
    return updatedBooking;
  }

  /**
   * Tạo lịch hẹn mới — có validation đầy đủ + transaction lock chống race condition.
   *
   * Flow:
   *  1. Validate services tồn tại + thuộc branch
   *  2. Snapshot giá + duration vào BookingService (KHÔNG tham chiếu sống đến services.price)
   *  3. Validate appointmentDate ở tương lai
   *  4. Nếu có voucherCode → áp voucher (verify ownership)
   *  5. Validate staff (nếu có) — ACTIVE + làm được service + trong giờ làm
   *  6. Wrap trong $transaction với isolationSerializable — 2 khách cùng đặt
   *     1 nhân viên cùng giờ sẽ có 1 transaction fail với P2002/P2034.
   *  7. Ghi status_history row đầu tiên (changed_by = customerId)
   *  8. Notification fan-out đến salon members (có booking mới cần xác nhận)
   */
  async create(data: {
    customerId: string;
    branchId: string;
    serviceIds?: string[];
    comboId?: string;
    recurringPlanId?: string;
    appointmentDate: string;
    note?: string;
    createdBy?: string;
    staffId?: string;
    voucherCode?: string;
    guestContact?: { fullName: string; phone?: string | null; email?: string | null };
    source?: 'ONLINE_WEB' | 'ONLINE_APP' | 'WALK_IN' | 'PHONE' | 'STAFF_CREATED' | 'ADMIN_CREATED';
  }) {
    await this.expirePendingHolds(data.branchId);
    const statusChangedBy = data.createdBy ?? (await this.prisma.customerProfile.findUnique({
      where: { id: data.customerId },
      select: { userId: true },
    }))?.userId;
    if (!statusChangedBy) {
      throw new BadRequestException('Không tìm thấy tài khoản khách hàng');
    }
    // 1. Resolve dịch vụ hoặc combo trong cùng chi nhánh.
    const now = new Date();
    const combo = data.comboId
      ? await this.prisma.combo.findFirst({
          where: { id: data.comboId, branchId: data.branchId, status: 'ACTIVE', deletedAt: null },
          include: { comboServices: { orderBy: { sortOrder: 'asc' } } },
        })
      : null;
    if (data.comboId && (!combo || (combo.validFrom && combo.validFrom > now) || (combo.validTo && combo.validTo < now))) {
      throw new BadRequestException('Combo không tồn tại hoặc chưa trong thời gian áp dụng');
    }
    if (combo?.maxUsage !== null && combo?.maxUsage !== undefined && combo.usedCount >= combo.maxUsage) {
      throw new ConflictException('Combo đã hết lượt sử dụng');
    }
    const quantities = new Map<string, number>();
    if (combo) {
      for (const item of combo.comboServices) quantities.set(item.serviceId, item.quantity);
    } else {
      for (const serviceId of data.serviceIds ?? []) quantities.set(serviceId, 1);
    }
    const resolvedServiceIds = [...quantities.keys()];
    if (resolvedServiceIds.length === 0) throw new BadRequestException('Phải chọn ít nhất một dịch vụ hoặc combo');
    const services = await this.prisma.branchServiceOffering.findMany({
      where: {
        id: { in: resolvedServiceIds },
        branchId: data.branchId,
        status: 'ACTIVE',
        bookable: true,
        deletedAt: null,
      },
      include: {
        businessService: { select: { canonicalServiceId: true } },
      },
    });
    if (services.length === 0) {
      throw new BadRequestException('Không tìm thấy dịch vụ nào hợp lệ');
    }
    if (services.length !== resolvedServiceIds.length) {
      const found = new Set(services.map((s) => s.id));
      const missing = resolvedServiceIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Dịch vụ không tồn tại: ${missing.join(', ')}`,
      );
    }
    if (combo && combo.comboServices.length < 2) {
      throw new BadRequestException('Combo phải có ít nhất hai dịch vụ');
    }

    const servicesById = new Map(services.map((service) => [service.id, service]));
    const plannedItems = combo
      ? combo.comboServices.flatMap((item) =>
          Array.from({ length: item.quantity }, (_, quantityIndex) => ({
            service: servicesById.get(item.serviceId)!,
            transitionMinutes: quantityIndex === item.quantity - 1 ? item.transitionMinutes : 0,
            sortOrder: item.sortOrder + quantityIndex / Math.max(1, item.quantity),
            priceSnapshot: Number(item.priceSnapshot),
          })),
        )
      : resolvedServiceIds.map((serviceId, index) => ({
          service: servicesById.get(serviceId)!,
          transitionMinutes: 0,
          sortOrder: index,
          priceSnapshot: Number(servicesById.get(serviceId)!.price),
        }));

    // 2. Tính duration + validate
    const totalDuration = plannedItems.reduce(
      (sum, item) => sum + Number(item.service.durationMinutes || 0) + item.transitionMinutes,
      0,
    );
    assertValidDuration(totalDuration);

    // 3. Validate thời gian
    const appointmentStartTime = new Date(data.appointmentDate);
    if (isNaN(appointmentStartTime.getTime())) {
      throw new BadRequestException('appointmentDate không hợp lệ');
    }
    assertFutureAppointment(appointmentStartTime);
    const bookingPolicy = await this.platformSettings.getEffective();
    const configuredBookingPolicy = await this.platformSettings.getConfigured();
    const advanceMs = appointmentStartTime.getTime() - Date.now();
    if (advanceMs < bookingPolicy.minBookingLeadTimeHours * 60 * 60 * 1000) {
      throw new BadRequestException(`Cần đặt trước ít nhất ${bookingPolicy.minBookingLeadTimeHours} giờ.`);
    }
    if (advanceMs > bookingPolicy.maxAdvanceBookingDays * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`Chỉ được đặt trước tối đa ${bookingPolicy.maxAdvanceBookingDays} ngày.`);
    }
    const appointmentEndTime = new Date(
      appointmentStartTime.getTime() + totalDuration * 60000,
    );
    if (!sameAppointmentDate(appointmentStartTime, appointmentEndTime)) {
      throw new BadRequestException('Booking qua ngày chưa được hỗ trợ');
    }
    const storedAppointment = normalizeAppointmentForStorage(
      appointmentStartTime,
      appointmentEndTime,
    );
    let timelineCursor = appointmentStartTime.getTime();
    const timeline = plannedItems.map((item, index) => {
      const itemStartAt = new Date(timelineCursor);
      const itemEndAt = new Date(itemStartAt.getTime() + item.service.durationMinutes * 60_000);
      timelineCursor = itemEndAt.getTime() + item.transitionMinutes * 60_000;
      return { ...item, sortOrder: index, itemStartAt, itemEndAt };
    });

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: data.branchId, status: 'ACTIVE', deletedAt: null,
        business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
      },
      select: { id: true, businessId: true, bookingConfirmationMode: true, staffAssignmentMode: true, pendingHoldMinutes: true },
    });
    if (!branch) throw new BadRequestException('Chi nhánh không hoạt động');
    const closedHoliday = await this.prisma.branchHoliday.findFirst({
      where: {
        branchId: data.branchId,
        date: storedAppointment.appointmentDate,
        isClosed: true,
      },
      select: { id: true },
    });
    if (closedHoliday) throw new BadRequestException('Chi nhánh đóng cửa trong ngày đã chọn');

    // 4. Tính giá snapshot (KHÔNG tham chiếu services.price sau này)
    const originalSubtotal = combo
      ? plannedItems.reduce((sum, item) => sum + item.priceSnapshot, 0)
      : services.reduce((sum, s) => sum + Number(s.price) * (quantities.get(s.id) ?? 1), 0);
    const subtotal = combo ? Number(combo.comboPrice) : originalSubtotal;
    let voucherInfo: Awaited<ReturnType<typeof applyVoucher>> | null = null;
    if (data.voucherCode) {
      voucherInfo = await applyVoucher(this.prisma, {
        customerId: data.customerId,
        voucherCode: data.voucherCode,
        branchId: data.branchId,
        subtotal,
      });
    }
    const finalTotal = voucherInfo ? voucherInfo.finalAmount : subtotal;

    // 5. Resolve every eligible candidate before entering the serializable
    // transaction. The final free candidate is selected again inside it.
    const candidateProfiles = await this.prisma.staffProfile.findMany({
      where: {
        ...(data.staffId ? { id: data.staffId } : {}),
        branchId: data.branchId,
        status: 'ACTIVE',
        deletedAt: null,
        isBookable: true,
        OR: [{ userId: null }, { user: { is: { isActive: true, deletedAt: null } } }],
        attendances: { none: { workDate: storedAppointment.appointmentDate, status: 'ABSENT' } },
      },
      include: { staffServices: { where: { serviceId: { in: resolvedServiceIds } } } },
      orderBy: { id: 'asc' },
    });
    const eligibleStaffIds: string[] = [];
    const eligibleByItem = new Map<number, string[]>();
    for (const candidate of candidateProfiles) {
      const skills = new Set(candidate.staffServices.map((item) => item.serviceId));
      if (combo?.staffAssignmentMode !== 'PER_SERVICE_PROVIDER') {
        if (!services.every((service) => skills.has(service.id))) continue;
        try {
          for (const service of services) {
            await validateStaffForService(
              this.prisma, candidate.id, service.id,
              appointmentStartTime, appointmentEndTime, data.branchId,
            );
          }
          eligibleStaffIds.push(candidate.id);
        } catch (error) {
          if (data.staffId) throw error;
        }
        continue;
      }
      for (const item of timeline) {
        if (!skills.has(item.service.id)) continue;
        try {
          await validateStaffForService(
            this.prisma, candidate.id, item.service.id,
            item.itemStartAt, item.itemEndAt, data.branchId,
          );
          eligibleByItem.set(item.sortOrder, [
            ...(eligibleByItem.get(item.sortOrder) ?? []),
            candidate.id,
          ]);
        } catch (error) {
          if (data.staffId) throw error;
        }
      }
    }
    const perServiceMode = combo?.staffAssignmentMode === 'PER_SERVICE_PROVIDER';
    if ((!perServiceMode && eligibleStaffIds.length === 0) ||
        (perServiceMode && timeline.some((item) => !(eligibleByItem.get(item.sortOrder)?.length)))) {
      throw new ConflictException(
        data.staffId
          ? 'Nhân viên này không còn khả dụng trong khung giờ đã chọn.'
          : 'Không còn nhân viên phù hợp trong khung giờ đã chọn.',
      );
    }

    // 6. Wrap trong transaction Serializable để chống race-condition double-book
    const bookingId = await withSerializableTransaction(
      this.prisma,
      async (tx) => {
        // Pick a concrete eligible staff and reserve that staff in the same
        // serializable transaction. PENDING is a blocking status.
        const assignedStaffIds: string[] = [];
        const reserveCandidate = async (
          candidates: string[],
          startAt: Date,
          endAt: Date,
        ) => {
          for (const candidateId of candidates) {
            const overlapping = await tx.bookingService.findFirst({
              where: {
                staffId: candidateId,
                booking: {
                  deletedAt: null,
                  status: { in: [...BLOCKING_BOOKING_STATUSES] },
                  appointmentDate: storedAppointment.appointmentDate,
                },
                OR: [
                  { itemStartAt: { lt: endAt }, itemEndAt: { gt: startAt } },
                  {
                    itemStartAt: null,
                    booking: {
                      appointmentStartTime: { lt: endAt },
                      appointmentEndTime: { gt: startAt },
                    },
                  },
                ],
              },
            });
            if (!overlapping) return candidateId;
          }
          return null;
        };
        if (perServiceMode) {
          for (const item of timeline) {
            const assigned = await reserveCandidate(
              eligibleByItem.get(item.sortOrder) ?? [],
              item.itemStartAt,
              item.itemEndAt,
            );
            if (!assigned) break;
            assignedStaffIds[item.sortOrder] = assigned;
          }
        } else {
          const assigned = await reserveCandidate(
            eligibleStaffIds,
            storedAppointment.appointmentStartTime,
            storedAppointment.appointmentEndTime,
          );
          if (assigned) timeline.forEach((item) => { assignedStaffIds[item.sortOrder] = assigned; });
        }
        if (assignedStaffIds.length !== timeline.length || assignedStaffIds.some((id) => !id)) {
          throw new ConflictException(
            'Khung giờ này vừa được người khác đặt. Vui lòng chọn giờ khác.',
          );
        }

        const customerOverlap = await tx.booking.findFirst({
          where: {
            customerId: data.customerId,
            deletedAt: null,
            status: { in: [...BLOCKING_BOOKING_STATUSES] },
            appointmentDate: storedAppointment.appointmentDate,
            AND: [
              { appointmentStartTime: { lt: storedAppointment.appointmentEndTime } },
              { appointmentEndTime: { gt: storedAppointment.appointmentStartTime } },
            ],
          },
        });
        if (customerOverlap) {
          throw new ConflictException(
            `Bạn đã có lịch trùng giờ (Mã: ${customerOverlap.bookingCode})`,
          );
        }

        const sequenceRows = await tx.$queryRaw<Array<{ value: bigint }>>`
          SELECT nextval('booking_code_seq') AS value
        `;
        const sequence = sequenceRows[0]?.value;
        if (sequence === undefined) {
          throw new ConflictException('Không thể cấp mã booking');
        }
        const bookingCode = `BB-${storedAppointment.appointmentDate.getUTCFullYear()}-${String(sequence).padStart(7, '0')}`;

        const initialStatus = data.source === 'WALK_IN' || branch.bookingConfirmationMode === 'AUTO_CONFIRMATION'
          ? 'CONFIRMED'
          : 'PENDING';
        const createdBase = await tx.booking.create({
          data: {
            bookingCode,
            customerId: data.customerId,
            branchId: data.branchId,
            recurringPlanId: data.recurringPlanId,
            appointmentDate: storedAppointment.appointmentDate,
            appointmentStartTime: storedAppointment.appointmentStartTime,
            appointmentEndTime: storedAppointment.appointmentEndTime,
            totalAmount: subtotal,
            ...(voucherInfo ? { voucherId: voucherInfo.voucherId } : {}),
            voucherDiscountAmount: voucherInfo?.discountAmount ?? null,
            finalAmount: finalTotal,
            status: initialStatus,
            source: data.source ?? 'ONLINE_WEB',
            pendingExpiresAt: initialStatus === 'PENDING'
              ? new Date(Date.now() + (configuredBookingPolicy.pendingHoldMinutes ?? branch.pendingHoldMinutes) * 60_000)
              : null,
            note: data.note,
          } as any,
        });

        // Keep dependent writes sequential on the transaction client. This
        // avoids queuing concurrent pg queries while a database slot guard is
        // rejecting another request for the same staff member.
        if (data.guestContact) {
          await tx.bookingContact.create({
            data: {
              bookingId: createdBase.id,
              fullName: data.guestContact.fullName,
              phone: data.guestContact.phone ?? null,
              email: data.guestContact.email ?? null,
            },
          });
        }
        await tx.bookingService.createMany({
          data: timeline.map((item) => ({
            bookingId: createdBase.id,
            serviceId: item.service.id,
            businessServiceId: item.service.businessServiceId,
            canonicalServiceId: item.service.businessService.canonicalServiceId,
            comboId: combo?.id,
            priceAtBooking: combo
              ? item.priceSnapshot / Math.max(1, originalSubtotal) * subtotal
              : item.service.price,
            durationMinutes: item.service.durationMinutes,
            serviceNameSnapshot: item.service.name,
            sortOrder: item.sortOrder,
            status: 'SCHEDULED',
            itemStartAt: item.itemStartAt,
            itemEndAt: item.itemEndAt,
            transitionMinutes: item.transitionMinutes,
            comboVersion: combo?.version,
            staffId: assignedStaffIds[item.sortOrder],
          })),
        });
        if (this.payments) {
          await this.payments.captureBookingSnapshots(tx, {
            bookingId: createdBase.id,
            businessId: branch.businessId,
            branchId: data.branchId,
            subtotal,
            discount: Number(voucherInfo?.discountAmount ?? 0),
            total: finalTotal,
            serviceIds: timeline.map((item) => item.service.id),
            items: timeline.map((item) => ({
              serviceId: item.service.id,
              serviceName: item.service.name,
              unitPrice: Number(item.priceSnapshot),
              durationMinutes: item.service.durationMinutes,
              comboId: combo?.id ?? null,
              comboVersion: combo?.version ?? null,
            })),
          });
        }
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: createdBase.id,
            status: initialStatus,
            changedBy: statusChangedBy,
            note: data.voucherCode
              ? `Tạo mới (voucher: ${data.voucherCode})`
              : 'Tạo mới',
          },
        });

        // Đánh dấu voucher đã dùng — update CÓ ĐIỀU KIỆN bên trong transaction
        // để chống oversell: nếu voucher hết lượt hoặc customerVoucher đã bị
        // dùng bởi request song song, updateMany trả count = 0 → rollback.
        if (voucherInfo) {
          const voucherState = initialStatus === 'CONFIRMED' ? 'USED' : 'RESERVED';
          const cvUpdated = await tx.customerVoucher.updateMany({
            where: {
              voucherId: voucherInfo.voucherId,
              customerId: data.customerId,
              status: 'ACTIVE',
            },
            data: {
              status: voucherState,
              reservedAt: new Date(),
              usedAt: voucherState === 'USED' ? new Date() : null,
              usedBookingId: createdBase.id,
            },
          });
          if (cvUpdated.count === 0) {
            throw new ConflictException(
              'Voucher của bạn đã được sử dụng — vui lòng thử lại',
            );
          }
          const vUpdated = await tx.$executeRaw`
            UPDATE vouchers
            SET used_quantity = used_quantity + 1
            WHERE id = ${voucherInfo.voucherId}
              AND used_quantity < total_quantity
              AND status = 'ACTIVE'`;
          if (vUpdated === 0) {
            throw new ConflictException(
              'Voucher đã hết lượt sử dụng — vui lòng thử lại',
            );
          }
        }

        if (combo) {
          const comboUpdated = await tx.$executeRaw`
            UPDATE combos SET used_count = used_count + 1
            WHERE id = ${combo.id}
              AND deleted_at IS NULL
              AND status = 'ACTIVE'
              AND (max_usage IS NULL OR used_count < max_usage)`;
          if (comboUpdated === 0) throw new ConflictException('Combo vừa hết lượt sử dụng — vui lòng chọn dịch vụ khác');
        }

        return createdBase.id;
      },
      { conflictMessage: 'Khung giờ này vừa được người khác đặt. Vui lòng chọn giờ khác.' },
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
        branch: { include: { business: true } },
        bookingServices: { include: { service: true, staff: true } },
      },
    });
    if (!booking) {
      throw new ConflictException('Không thể đọc lại lịch hẹn vừa tạo');
    }

    // 7. Notification fan-out — cho salon members biết có booking mới cần duyệt
    await notifySalonMembers(
      this.prisma,
      booking.branch.businessId,
      'BOOKING_CONFIRMED',
      booking.status === 'PENDING' ? 'Lịch hẹn mới cần xác nhận' : 'Lịch hẹn mới đã tự động xác nhận',
      `Khách ${booking.customer?.user?.fullName ?? 'ẩn danh'} vừa đặt lịch ${booking.bookingCode}`,
      booking.id,
    );
    this.schedulerGateway.notifyBookingCreated(booking);

    return booking;
  }

  async expirePendingHolds(branchId?: string): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.booking.findMany({
      where: {
        branchId: branchId || undefined,
        status: 'PENDING', pendingExpiresAt: { lte: now }, deletedAt: null,
      },
      select: {
        id: true,
        voucherId: true,
        bookingServices: {
          where: { comboId: { not: null } },
          select: { comboId: true },
          take: 1,
        },
      },
      take: 500,
    });
    if (expired.length === 0) return 0;
    const expiredCount = await withSerializableTransaction(this.prisma, async (tx) => {
      let count = 0;
      for (const item of expired) {
        const claimed = await tx.booking.updateMany({
          where: { id: item.id, status: 'PENDING', pendingExpiresAt: { lte: now } },
          data: { status: 'EXPIRED', pendingExpiresAt: null },
        });
        if (claimed.count !== 1) continue;
        count += 1;
        await tx.bookingStatusHistory.create({
          data: { bookingId: item.id, status: 'EXPIRED', note: 'Hết thời gian giữ chỗ' },
        });
        await this.releaseBookingBenefits(
          tx,
          item.id,
          item.voucherId,
          item.bookingServices[0]?.comboId ?? null,
        );
      }
      return count;
    }, { conflictMessage: 'Danh sách giữ chỗ vừa thay đổi, vui lòng thử lại' });
    return expiredCount;
  }

  async releaseBookingBenefits(
    tx: any,
    bookingId: string,
    voucherId?: string | null,
    comboId?: string | null,
  ) {
    if (voucherId) {
      const released = await tx.customerVoucher.updateMany({
        where: {
          usedBookingId: bookingId,
          voucherId,
          status: { in: ['RESERVED', 'USED'] },
        },
        data: {
          status: 'ACTIVE',
          reservedAt: null,
          usedAt: null,
          usedBookingId: null,
        },
      });
      if (released.count === 1) {
        await tx.voucher.updateMany({
          where: { id: voucherId, usedQuantity: { gt: 0 } },
          data: { usedQuantity: { decrement: 1 } },
        });
      }
    }
    if (comboId) {
      await tx.combo.updateMany({
        where: { id: comboId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
  }

  /**
   * Saga compensation for a multi-booking command such as recurring creation.
   * Rows are never hard-deleted: each successful reservation is conditionally
   * cancelled, receives history, and releases voucher/combo capacity in the
   * same serializable transaction.
   */
  async compensateCreatedBookings(
    bookingIds: string[],
    reason: string,
  ): Promise<number> {
    if (bookingIds.length === 0) return 0;
    return withSerializableTransaction(
      this.prisma,
      async (tx) => {
        const rows = await tx.booking.findMany({
          where: {
            id: { in: bookingIds },
            status: { in: ['PENDING', 'CONFIRMED'] },
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
            voucherId: true,
            bookingServices: {
              where: { comboId: { not: null } },
              select: { comboId: true },
              take: 1,
            },
          },
        });
        let compensated = 0;
        for (const row of rows) {
          const claimed = await tx.booking.updateMany({
            where: { id: row.id, status: row.status },
            data: {
              status: 'CANCELLED',
              pendingExpiresAt: null,
              cancelledAt: new Date(),
              cancelledByType: 'SYSTEM',
              cancelReason: reason,
            },
          });
          if (claimed.count !== 1) continue;
          compensated += 1;
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: row.id,
              status: 'CANCELLED',
              note: reason,
            },
          });
          await this.releaseBookingBenefits(
            tx,
            row.id,
            row.voucherId,
            row.bookingServices[0]?.comboId ?? null,
          );
        }
        return compensated;
      },
      {
        conflictMessage:
          'Không thể hoàn tác đầy đủ chuỗi lịch vừa tạo; cần kiểm tra thủ công',
      },
    );
  }

  async cancelRecurringPlanOccurrences(
    recurringPlanId: string,
    bookingIds: string[],
    changedBy: string,
    reason: string,
  ): Promise<number> {
    const platformPolicy = await this.platformSettings.getEffective();
    const cancelledIds = await withSerializableTransaction(
      this.prisma,
      async (tx) => {
        if (bookingIds.length > 0) {
          await tx.$queryRaw`
            SELECT id FROM bookings
            WHERE id IN (${Prisma.join(bookingIds)})
            ORDER BY id
            FOR UPDATE
          `;
        }
        const rows = await tx.booking.findMany({
          where: {
            id: { in: bookingIds },
            recurringPlanId,
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          select: {
            id: true,
            status: true,
            appointmentDate: true,
            appointmentStartTime: true,
            totalAmount: true,
            voucherId: true,
            branch: { select: { businessId: true } },
            bookingServices: {
              where: { comboId: { not: null } },
              select: { comboId: true },
              take: 1,
            },
          },
        });

        const ids: string[] = [];
        for (const row of rows) {
          assertStatusTransition(row.status, 'CANCELLED');
          assertActorStatusTransition(
            ['CUSTOMER'],
            row.status,
            'CANCELLED',
          );
          const decision = await resolveCancellationPolicy(
            tx as unknown as PrismaService,
            row.branch.businessId,
            Number(row.totalAmount),
            combineAppointmentDateTime(
              row.appointmentDate,
              row.appointmentStartTime,
            ),
            new Date(),
            platformPolicy.freeCancellationHours,
          );
          if (decision.policy === 'too_late') {
            throw new BadRequestException(
              decision.notes ??
                'Có kỳ đã qua hạn hủy; chuỗi chưa được thay đổi',
            );
          }
          const transitionNote =
            decision.policy === 'warn_late_cancel'
              ? `[Cảnh báo: ${decision.notes ?? 'hủy trễ, có tính phí'}] ${reason}`
              : reason;
          const claimed = await tx.booking.updateMany({
            where: { id: row.id, status: row.status },
            data: {
              status: 'CANCELLED',
              pendingExpiresAt: null,
              cancelledAt: new Date(),
              cancelledBy: changedBy,
              cancelledByType: 'CUSTOMER',
              cancelReason: transitionNote,
              cancellationFeeAmount:
                decision.policy === 'warn_late_cancel'
                  ? decision.feeAmount
                  : null,
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'Một kỳ trong chuỗi vừa thay đổi; chưa hủy kỳ nào',
            );
          }
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: row.id,
              status: 'CANCELLED',
              changedBy,
              note: transitionNote,
            },
          });
          await this.releaseBookingBenefits(
            tx,
            row.id,
            row.voucherId,
            row.bookingServices[0]?.comboId ?? null,
          );
          ids.push(row.id);
        }
        await tx.recurringBookingPlan.update({
          where: { id: recurringPlanId },
          data: { status: 'CANCELLED' },
        });
        return ids;
      },
      {
        conflictMessage:
          'Chuỗi lịch vừa thay đổi bởi yêu cầu khác, vui lòng tải lại',
      },
    );

    await Promise.all(
      cancelledIds.map((bookingId) =>
        notifyBookingBothParties(
          this.prisma,
          bookingId,
          'BOOKING_CANCELLED' as any,
          'Kỳ trong chuỗi lịch đã được hủy',
          reason,
        ),
      ),
    );
    return cancelledIds.length;
  }

  /**
   * API Scheduler: Lấy danh sách Staff và Bookings trong tuần/ngày
   */
  async getSchedulerData(
    branchId: string,
    startDate: string,
    endDate: string,
    options: { staffId?: string; redactCustomerContact?: boolean } = {},
  ) {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      throw new BadRequestException('Khoảng ngày scheduler không hợp lệ');
    }
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(options.staffId ? { id: options.staffId } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarMedia: { select: { url: true } } } },
        workingHours: true,
        attendances: {
          where: {
            workDate: {
              gte: appointmentDateFromInstant(rangeStart),
              lte: appointmentDateFromInstant(rangeEnd),
            },
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    const bookings = await this.prisma.booking.findMany({
      where: {
        branchId,
        ...(options.staffId
          ? { bookingServices: { some: { staffId: options.staffId } } }
          : {}),
        appointmentDate: {
          gte: appointmentDateFromInstant(rangeStart),
          lte: appointmentDateFromInstant(rangeEnd),
        },
        deletedAt: null,
      },
      include: {
        customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
        branch: { select: { id: true, name: true, business: { select: { id: true, name: true } } } },
        bookingServices: { include: { service: true, staff: { include: { user: { select: { id: true, fullName: true } } } } } },
      },
      orderBy: [{ appointmentDate: 'asc' }, { appointmentStartTime: 'asc' }],
    });

    if (!options.redactCustomerContact) return { staff, bookings };
    return {
      staff,
      bookings: bookings.map((booking) => ({
        ...booking,
        customer: booking.customer
          ? {
              ...booking.customer,
              user: booking.customer.user
                ? { ...booking.customer.user, email: null, phone: null }
                : booking.customer.user,
            }
          : booking.customer,
      })),
    };
  }

  /**
   * Customer-facing API: lấy danh sách slot trống của staff trong 1 ngày.
   *
   * Logic:
   *  - Tính duration từ serviceIds
   *  - Nếu staffId = null: lấy slot trống của TẤT CẢ staff active trong branch
   *  - Nếu staffId có giá trị: chỉ lấy slot của staff đó
   *  - Sinh slot theo bước SLOT_STEP_MIN phút trong khung giờ làm
   *  - Loại slot overlap với booking hiện tại (status != CANCELLED/NO_SHOW)
   *  - Loại slot đã qua (so với hiện tại)
   */
  async getAvailableSlots(params: {
    branchId: string;
    staffId: string | null;
    serviceIds: string[];
    date: string; // ISO date YYYY-MM-DD
  }) {
    await this.expirePendingHolds(params.branchId);
    const SLOT_STEP_MIN = 30;
    const branchReady = await this.prisma.branch.findFirst({
      where: {
        id: params.branchId, status: 'ACTIVE', deletedAt: null,
        business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
      },
      select: { id: true },
    });
    if (!branchReady) throw new BadRequestException('Chi nhánh chưa sẵn sàng nhận lịch.');

    const services = await this.prisma.branchServiceOffering.findMany({
      where: { id: { in: params.serviceIds }, branchId: params.branchId, status: 'ACTIVE', deletedAt: null },
    });
    if (services.length === 0) {
      throw new BadRequestException('Dịch vụ này hiện không nhận đặt lịch tại chi nhánh đã chọn.');
    }
    if (services.length !== new Set(params.serviceIds).size) {
      throw new BadRequestException('Dịch vụ này hiện không nhận đặt lịch tại chi nhánh đã chọn.');
    }
    const totalDuration = services.reduce(
      (sum, s) => sum + Number(s.durationMinutes || 0),
      0,
    );
    if (totalDuration <= 0) {
      throw new BadRequestException('Tổng thời lượng dịch vụ phải > 0');
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.date);
    if (!dateMatch) {
      throw new BadRequestException('date không hợp lệ');
    }
    const day = new Date(
      Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])),
    );
    if (Number.isNaN(day.getTime())) throw new BadRequestException('date không hợp lệ');
    const dayOfWeek = day.getUTCDay();
    const absentRows = await this.prisma.staffAttendance.findMany({
      where: { branchId: params.branchId, workDate: day, status: 'ABSENT' },
      select: { staffId: true },
    });
    const absentStaffIds = new Set(absentRows.map((row) => row.staffId));

    // Get staff(s) to check
    let staffList;
    if (params.staffId) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: params.staffId },
        include: {
          workingHours: true,
          staffServices: true,
          user: { select: { fullName: true, isActive: true, deletedAt: true } },
        },
      });
      if (!staff || staff.branchId !== params.branchId) {
        throw new BadRequestException('Nhân viên không thuộc chi nhánh này');
      }
      if (staff.status !== 'ACTIVE') {
        throw new BadRequestException('Nhân viên không khả dụng');
      }
      if (!staff.isBookable || (staff.userId && (!staff.user?.isActive || staff.user.deletedAt))) {
        throw new BadRequestException('Nhân sự này chưa được cấu hình nhận lịch');
      }
      if (absentStaffIds.has(staff.id)) {
        throw new BadRequestException('Nhân viên vắng mặt trong ngày đã chọn');
      }
      staffList = [staff];
    } else {
      // Get all active staff for this branch who can do the requested services
      const firstServiceId = params.serviceIds[0];
      staffList = await this.prisma.staffProfile.findMany({
        where: {
          branchId: params.branchId,
          status: 'ACTIVE',
          deletedAt: null,
          isBookable: true,
          OR: [{ userId: null }, { user: { is: { isActive: true, deletedAt: null } } }],
          staffServices: {
            some: { serviceId: { in: params.serviceIds } }
          }
        },
        include: {
          workingHours: true,
          staffServices: true,
          user: { select: { fullName: true, isActive: true, deletedAt: true } },
        },
      });
    }

    staffList = staffList.filter((staff) => {
      if (absentStaffIds.has(staff.id)) return false;
      const skills = new Set(staff.staffServices.map((item) => item.serviceId));
      return params.serviceIds.every((serviceId) => skills.has(serviceId));
    });

    if (staffList.length === 0) {
      return { slots: [], message: 'Không có nhân viên khả dụng cho dịch vụ này' };
    }

    const now = new Date();
    const allSlots: { start: string; end: string; staffId: string; staffName: string }[] = [];

    for (const staff of staffList) {
      const wh = staff.workingHours.find(
        (w) => w.dayOfWeek === dayOfWeek && !w.isOff,
      );
      const [specialDay, branchWorkingHour] = await Promise.all([
        this.prisma.specialWorkingDay.findFirst({
          where: {
            branchId: params.branchId,
            date: day,
            OR: [{ staffId: staff.id }, { staffId: null }],
          },
          orderBy: { staffId: 'desc' },
        }),
        this.prisma.branchWorkingHour.findUnique({
          where: {
            branchId_dayOfWeek: { branchId: params.branchId, dayOfWeek },
          },
        }),
      ]);
      if (!wh && !specialDay) continue;
      if (branchWorkingHour?.isClosed && !specialDay) continue;

      // Get existing bookings for this staff
      const existingBookings = await this.prisma.bookingService.findMany({
        where: {
          staffId: staff.id,
          booking: {
            deletedAt: null,
            status: { in: [...BLOCKING_BOOKING_STATUSES] },
            appointmentDate: day,
          },
        },
        include: {
          booking: {
            select: {
              appointmentDate: true,
              appointmentStartTime: true,
              appointmentEndTime: true,
            },
          },
        },
      });

      // Calculate working window
      const staffStart = new Date(specialDay?.startTime ?? wh!.startTime);
      const staffEnd = new Date(specialDay?.endTime ?? wh!.endTime);
      let windowStart = combineAppointmentDateTime(day, staffStart);
      let windowEnd = combineAppointmentDateTime(day, staffEnd);
      if (branchWorkingHour && !specialDay) {
        const branchStart = combineAppointmentDateTime(day, branchWorkingHour.openTime);
        const branchEnd = combineAppointmentDateTime(day, branchWorkingHour.closeTime);
        if (branchStart > windowStart) windowStart = branchStart;
        if (branchEnd < windowEnd) windowEnd = branchEnd;
      }

      let cursor = new Date(windowStart);
      while (cursor.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + totalDuration * 60000);

        // Skip past slots
        if (slotStart > now) {
          let validByDomainRules = true;
          for (const serviceId of params.serviceIds) {
            try {
              await validateStaffForService(
                this.prisma,
                staff.id,
                serviceId,
                slotStart,
                slotEnd,
                params.branchId,
              );
            } catch (error) {
              if (error instanceof BadRequestException) {
                validByDomainRules = false;
                break;
              }
              throw error;
            }
          }
          if (!validByDomainRules) {
            cursor = new Date(cursor.getTime() + SLOT_STEP_MIN * 60000);
            continue;
          }
          const hasOverlap = existingBookings.some((b) => {
            const interval = toBookingInterval(
              b.booking.appointmentDate,
              b.booking.appointmentStartTime,
              b.booking.appointmentEndTime,
            );
            return interval.start < slotEnd && interval.end > slotStart;
          });
          if (!hasOverlap) {
            allSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              staffId: staff.id,
              staffName: staff.user?.fullName || 'Staff',
            });
          }
        }

        cursor = new Date(cursor.getTime() + SLOT_STEP_MIN * 60000);
      }
    }

    // Sort by time, then return unique time slots (dedupe across staff)
    allSlots.sort((a, b) => a.start.localeCompare(b.start));
    const uniqueSlots = allSlots.filter((slot, idx, arr) => 
      idx === 0 || slot.start !== arr[idx - 1].start
    ).map(({ start, end }) => ({ start, end }));

    return {
      branchId: params.branchId,
      date: params.date,
      totalDuration,
      staffCount: staffList.length,
      slots: uniqueSlots,
    };
  }

  /**
   * Di chuyển lịch hẹn (Đổi giờ / Đổi thợ) — dùng policy cấp salon.
   *
   * LƯU Ý NGHIỆP VỤ:
   *  - Nếu khách gửi yêu cầu đổi lịch qua AppointmentChangeRequest → salon duyệt.
   *  - KHÔNG update thẳng appointment_start_time → giữ dấu vết yêu cầu gốc.
   *  - Hàm này chỉ dùng khi salon đã duyệt hoặc admin can thiệp.
   */
  async moveBooking(id: string, newStartTime: string, newEndTime: string, newStaffId: string) {
    const startTime = new Date(newStartTime);
    const endTime = new Date(newEndTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('newStartTime hoặc newEndTime không hợp lệ');
    }
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('newEndTime phải sau newStartTime');
    }
    if (!sameAppointmentDate(startTime, endTime)) {
      throw new BadRequestException('Booking qua ngày chưa được hỗ trợ');
    }
    const storedAppointment = normalizeAppointmentForStorage(startTime, endTime);

    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        bookingServices: true,
        branch: { select: { businessId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lịch hẹn');

    // Reschedule cutoff theo policy salon (mặc định 1h)
    const cutoffHours = await resolveRescheduleCutoffHours(
      this.prisma,
      existing.branch.businessId,
    );
    const existingStart = combineAppointmentDateTime(
      existing.appointmentDate,
      existing.appointmentStartTime,
    );
    const diffMs = existingStart.getTime() - Date.now();
    if (diffMs < cutoffHours * 60 * 60 * 1000) {
      throw new BadRequestException(
        `Chỉ có thể đổi lịch trước giờ hẹn ít nhất ${cutoffHours} giờ`,
      );
    }

    if (existing.bookingServices[0]?.serviceId) {
      await validateStaffForService(
        this.prisma,
        newStaffId,
        existing.bookingServices[0].serviceId,
        startTime,
        endTime,
        existing.branchId,
      );
    }
    await this.assertStaffNotAbsent(newStaffId, existing.branchId, startTime);
    await assertNoOverlap(this.prisma, newStaffId, id, startTime, endTime);
    await assertCustomerNotDoubleBooked(
      this.prisma,
      existing.customerId,
      id,
      startTime,
      endTime,
    );

    const booking = await withSerializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM bookings WHERE id = ${id} FOR UPDATE`;
      const locked = await tx.booking.findUnique({
        where: { id },
        include: {
          bookingServices: true,
          branch: { select: { businessId: true } },
        },
      });
      if (!locked) throw new NotFoundException('Không tìm thấy lịch hẹn');

      const lockedStart = combineAppointmentDateTime(
        locked.appointmentDate,
        locked.appointmentStartTime,
      );
      if (lockedStart.getTime() - Date.now() < cutoffHours * 60 * 60 * 1000) {
        throw new BadRequestException(
          `Chỉ có thể đổi lịch trước giờ hẹn ít nhất ${cutoffHours} giờ`,
        );
      }

      const transactionClient = tx as unknown as PrismaService;
      if (locked.bookingServices[0]?.serviceId) {
        await validateStaffForService(
          transactionClient,
          newStaffId,
          locked.bookingServices[0].serviceId,
          startTime,
          endTime,
          locked.branchId,
        );
      }
      await this.assertStaffNotAbsent(
        newStaffId,
        locked.branchId,
        startTime,
        transactionClient,
      );
      await assertNoOverlap(
        transactionClient,
        newStaffId,
        id,
        startTime,
        endTime,
      );
      await assertCustomerNotDoubleBooked(
        transactionClient,
        locked.customerId,
        id,
        startTime,
        endTime,
      );

      const updated = await tx.booking.update({
        where: { id },
        data: {
          appointmentDate: storedAppointment.appointmentDate,
          appointmentStartTime: storedAppointment.appointmentStartTime,
          appointmentEndTime: storedAppointment.appointmentEndTime,
          bookingServices: {
            updateMany: {
              where: { bookingId: id },
              data: { staffId: newStaffId },
            },
          },
        },
        include: {
          customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
          branch: { include: { business: true } },
          bookingServices: { include: { service: true, staff: true } },
        },
      });
      // Ghi status_history (admin move thì ghi cả audit)
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: updated.status,
          changedBy: undefined,
          note: `Reschedule sang ${startTime.toISOString()} với staff ${newStaffId}`,
        },
      });
      return updated;
    }, {
      conflictMessage:
        'Khung giờ vừa được thay đổi bởi yêu cầu khác, vui lòng tải lại',
    });

    await notifyBookingBothParties(
      this.prisma,
      id,
      'BOOKING_RESCHEDULE_APPROVED',
      'Lịch hẹn đã được dời',
      `Thời gian mới: ${startTime.toLocaleString('vi-VN')}`,
    );
    this.schedulerGateway.notifyBookingUpdated(booking);
    return booking;
  }

  /**
   * Đổi thời lượng lịch hẹn (Resize) — có overlap check.
   */
  async resizeBooking(id: string, newEndTime: string) {
    const bookingExisting = await this.prisma.booking.findUnique({
      where: { id },
      include: { bookingServices: true },
    });
    if (!bookingExisting) throw new NotFoundException('Booking not found');

    const existingInterval = toBookingInterval(
      bookingExisting.appointmentDate,
      bookingExisting.appointmentStartTime,
      bookingExisting.appointmentEndTime,
    );
    const newEnd = new Date(newEndTime);
    if (isNaN(newEnd.getTime()) || newEnd <= existingInterval.start) {
      throw new BadRequestException('newEndTime phải sau appointmentStartTime');
    }
    if (!sameAppointmentDate(existingInterval.start, newEnd)) {
      throw new BadRequestException('Booking qua ngày chưa được hỗ trợ');
    }

    const staffId = bookingExisting.bookingServices[0]?.staffId;
    if (staffId) {
      await assertNoOverlap(
        this.prisma,
        staffId,
        id,
        existingInterval.start,
        newEnd,
      );
    }

    const booking = await withSerializableTransaction(
      this.prisma,
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM bookings WHERE id = ${id} FOR UPDATE`;
        const locked = await tx.booking.findUnique({
          where: { id },
          include: { bookingServices: true },
        });
        if (!locked) throw new NotFoundException('Booking not found');

        const lockedInterval = toBookingInterval(
          locked.appointmentDate,
          locked.appointmentStartTime,
          locked.appointmentEndTime,
        );
        if (
          newEnd <= lockedInterval.start ||
          !sameAppointmentDate(lockedInterval.start, newEnd)
        ) {
          throw new ConflictException(
            'Lịch hẹn đã được thay đổi; thời gian kết thúc mới không còn hợp lệ',
          );
        }

        const lockedStaffId = locked.bookingServices[0]?.staffId;
        const transactionClient = tx as unknown as PrismaService;
        if (lockedStaffId) {
          await assertNoOverlap(
            transactionClient,
            lockedStaffId,
            id,
            lockedInterval.start,
            newEnd,
          );
        }
        await assertCustomerNotDoubleBooked(
          transactionClient,
          locked.customerId,
          id,
          lockedInterval.start,
          newEnd,
        );

        const updated = await tx.booking.update({
          where: { id },
          data: {
            appointmentEndTime: normalizeAppointmentForStorage(
              lockedInterval.start,
              newEnd,
            ).appointmentEndTime,
          },
          include: {
            customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
            bookingServices: { include: { service: true, staff: true } },
          },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            status: updated.status,
            note: `Resize đến ${newEnd.toISOString()}`,
          },
        });
        return updated;
      },
      {
        conflictMessage:
          'Lịch hẹn vừa được thay đổi bởi yêu cầu khác, vui lòng tải lại',
      },
    );

    this.schedulerGateway.notifyBookingUpdated(booking);
    return booking;
  }

  /**
   * Phân công thợ — có validate staff + overlap.
   */
  async assignStaff(id: string, staffId: string) {
    const bookingExisting = await this.prisma.booking.findUnique({
      where: { id },
      include: { bookingServices: true },
    });
    if (!bookingExisting) throw new NotFoundException('Booking not found');
    const bookingInterval = toBookingInterval(
      bookingExisting.appointmentDate,
      bookingExisting.appointmentStartTime,
      bookingExisting.appointmentEndTime,
    );

    // Validate staff phục vụ được dịch vụ + trong giờ làm
    if (bookingExisting.bookingServices[0]?.serviceId) {
      await validateStaffForService(
        this.prisma,
        staffId,
        bookingExisting.bookingServices[0].serviceId,
        bookingInterval.start,
        bookingInterval.end,
        bookingExisting.branchId,
      );
    }
    await this.assertStaffNotAbsent(staffId, bookingExisting.branchId, bookingInterval.start);

    await assertNoOverlap(
      this.prisma,
      staffId,
      id,
      bookingInterval.start,
      bookingInterval.end,
    );

    const booking = await withSerializableTransaction(
      this.prisma,
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM bookings WHERE id = ${id} FOR UPDATE`;
        const locked = await tx.booking.findUnique({
          where: { id },
          include: { bookingServices: true },
        });
        if (!locked) throw new NotFoundException('Booking not found');
        const lockedInterval = toBookingInterval(
          locked.appointmentDate,
          locked.appointmentStartTime,
          locked.appointmentEndTime,
        );
        const transactionClient = tx as unknown as PrismaService;
        if (locked.bookingServices[0]?.serviceId) {
          await validateStaffForService(
            transactionClient,
            staffId,
            locked.bookingServices[0].serviceId,
            lockedInterval.start,
            lockedInterval.end,
            locked.branchId,
          );
        }
        await this.assertStaffNotAbsent(
          staffId,
          locked.branchId,
          lockedInterval.start,
          transactionClient,
        );
        await assertNoOverlap(
          transactionClient,
          staffId,
          id,
          lockedInterval.start,
          lockedInterval.end,
        );

        const updated = await tx.booking.update({
          where: { id },
          data: {
            bookingServices: {
              updateMany: {
                where: { bookingId: id },
                data: { staffId },
              },
            },
          },
          include: {
            customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, avatarMediaId: true } } } },
            bookingServices: { include: { service: true, staff: true } },
          },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            status: updated.status,
            note: `Phân công staff ${staffId}`,
          },
        });
        return updated;
      },
      {
        conflictMessage:
          'Nhân viên hoặc lịch hẹn vừa thay đổi, vui lòng tải lại',
      },
    );

    this.schedulerGateway.notifyBookingUpdated(booking);
    return booking;
  }

  /**
   * Thống kê tổng quan lịch hẹn (KPI cho AdminAppointmentsView)
   * + filter theo branchIds (multi-tenancy).
   */
  async getStats() {
    return this.getStatsForBranches(undefined);
  }

  async getStatsForBranches(branchIds?: string[]) {
    const filter = branchIds === undefined ? {} : { branchId: { in: branchIds } };
    const [total, pending, confirmed, checkedIn, inProgress, completed, cancelled, noShow] =
      await Promise.all([
        this.prisma.booking.count({ where: { deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'PENDING', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'CONFIRMED', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'CHECKED_IN', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'IN_PROGRESS', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'COMPLETED', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'CANCELLED', deletedAt: null, ...filter } }),
        this.prisma.booking.count({ where: { status: 'NO_SHOW', deletedAt: null, ...filter } }),
      ]);

    return { total, pending, confirmed, checkedIn, inProgress, completed, cancelled, noShow };
  }

  /**
   * Lịch hẹn theo nhóm dịch vụ (cho tab "Theo Nhóm Dịch Vụ")
   */
  async getByCategory(categoryName: string, allowedBranchIds?: string[]) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        ...(allowedBranchIds === undefined ? {} : { branchId: { in: allowedBranchIds } }),
        bookingServices: {
          some: {
            service: {
              category: { name: categoryName },
            },
          },
        },
      },
      include: {
        customer: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        branch: {
          include: { business: { select: { id: true, name: true } } },
        },
        bookingServices: {
          include: {
            service: { include: { category: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const statusLabelMap: Record<string, string> = {
      PENDING: 'Mới',
      CONFIRMED: 'Đã xác nhận',
      IN_PROGRESS: 'Đang thực hiện',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
      NO_SHOW: 'No-show',
    };

    return bookings.map((b) => ({
      id: b.bookingCode,
      customer_id: b.customer?.user?.id,
      customer_name: b.customer?.user?.fullName || 'N/A',
      salon_id: b.branch?.business?.id,
      salon_name: b.branch?.business?.name || b.branch?.name || 'N/A',
      service_category: categoryName,
      appointment_time: b.appointmentDate,
      status: statusLabelMap[b.status] || b.status,
    }));
  }

  /**
   * Lịch hẹn theo chi nhánh (cho tab "Theo Cơ Sở")
   */
  async getByBranch(branchId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { branchId, deletedAt: null },
      include: {
        customer: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        branch: {
          include: { business: { select: { id: true, name: true } } },
        },
        bookingServices: {
          include: {
            service: { include: { category: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusLabelMap: Record<string, string> = {
      PENDING: 'Mới',
      CONFIRMED: 'Đã xác nhận',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
      NO_SHOW: 'No-show',
    };

    const total = bookings.length;
    const completed = bookings.filter((b) => b.status === 'COMPLETED').length;
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
    const noShow = bookings.filter((b) => b.status === 'NO_SHOW').length;

    return {
      stats: {
        total,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
        noShowRate: total ? Math.round((noShow / total) * 100) : 0,
      },
      data: bookings.map((b) => ({
        id: b.bookingCode,
        customer_id: b.customer?.user?.id,
        customer_name: b.customer?.user?.fullName || 'N/A',
        salon_id: b.branch?.business?.id,
        salon_name: b.branch?.business?.name || b.branch?.name || 'N/A',
        service_category:
          b.bookingServices?.[0]?.service?.category?.name || 'N/A',
        appointment_time: b.appointmentDate,
        status: statusLabelMap[b.status] || b.status,
      })),
    };
  }

  /**
   * Lịch hẹn theo khách hàng (cho tab "Theo Người Dùng")
   */
  async getByCustomer(userId: string, allowedBranchIds?: string[]) {
    const customerProfile = await this.prisma.customerProfile.findFirst({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true } } },
    });

    if (!customerProfile) {
      return { user: null, stats: null, data: [] };
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId: customerProfile.id,
        deletedAt: null,
        ...(allowedBranchIds === undefined ? {} : { branchId: { in: allowedBranchIds } }),
      },
      include: {
        branch: {
          include: { business: { select: { id: true, name: true } } },
        },
        bookingServices: {
          include: {
            service: { include: { category: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusLabelMap: Record<string, string> = {
      PENDING: 'Mới',
      CONFIRMED: 'Đã xác nhận',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
      NO_SHOW: 'No-show',
    };

    const totalSpent = bookings
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    return {
      user: {
        id: customerProfile.user.id,
        name: customerProfile.user.fullName,
        phone: customerProfile.user.phone,
      },
      stats: {
        totalBookings: bookings.length,
        frequencyPerMonth:
          bookings.length > 0
            ? Number((bookings.length / 6).toFixed(1))
            : 0,
        totalSpent,
      },
      data: bookings.map((b) => ({
        id: b.bookingCode,
        customer_id: userId,
        customer_name: customerProfile.user.fullName,
        salon_id: b.branch?.business?.id,
        salon_name: b.branch?.business?.name || b.branch?.name || 'N/A',
        service_category:
          b.bookingServices?.[0]?.service?.category?.name || 'N/A',
        appointment_time: b.appointmentDate,
        status: statusLabelMap[b.status] || b.status,
      })),
    };
  }

  /**
   * Reception check-in — records IN_PROGRESS transition if booking is CONFIRMED.
   */
  async checkin(bookingId: string, actorUserId: string, actorRoles: string[]) {
    return this.updateStatus(
      bookingId,
      'CHECKED_IN',
      actorUserId,
      'Receptionist check-in',
      'SALON',
      actorRoles,
    );
  }

}
