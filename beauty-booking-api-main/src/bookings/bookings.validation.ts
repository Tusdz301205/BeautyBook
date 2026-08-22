import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  appointmentDateFromInstant,
  appointmentTimeFromInstant,
  getZonedDateTimeParts,
  timeValueMinutes,
} from '../common/utils/booking-datetime';

/**
 * Booking status flow theo URD §7 — sơ đồ trạng thái.
 * Đã bổ sung state-machine guard (gap C trong phản biện URD).
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
  NO_SHOW: [], // terminal
  REJECTED: [], // terminal
  EXPIRED: [], // terminal
};

export const BLOCKING_BOOKING_STATUSES = [
  'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
] as const;

const ACTOR_STATUS_TRANSITIONS: Record<string, Record<string, string[]>> = {
  CUSTOMER: {
    PENDING: ['CANCELLED'],
    CONFIRMED: ['CANCELLED'],
  },
  RECEPTIONIST: {
    PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
    CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  },
  STAFF: {
    CHECKED_IN: ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED'],
  },
  BRANCH_MANAGER: {
    PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
    CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
    CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  },
};

export function assertActorStatusTransition(
  roles: readonly string[],
  from: string,
  to: string,
): void {
  if (roles.includes('PLATFORM_ADMIN')) return;

  const effectiveRoles = roles.flatMap((role) =>
    role === 'BUSINESS_OWNER' ? ['BRANCH_MANAGER'] : [role],
  );
  const allowed = effectiveRoles.some((role) =>
    (ACTOR_STATUS_TRANSITIONS[role]?.[from] ?? []).includes(to),
  );
  if (!allowed) {
    throw new BadRequestException(
      `Role ${roles.join(', ') || '(none)'} không được chuyển trạng thái từ "${from}" sang "${to}"`,
    );
  }
}

/**
 * Validate state transition. Throw BadRequestException nếu không hợp lệ.
 */
export function assertStatusTransition(from: string, to: string): void {
  if (from === to) {
    throw new BadRequestException(`Lịch đã ở trạng thái ${to}`);
  }
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái từ "${from}" sang "${to}". Cho phép: ${allowed.join(', ') || '(trạng thái kết thúc)'}`,
    );
  }
}

/**
 * Validate giờ đặt lịch phải ở tương lai.
 */
export function assertFutureAppointment(appointmentDate: Date): void {
  const now = new Date();
  if (appointmentDate.getTime() <= now.getTime()) {
    throw new BadRequestException(
      'Thời gian đặt lịch phải ở tương lai (sau hiện tại)',
    );
  }
}

/**
 * Validate thời lượng booking > 0 và slot tối thiểu 30 phút theo URD §9.1 giả định #5.
 */
export function assertValidDuration(durationMinutes: number): void {
  const MIN_SLOT = 30;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new BadRequestException('Thời lượng dịch vụ phải lớn hơn 0 phút');
  }
  if (durationMinutes < MIN_SLOT) {
    throw new BadRequestException(`Slot tối thiểu là ${MIN_SLOT} phút`);
  }
}

/**
 * Cancel policy giờ chuyển sang src/common/utils/policy.ts (hỗ trợ policy cấp salon).
 * Giữ helper cũ evaluateCancelPolicy cho các test/backward compat.
 */
export type CancelPolicy = 'allowed' | 'warn_late_cancel' | 'too_late';

export function evaluateCancelPolicy(
  appointmentStartTime: Date,
  now: Date = new Date(),
): CancelPolicy {
  const diffMs = appointmentStartTime.getTime() - now.getTime();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  if (diffMs < 0) return 'too_late';
  if (diffMs < TWO_HOURS) return 'warn_late_cancel';
  return 'allowed';
}

/**
 * Validate staff status, working hours, và có quyền làm dịch vụ.
 * Trả về staff nếu OK; throw nếu không hợp lệ.
 *
 * Áp dụng gap B trong phản biện URD: STAFF phải có status ACTIVE,
 * có StaffService mapping, và nằm trong StaffWorkingHour.
 */
export async function validateStaffForService(
  prisma: PrismaService,
  staffId: string,
  serviceId: string,
  startTime: Date,
  endTime: Date = startTime,
  expectedBranchId?: string,
): Promise<void> {
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffId },
    include: {
      workingHours: true,
      breaks: { where: { isActive: true } },
      staffServices: { where: { serviceId } },
      user: { select: { isActive: true, deletedAt: true } },
    },
  });

  if (!staff) {
    throw new BadRequestException(`Nhân viên ${staffId} không tồn tại`);
  }
  if (staff.status !== 'ACTIVE') {
    throw new BadRequestException(
      `Nhân viên hiện không khả dụng (trạng thái: ${staff.status})`,
    );
  }
  if (expectedBranchId && staff.branchId !== expectedBranchId) {
    throw new BadRequestException('Nhân viên không thuộc chi nhánh của booking');
  }
  if (!staff.isBookable) {
    throw new BadRequestException('Nhân sự này chưa được bật nhận lịch');
  }
  if (staff.userId && (!staff.user?.isActive || staff.user.deletedAt)) {
    throw new BadRequestException('Tài khoản chuyên viên không còn hoạt động');
  }
  if (staff.staffServices.length === 0) {
    throw new BadRequestException(
      `Nhân viên chưa được đăng ký làm dịch vụ này`,
    );
  }

  const date = appointmentDateFromInstant(startTime);
  const dayOfWeek = date.getUTCDay();
  const [leave, holiday, specialDay, branchWorkingHour] = await Promise.all([
    prisma.staffLeave.findFirst({
      where: {
        staffId,
        status: 'APPROVED',
        startAt: { lt: endTime },
        endAt: { gt: startTime },
      },
    }),
    prisma.branchHoliday.findUnique({
      where: { branchId_date: { branchId: staff.branchId, date } },
    }),
    prisma.specialWorkingDay.findFirst({
      where: {
        branchId: staff.branchId,
        date,
        OR: [{ staffId }, { staffId: null }],
      },
      orderBy: { staffId: 'desc' },
    }),
    prisma.branchWorkingHour.findUnique({
      where: {
        branchId_dayOfWeek: { branchId: staff.branchId, dayOfWeek },
      },
    }),
  ]);
  if (leave) {
    throw new BadRequestException('Nhân viên đang trong thời gian nghỉ đã được duyệt');
  }
  if (holiday?.isClosed && !specialDay) {
    throw new BadRequestException(`Chi nhánh nghỉ: ${holiday.name}`);
  }

  // Kiểm tra giờ làm; ngày đặc biệt được ưu tiên hơn lịch tuần.
  const workingHour = staff.workingHours.find(
    (wh) => wh.dayOfWeek === dayOfWeek && !wh.isOff,
  );
  if (!workingHour && !specialDay) {
    throw new BadRequestException(
      `Nhân viên không làm việc vào ${['CN','T2','T3','T4','T5','T6','T7'][dayOfWeek]}`,
    );
  }
  const whStart = new Date(specialDay?.startTime ?? workingHour!.startTime);
  const whEnd = new Date(specialDay?.endTime ?? workingHour!.endTime);
  // PostgreSQL TIME is a wall-clock value. Read it with UTC getters and
  // compare it with the configured booking timezone, never the host timezone.
  const whStartMinutes = timeValueMinutes(whStart);
  const whEndMinutes = timeValueMinutes(whEnd);
  const startParts = getZonedDateTimeParts(startTime);
  const endParts = getZonedDateTimeParts(endTime);
  const startMinutes = startParts.hour * 60 + startParts.minute;
  const endMinutes = endParts.hour * 60 + endParts.minute;
  if (branchWorkingHour && !specialDay) {
    if (branchWorkingHour.isClosed) {
      throw new BadRequestException('Chi nhánh đóng cửa trong ngày đã chọn');
    }
    const branchStart = timeValueMinutes(branchWorkingHour.openTime);
    const branchEnd = timeValueMinutes(branchWorkingHour.closeTime);
    if (startMinutes < branchStart || endMinutes > branchEnd) {
      throw new BadRequestException('Giờ đặt nằm ngoài giờ mở cửa của chi nhánh');
    }
  }
  if (startMinutes < whStartMinutes || endMinutes > whEndMinutes) {
    throw new BadRequestException(
      `Giờ đặt nằm ngoài khung giờ làm việc của nhân viên (${whStartMinutes / 60}h - ${whEndMinutes / 60}h)`,
    );
  }

  const overlapsBreak = staff.breaks.some((item) => {
    if (item.dayOfWeek !== dayOfWeek) return false;
    const breakStart = new Date(item.startTime);
    const breakEnd = new Date(item.endTime);
    const breakStartMinutes = timeValueMinutes(breakStart);
    const breakEndMinutes = timeValueMinutes(breakEnd);
    return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes;
  });
  if (overlapsBreak) {
    throw new BadRequestException('Khung giờ trùng giờ nghỉ của nhân viên');
  }
}

export const BOOKING_TIME_RULES = Object.freeze({
  earlyCheckInMinutes: Number(process.env.BOOKING_EARLY_CHECK_IN_MINUTES ?? 30),
  startGraceMinutes: Number(process.env.BOOKING_START_GRACE_MINUTES ?? 0),
  noShowGraceMinutes: Number(process.env.BOOKING_NO_SHOW_GRACE_MINUTES ?? 15),
});

export interface TimeTransitionInput {
  fromStatus: string;
  toStatus: string;
  appointmentStartTime: Date;
  appointmentEndTime: Date;
  now?: Date;
  earlyCheckInMinutes?: number;
  startGraceMinutes?: number;
  noShowGraceMinutes?: number;
}

export interface TimeTransitionDecision {
  allowed: boolean;
  reason: string | null;
  allowedAt: Date | null;
}

/**
 * Single source of truth for time-gated booking status transitions.
 * Permission and state-machine checks remain separate so this helper can also
 * provide a safe, actor-independent decision to the frontend.
 */
export function evaluateTimeAllowedForStatusTransition({
  fromStatus,
  toStatus,
  appointmentStartTime,
  appointmentEndTime,
  now = new Date(),
  earlyCheckInMinutes = BOOKING_TIME_RULES.earlyCheckInMinutes,
  startGraceMinutes = BOOKING_TIME_RULES.startGraceMinutes,
  noShowGraceMinutes = BOOKING_TIME_RULES.noShowGraceMinutes,
}: TimeTransitionInput): TimeTransitionDecision {
  const minute = 60_000;
  let allowedAt: Date | null = null;
  let reason: string | null = null;

  if (fromStatus === 'CONFIRMED' && toStatus === 'CHECKED_IN') {
    allowedAt = new Date(appointmentStartTime.getTime() - earlyCheckInMinutes * minute);
    reason = 'Chưa thể check-in vì chưa đến thời gian cho phép.';
  } else if (fromStatus === 'CHECKED_IN' && toStatus === 'IN_PROGRESS') {
    allowedAt = new Date(appointmentStartTime.getTime() - startGraceMinutes * minute);
    reason = 'Chưa thể bắt đầu vì lịch hẹn chưa diễn ra.';
  } else if (fromStatus === 'IN_PROGRESS' && toStatus === 'COMPLETED') {
    allowedAt = appointmentEndTime;
    reason = 'Chưa thể hoàn thành vì lịch hẹn chưa diễn ra.';
  } else if (fromStatus === 'CONFIRMED' && toStatus === 'NO_SHOW') {
    allowedAt = new Date(appointmentStartTime.getTime() + noShowGraceMinutes * minute);
    reason = 'Chưa thể đánh dấu vắng mặt trước khi hết thời gian chờ.';
  }

  if (!allowedAt) return { allowed: true, reason: null, allowedAt: null };
  const allowed = toStatus === 'NO_SHOW'
    ? now.getTime() > allowedAt.getTime()
    : now.getTime() >= allowedAt.getTime();
  return { allowed, reason: allowed ? null : reason, allowedAt };
}

export function assertTimeAllowedForStatusTransition(input: TimeTransitionInput): void {
  const decision = evaluateTimeAllowedForStatusTransition(input);
  if (!decision.allowed) {
    throw new BadRequestException(decision.reason);
  }
}

/**
 * Kiểm tra overlap cho 1 staff trong khoảng [startTime, endTime).
 * Bỏ qua các booking CANCELLED/NO_SHOW và bookingIdToIgnore (khi move/resize).
 */
export async function assertNoOverlap(
  prisma: PrismaService,
  staffId: string,
  bookingIdToIgnore: string | null,
  startTime: Date,
  endTime: Date,
): Promise<void> {
  const appointmentDate = appointmentDateFromInstant(startTime);
  const appointmentStartTime = appointmentTimeFromInstant(startTime);
  const appointmentEndTime = appointmentTimeFromInstant(endTime);
  const overlapping = await prisma.bookingService.findFirst({
    where: {
      staffId,
      bookingId: bookingIdToIgnore ? { not: bookingIdToIgnore } : undefined,
      booking: {
        deletedAt: null,
        status: { in: [...BLOCKING_BOOKING_STATUSES] },
        appointmentDate,
        AND: [
          { appointmentStartTime: { lt: appointmentEndTime } },
          { appointmentEndTime: { gt: appointmentStartTime } },
        ],
      },
    },
    include: { booking: { select: { bookingCode: true } } },
  });

  if (overlapping) {
    throw new ConflictException(
      `Nhân viên đã có lịch trùng (Mã lịch: ${overlapping.booking.bookingCode})`,
    );
  }
}

/**
 * Kiểm tra customer không có 2 booking trùng giờ.
 */
export async function assertCustomerNotDoubleBooked(
  prisma: PrismaService,
  customerId: string,
  bookingIdToIgnore: string | null,
  startTime: Date,
  endTime: Date,
): Promise<void> {
  const appointmentDate = appointmentDateFromInstant(startTime);
  const appointmentStartTime = appointmentTimeFromInstant(startTime);
  const appointmentEndTime = appointmentTimeFromInstant(endTime);
  const overlapping = await prisma.booking.findFirst({
    where: {
      customerId,
      deletedAt: null,
      id: bookingIdToIgnore ? { not: bookingIdToIgnore } : undefined,
      status: { in: [...BLOCKING_BOOKING_STATUSES] },
      appointmentDate,
      AND: [
        { appointmentStartTime: { lt: appointmentEndTime } },
        { appointmentEndTime: { gt: appointmentStartTime } },
      ],
    },
    select: { bookingCode: true },
  });
  if (overlapping) {
    throw new ConflictException(
      `Bạn đã có lịch khác trùng giờ (Mã: ${overlapping.bookingCode})`,
    );
  }
}
