import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertBranchAccess, resolveBusinessIdsForUser, ALL_TENANTS } from '../common/utils/multi-tenancy';
import { auditLog } from '../common/utils/audit';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notifyBookingBothParties } from '../common/utils/notify';
import { WorkforceService } from '../workforce/workforce.service';

type QrPurpose = 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
interface QrPayload { branchId: string; businessId: string; issuedAt: number; expiresAt: number; nonce: string; purpose: QrPurpose }

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: PlatformSettingsService,
    private readonly bookings: BookingsService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly workforce?: WorkforceService,
  ) {}

  private dateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  private workDate(key: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new BadRequestException('Ngày chấm công không hợp lệ');
    const date = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày chấm công không hợp lệ');
    return date;
  }

  private combine(date: Date, time: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds()));
  }

  private qrSecret() {
    return this.config.get<string>('ATTENDANCE_QR_SECRET') || this.config.get<string>('JWT_SECRET') || 'beauty-booking-local-attendance-secret';
  }

  private sign(encoded: string) {
    return createHmac('sha256', this.qrSecret()).update(encoded).digest('base64url');
  }

  private encode(payload: QrPayload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  verifyToken(token: string, expectedPurpose?: 'CHECK_IN' | 'CHECK_OUT'): QrPayload {
    const [encoded, supplied] = String(token || '').split('.');
    if (!encoded || !supplied) throw new BadRequestException('QR token không hợp lệ');
    const expected = this.sign(encoded);
    const left = Buffer.from(supplied); const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new BadRequestException('Chữ ký QR không hợp lệ');
    let payload: QrPayload;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { throw new BadRequestException('QR token không hợp lệ'); }
    if (!payload.branchId || !payload.businessId || !payload.nonce || payload.expiresAt * 1000 <= Date.now()) {
      throw new BadRequestException('QR đã hết hạn. Vui lòng quét mã mới.');
    }
    if (payload.issuedAt * 1000 > Date.now() + 5000) throw new BadRequestException('QR token có thời gian không hợp lệ');
    if (expectedPurpose && payload.purpose !== 'BOTH' && payload.purpose !== expectedPurpose) throw new BadRequestException('QR không đúng mục đích chấm công');
    return payload;
  }

  private async selfStaff(user: AuthUser) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: user.id }, include: { branch: { select: { id: true, businessId: true, name: true } } },
    });
    if (!staff) throw new ForbiddenException('Tài khoản chưa được liên kết hồ sơ nhân sự nội bộ');
    if (staff.status !== 'ACTIVE' || staff.deletedAt) throw new ForbiddenException('Hồ sơ nhân sự không hoạt động');
    return staff;
  }

  private async schedule(staffId: string, branchId: string, workDate: Date) {
    const dayOfWeek = workDate.getUTCDay();
    // Isolated tests may use a reduced Prisma double without this new model.
    const scheduleVersionDelegate = (this.prisma as PrismaService & {
      staffScheduleVersion?: PrismaService['staffScheduleVersion'];
    }).staffScheduleVersion;
    const [special, normal, holiday, leave, version] = await Promise.all([
      this.prisma.specialWorkingDay.findFirst({ where: { branchId, date: workDate, OR: [{ staffId }, { staffId: null }] }, orderBy: { staffId: 'desc' } }),
      this.prisma.staffWorkingHour.findUnique({ where: { staffId_dayOfWeek: { staffId, dayOfWeek } } }),
      this.prisma.branchHoliday.findFirst({ where: { branchId, date: workDate, isClosed: true } }),
      this.prisma.staffLeave.findFirst({ where: { staffId, status: 'APPROVED', startAt: { lte: this.combine(workDate, new Date('1970-01-01T23:59:59Z')) }, endAt: { gte: workDate } } }),
      scheduleVersionDelegate?.findFirst({
        where: {
          staffId,
          branchId,
          status: 'PUBLISHED',
          effectiveFrom: { lte: workDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
        },
        include: {
          segments: {
            where: { dayOfWeek, segmentType: 'SHIFT' },
            orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
          },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      }) ?? Promise.resolve(null),
    ]);
    const versionSegments = version?.segments ?? [];
    if (leave || (holiday && !special) || (!special && !versionSegments.length && (!normal || normal.isOff))) return null;
    const startTime = special?.startTime ?? versionSegments[0]?.startTime ?? normal!.startTime;
    const endTime = special?.endTime ?? versionSegments[versionSegments.length - 1]?.endTime ?? normal!.endTime;
    const startAt = this.combine(workDate, startTime);
    let endAt = this.combine(workDate, endTime);
    if (endAt.getTime() <= startAt.getTime()) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
    const segments = special
      ? [{ startTime: special.startTime, endTime: special.endTime, roleCode: null }]
      : versionSegments.length
        ? versionSegments.map((segment) => ({ startTime: segment.startTime, endTime: segment.endTime, roleCode: segment.roleCode }))
        : [{ startTime: normal!.startTime, endTime: normal!.endTime, roleCode: null }];
    return {
      startTime,
      endTime,
      startAt,
      endAt,
      segments: segments.map((segment) => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        startAt: this.combine(workDate, segment.startTime),
        endAt: this.combine(workDate, segment.endTime),
        roleCode: segment.roleCode,
      })),
      scheduleVersionId: version?.id ?? null,
    };
  }

  async boardContext(user: AuthUser, branchId?: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId: user.id }, select: { branchId: true } });
    const resolvedBranchId = branchId || staff?.branchId || user.scopes?.find((scope) => scope.branchId)?.branchId;
    if (!resolvedBranchId) throw new BadRequestException('Chọn chi nhánh để mở QR board');
    await assertBranchAccess(this.prisma, user, resolvedBranchId);
    const branch = await this.prisma.branch.findUnique({ where: { id: resolvedBranchId }, select: { id: true, name: true, businessId: true, status: true, business: { select: { name: true } } } });
    if (!branch || branch.status !== 'ACTIVE') throw new BadRequestException('Chi nhánh không hoạt động');
    return branch;
  }

  async generateQr(user: AuthUser, branchId?: string, purpose: QrPurpose = 'BOTH') {
    const branch = await this.boardContext(user, branchId);
    const policy = await this.settings.getEffective();
    const now = Math.floor(Date.now() / 1000);
    const payload: QrPayload = { branchId: branch.id, businessId: branch.businessId, issuedAt: now, expiresAt: now + policy.attendanceQrTtlSeconds, nonce: randomBytes(12).toString('hex'), purpose };
    await this.prisma.attendanceQrToken.create({
      data: {
        nonce: payload.nonce,
        businessId: payload.businessId,
        branchId: payload.branchId,
        purpose,
        issuedAt: new Date(payload.issuedAt * 1000),
        expiresAt: new Date(payload.expiresAt * 1000),
        createdBy: user.id,
      },
    });
    const token = this.encode(payload);
    const backupCode = String(parseInt(createHmac('sha256', this.qrSecret()).update(token).digest('hex').slice(0, 8), 16) % 1_000_000).padStart(6, '0');
    return { token, scanUrl: `/salon/attendance/my?token=${encodeURIComponent(token)}`, backupCode, expiresAt: new Date(payload.expiresAt * 1000), ttlSeconds: policy.attendanceQrTtlSeconds, branch };
  }

  async myToday(user: AuthUser, date = this.dateKey()) {
    const staff = await this.selfStaff(user); const workDate = this.workDate(date);
    const [schedule, attendance, requests] = await Promise.all([
      this.schedule(staff.id, staff.branchId, workDate),
      this.prisma.staffAttendance.findUnique({
        where: { staffId_branchId_workDate: { staffId: staff.id, branchId: staff.branchId, workDate } },
        include: {
          events: {
            where: { eventType: { in: ['BREAK_START', 'BREAK_END'] } },
            orderBy: { eventAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.attendanceExceptionRequest.findMany({ where: { staffId: staff.id, workDate }, orderBy: { createdAt: 'desc' } }),
    ]);
    const breakOpen = attendance?.events?.[0]?.eventType === 'BREAK_START';
    return {
      staff: { id: staff.id, fullName: staff.fullName, position: staff.position },
      branch: staff.branch,
      workDate,
      schedule,
      attendance: attendance ? { ...attendance, events: undefined } : null,
      breakOpen,
      exceptionRequests: requests,
    };
  }

  async myHistory(user: AuthUser, from?: string, to?: string) {
    const staff = await this.selfStaff(user);
    const end = this.workDate(to || this.dateKey());
    const start = from ? this.workDate(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (start.getTime() > end.getTime()) throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    if (end.getTime() - start.getTime() > 180 * 24 * 60 * 60 * 1000) throw new BadRequestException('Chỉ có thể xem tối đa 180 ngày mỗi lần');
    const [attendances, exceptionRequests] = await Promise.all([
      this.prisma.staffAttendance.findMany({ where: { staffId: staff.id, workDate: { gte: start, lte: end } }, orderBy: { workDate: 'desc' } }),
      this.prisma.attendanceExceptionRequest.findMany({ where: { staffId: staff.id, workDate: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { from: start, to: end, attendances, exceptionRequests };
  }

  private async punch(
    user: AuthUser,
    qrToken: string,
    mode: 'CHECK_IN' | 'CHECK_OUT',
    metadata: { userAgent?: string; ipAddress?: string } = {},
  ) {
    const payload = this.verifyToken(qrToken, mode); const staff = await this.selfStaff(user);
    if (staff.branchId !== payload.branchId || staff.branch.businessId !== payload.businessId) throw new ForbiddenException('QR không thuộc chi nhánh của nhân viên');
    const issuedToken = await this.prisma.attendanceQrToken.findUnique({ where: { nonce: payload.nonce } });
    if (!issuedToken ||
        issuedToken.branchId !== payload.branchId ||
        issuedToken.businessId !== payload.businessId ||
        issuedToken.expiresAt.getTime() <= Date.now() ||
        (issuedToken.purpose !== 'BOTH' && issuedToken.purpose !== mode)) {
      throw new BadRequestException('QR không còn hiệu lực hoặc không do hệ thống phát hành');
    }
    const workDate = this.workDate(this.dateKey()); const schedule = await this.schedule(staff.id, staff.branchId, workDate);
    if (!schedule) throw new BadRequestException('Hôm nay bạn chưa có ca làm. Hãy gửi yêu cầu chấm công ngoại lệ.');
    const policy = await this.settings.getEffective(); const now = new Date();
    const key = { staffId: staff.id, branchId: staff.branchId, workDate };
    const existing = await this.prisma.staffAttendance.findUnique({ where: { staffId_branchId_workDate: key } });
    if (existing?.status === 'ABSENT') throw new ConflictException('Bạn đang được đánh dấu vắng. Vui lòng liên hệ quản lý.');
    const deviceHash = metadata.userAgent || metadata.ipAddress
      ? createHash('sha256').update(`${metadata.userAgent || ''}|${metadata.ipAddress || ''}`).digest('hex')
      : null;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.attendanceQrUse.create({
          data: {
            qrNonce: payload.nonce,
            staffId: staff.id,
            userId: user.id,
            action: mode,
            deviceHash,
          },
        });
        const current = await tx.staffAttendance.findUnique({ where: { staffId_branchId_workDate: key } });
        if (current?.status === 'ABSENT') throw new ConflictException('Bạn đang được đánh dấu vắng. Vui lòng liên hệ quản lý.');
        if (mode === 'CHECK_IN') {
          if (current?.checkInAt) throw new ConflictException('Bạn đã check-in hôm nay');
          if (now.getTime() < schedule.startAt.getTime() - policy.checkInEarlyWindowMinutes * 60_000) throw new BadRequestException(`Chỉ được check-in sớm tối đa ${policy.checkInEarlyWindowMinutes} phút.`);
          if (now.getTime() > schedule.endAt.getTime()) throw new BadRequestException('Ca làm đã kết thúc. Hãy gửi yêu cầu ngoại lệ.');
          const lateMinutes = Math.max(0, Math.floor((now.getTime() - schedule.startAt.getTime()) / 60_000));
          const status = lateMinutes > policy.lateGraceMinutes ? 'LATE' : 'CHECKED_IN';
          const attendance = await tx.staffAttendance.upsert({
            where: { staffId_branchId_workDate: key },
            create: {
              businessId: staff.branch.businessId,
              branchId: staff.branchId,
              staffId: staff.id,
              userId: user.id,
              workDate,
              scheduledStartTime: schedule.startTime,
              scheduledEndTime: schedule.endTime,
              scheduleVersionId: schedule.scheduleVersionId,
              scheduleSnapshot: {
                versionId: schedule.scheduleVersionId,
                segments: schedule.segments.map((segment) => ({
                  startTime: segment.startTime.toISOString(),
                  endTime: segment.endTime.toISOString(),
                  roleCode: segment.roleCode,
                })),
              },
              checkInAt: now,
              checkInMethod: 'QR',
              status,
              lateMinutes,
            },
            update: {
              scheduledStartTime: schedule.startTime,
              scheduledEndTime: schedule.endTime,
              scheduleVersionId: schedule.scheduleVersionId,
              scheduleSnapshot: {
                versionId: schedule.scheduleVersionId,
                segments: schedule.segments.map((segment) => ({
                  startTime: segment.startTime.toISOString(),
                  endTime: segment.endTime.toISOString(),
                  roleCode: segment.roleCode,
                })),
              },
              checkInAt: now,
              checkInMethod: 'QR',
              status,
              lateMinutes,
            },
          });
          await tx.attendanceEvent.create({ data: {
            attendanceId: attendance.id, businessId: staff.branch.businessId, branchId: staff.branchId,
            staffId: staff.id, actorId: user.id, eventType: 'CHECK_IN', eventAt: now,
            originalData: current as any, newData: { checkInAt: now.toISOString(), status, lateMinutes }, reason: 'QR check-in', source: 'QR',
          } });
          return { attendance, previous: current, lateMinutes };
        }
        if (!current?.checkInAt) throw new ConflictException('Bạn chưa check-in nên không thể check-out');
        if (current.checkOutAt) throw new ConflictException('Bạn đã check-out hôm nay');
        const earlyLeaveMinutes = Math.max(0, Math.floor((schedule.endAt.getTime() - now.getTime()) / 60_000));
        const overtimeMinutesRaw = Math.max(0, Math.floor((now.getTime() - schedule.endAt.getTime()) / 60_000));
        const overtimeMinutes = overtimeMinutesRaw > policy.overtimeGraceMinutes ? overtimeMinutesRaw : 0;
        const status = earlyLeaveMinutes > policy.checkOutEarlyGraceMinutes ? 'LEFT_EARLY' : 'CHECKED_OUT';
        const attendance = await tx.staffAttendance.update({ where: { id: current.id }, data: { checkOutAt: now, checkOutMethod: 'QR', status, earlyLeaveMinutes, overtimeMinutes } });
        await tx.attendanceEvent.create({ data: {
          attendanceId: attendance.id, businessId: staff.branch.businessId, branchId: staff.branchId,
          staffId: staff.id, actorId: user.id, eventType: 'CHECK_OUT', eventAt: now,
          originalData: current as any, newData: { checkOutAt: now.toISOString(), status, earlyLeaveMinutes, overtimeMinutes }, reason: 'QR check-out', source: 'QR',
        } });
        return { attendance, previous: current, earlyLeaveMinutes, overtimeMinutes };
      });
      await auditLog(this.prisma, {
        userId: user.id,
        action: mode === 'CHECK_IN' ? 'CREATE' : 'UPDATE',
        entityType: mode === 'CHECK_IN' ? 'StaffAttendanceCheckIn' : 'StaffAttendanceCheckOut',
        entityId: result.attendance.id,
        oldData: result.previous,
        newData: result.attendance,
        reason: `QR ${mode === 'CHECK_IN' ? 'check-in' : 'check-out'}`,
      });
      if (mode === 'CHECK_OUT') {
        await this.workforce?.syncTimesheet(result.attendance.id);
      }
      return result.attendance;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('QR này đã được tài khoản sử dụng cho thao tác chấm công này');
      }
      throw error;
    }
  }

  checkIn(user: AuthUser, qrToken: string, metadata?: { userAgent?: string; ipAddress?: string }) { return this.punch(user, qrToken, 'CHECK_IN', metadata); }
  checkOut(user: AuthUser, qrToken: string, metadata?: { userAgent?: string; ipAddress?: string }) { return this.punch(user, qrToken, 'CHECK_OUT', metadata); }

  async breakPunch(user: AuthUser, mode: 'START' | 'END') {
    const staff = await this.selfStaff(user);
    const workDate = this.workDate(this.dateKey());
    const attendance = await this.prisma.staffAttendance.findUnique({
      where: { staffId_branchId_workDate: { staffId: staff.id, branchId: staff.branchId, workDate } },
    });
    if (!attendance?.checkInAt || attendance.checkOutAt) {
      throw new ConflictException('Chỉ ghi nhận giờ nghỉ trong khi đang làm việc');
    }
    const lastBreak = await this.prisma.attendanceEvent.findFirst({
      where: { attendanceId: attendance.id, eventType: { in: ['BREAK_START', 'BREAK_END'] } },
      orderBy: { eventAt: 'desc' },
    });
    if (mode === 'START' && lastBreak?.eventType === 'BREAK_START') {
      throw new ConflictException('Giờ nghỉ đã được bắt đầu');
    }
    if (mode === 'END' && lastBreak?.eventType !== 'BREAK_START') {
      throw new ConflictException('Chưa có giờ nghỉ đang mở');
    }
    const event = await this.prisma.attendanceEvent.create({
      data: {
        attendanceId: attendance.id,
        businessId: attendance.businessId,
        branchId: attendance.branchId,
        staffId: attendance.staffId,
        actorId: user.id,
        eventType: mode === 'START' ? 'BREAK_START' : 'BREAK_END',
        eventAt: new Date(),
        reason: mode === 'START' ? 'Bắt đầu giờ nghỉ' : 'Kết thúc giờ nghỉ',
        source: 'STAFF_ACCOUNT',
      },
    });
    if (mode === 'END') await this.workforce?.syncTimesheet(attendance.id);
    return event;
  }

  async branchToday(user: AuthUser, branchId: string, date = this.dateKey()) {
    await assertBranchAccess(this.prisma, user, branchId); const workDate = this.workDate(date);
    const staffRows = await this.prisma.staffProfile.findMany({ where: { branchId, deletedAt: null }, include: { user: { select: { id: true, fullName: true, userRoles: { include: { role: true } } } }, attendances: { where: { workDate } } }, orderBy: { fullName: 'asc' } });
    return Promise.all(staffRows.map(async (staff) => {
      const schedule = await this.schedule(staff.id, branchId, workDate);
      const bookingCount = await this.prisma.booking.count({ where: { branchId, appointmentDate: workDate, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] }, bookingServices: { some: { staffId: staff.id } }, deletedAt: null } });
      return { staff: { id: staff.id, fullName: staff.fullName, position: staff.position, role: staff.user?.userRoles?.[0]?.role?.code ?? 'STAFF' }, schedule, attendance: staff.attendances[0] ?? null, bookingCount };
    }));
  }

  async tenantReport(user: AuthUser, from: string, to: string, branchId?: string) {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.staffAttendance.findMany({
      where: {
        businessId: businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds },
        branchId: branchId || undefined,
        workDate: { gte: this.workDate(from), lte: this.workDate(to) },
      }, include: { staff: { select: { fullName: true, position: true } }, branch: { select: { name: true } } }, orderBy: [{ workDate: 'desc' }, { scheduledStartTime: 'asc' }],
    });
  }

  async createException(user: AuthUser, body: { type: 'CHECK_IN' | 'CHECK_OUT' | 'ADJUST_TIME'; workDate: string; proposedAt: string; reason: string; note?: string }) {
    if (!body.reason?.trim()) throw new BadRequestException('Lý do ngoại lệ là bắt buộc');
    const proposedAt = new Date(body.proposedAt); if (Number.isNaN(proposedAt.getTime())) throw new BadRequestException('Giờ đề xuất không hợp lệ');
    const staff = await this.selfStaff(user); const workDate = this.workDate(body.workDate);
    const request = await this.prisma.attendanceExceptionRequest.create({ data: { businessId: staff.branch.businessId, branchId: staff.branchId, staffId: staff.id, requestedBy: user.id, type: body.type, workDate, proposedAt, reason: body.reason.trim(), note: body.note?.trim() || null } });
    await this.prisma.attendanceEvent.create({ data: {
      businessId: staff.branch.businessId, branchId: staff.branchId, staffId: staff.id, actorId: user.id,
      eventType: 'ADJUSTMENT_REQUESTED', eventAt: new Date(), newData: { requestId: request.id, type: body.type, workDate: body.workDate, proposedAt: proposedAt.toISOString() },
      reason: body.reason.trim(), source: 'SELF_SERVICE',
    } });
    await auditLog(this.prisma, { userId: user.id, action: 'CREATE', entityType: 'AttendanceExceptionRequest', entityId: request.id, newData: request, reason: request.reason });
    const reviewers = await this.prisma.userRole.findMany({
      where: {
        role: { code: { in: ['BUSINESS_OWNER', 'BRANCH_MANAGER'] } },
        OR: [{ businessId: staff.branch.businessId, branchId: null }, { branchId: staff.branchId }],
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    if (reviewers.length) await this.notifications.createBulk(reviewers.map((item) => item.userId), {
      type: 'SYSTEM', severity: 'WARNING', title: 'Yêu cầu chấm công cần duyệt',
      body: `${staff.fullName} đã gửi yêu cầu ${body.type} cho ngày ${body.workDate}.`,
      targetType: 'ATTENDANCE', targetId: request.id, actionUrl: '/salon/attendance',
    });
    return request;
  }

  async listExceptions(user: AuthUser, branchId?: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.attendanceExceptionRequest.findMany({ where: { businessId: businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds }, branchId: branchId || undefined, status: status || undefined }, include: { staff: { select: { fullName: true, position: true } }, branch: { select: { name: true } }, requester: { select: { fullName: true } }, reviewer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async reviewException(user: AuthUser, id: string, approve: boolean, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do duyệt/từ chối là bắt buộc');
    const request = await this.prisma.attendanceExceptionRequest.findUnique({ where: { id }, include: { staff: true } });
    if (!request) throw new NotFoundException('Yêu cầu ngoại lệ không tồn tại');
    await assertBranchAccess(this.prisma, user, request.branchId);
    if (request.requestedBy === user.id) throw new ForbiddenException('Không được tự duyệt yêu cầu chấm công của chính mình');
    if (request.status !== 'PENDING') throw new ConflictException('Yêu cầu đã được xử lý');
    let attendanceId = request.attendanceId;
    if (approve) {
      const schedule = await this.schedule(request.staffId, request.branchId, request.workDate);
      if (!schedule) throw new BadRequestException('Không có ca làm để áp dụng ngoại lệ');
      const key = { staffId: request.staffId, branchId: request.branchId, workDate: request.workDate };
      const existing = await this.prisma.staffAttendance.findUnique({ where: { staffId_branchId_workDate: key } });
      const data: any = { status: 'MANUALLY_ADJUSTED', adjustedBy: user.id, adjustedAt: new Date(), adjustmentReason: reason.trim() };
      if (request.type === 'CHECK_IN' || request.type === 'ADJUST_TIME') { data.checkInAt = request.proposedAt; data.checkInMethod = 'MANUAL_EXCEPTION'; }
      if (request.type === 'CHECK_OUT') { if (!existing?.checkInAt) throw new BadRequestException('Chưa có check-in để bổ sung check-out'); data.checkOutAt = request.proposedAt; data.checkOutMethod = 'MANUAL_EXCEPTION'; }
      const attendance = await this.prisma.staffAttendance.upsert({ where: { staffId_branchId_workDate: key }, create: { businessId: request.businessId, branchId: request.branchId, staffId: request.staffId, userId: request.requestedBy, workDate: request.workDate, scheduledStartTime: schedule.startTime, scheduledEndTime: schedule.endTime, ...data }, update: data });
      attendanceId = attendance.id;
    }
    const updated = await this.prisma.attendanceExceptionRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', attendanceId, reviewedBy: user.id, reviewedAt: new Date(), reviewReason: reason.trim() } });
    await this.prisma.attendanceEvent.create({ data: {
      attendanceId, businessId: request.businessId, branchId: request.branchId, staffId: request.staffId, actorId: user.id,
      eventType: approve ? 'ADJUSTMENT_APPROVED' : 'ADJUSTMENT_REJECTED',
      originalData: { requestId: request.id, status: request.status }, newData: { requestId: request.id, status: updated.status, attendanceId },
      reason: reason.trim(), source: 'MANAGER_REVIEW',
    } });
    await auditLog(this.prisma, { userId: user.id, action: 'STATUS_CHANGE', entityType: 'AttendanceExceptionRequest', entityId: id, oldData: { status: 'PENDING' }, newData: { status: updated.status, attendanceId }, reason: reason.trim() });
    await this.notifications.create({
      userId: request.requestedBy, type: 'SYSTEM', severity: approve ? 'SUCCESS' : 'WARNING',
      title: approve ? 'Yêu cầu chấm công đã được duyệt' : 'Yêu cầu chấm công bị từ chối',
      body: reason.trim(), targetType: 'ATTENDANCE', targetId: id, actionUrl: '/salon/attendance/my',
    });
    if (approve && attendanceId) {
      await this.workforce?.syncTimesheet(attendanceId);
    }
    return updated;
  }

  async adjust(user: AuthUser, id: string, body: { checkInAt?: string; checkOutAt?: string; reason: string }) {
    if (!body.reason?.trim()) throw new BadRequestException('Lý do chỉnh công là bắt buộc');
    const existing = await this.prisma.staffAttendance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bản công không tồn tại');
    await assertBranchAccess(this.prisma, user, existing.branchId);
    const updated = await this.prisma.staffAttendance.update({ where: { id }, data: { checkInAt: body.checkInAt ? new Date(body.checkInAt) : undefined, checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : undefined, checkInMethod: body.checkInAt ? 'MANUAL_ADJUSTMENT' : undefined, checkOutMethod: body.checkOutAt ? 'MANUAL_ADJUSTMENT' : undefined, status: 'MANUALLY_ADJUSTED', adjustedBy: user.id, adjustedAt: new Date(), adjustmentReason: body.reason.trim() } });
    await this.prisma.attendanceEvent.create({ data: {
      attendanceId: id, businessId: existing.businessId, branchId: existing.branchId, staffId: existing.staffId, actorId: user.id,
      eventType: 'MANUAL_ADJUSTMENT', originalData: existing as any, newData: updated as any,
      reason: body.reason.trim(), source: 'MANAGER',
    } });
    await auditLog(this.prisma, { userId: user.id, action: 'UPDATE', entityType: 'StaffAttendance', entityId: id, oldData: existing, newData: updated, reason: body.reason.trim() });
    await this.workforce?.syncTimesheet(id);
    if (existing.userId) await this.notifications.create({ userId: existing.userId, type: 'SYSTEM', severity: 'INFO', title: 'Bảng công đã được điều chỉnh', body: body.reason.trim(), targetType: 'ATTENDANCE', targetId: id, actionUrl: '/salon/attendance/my' });
    return updated;
  }

  async markAbsent(user: AuthUser, staffId: string, date: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do vắng mặt là bắt buộc');
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: staffId }, include: { branch: true } });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    await assertBranchAccess(this.prisma, user, staff.branchId); const workDate = this.workDate(date); const schedule = await this.schedule(staff.id, staff.branchId, workDate);
    if (!schedule) throw new BadRequestException('Nhân viên không có ca làm trong ngày này');
    const key = { staffId: staff.id, branchId: staff.branchId, workDate };
    const attendance = await this.prisma.staffAttendance.upsert({ where: { staffId_branchId_workDate: key }, create: { businessId: staff.branch.businessId, branchId: staff.branchId, staffId: staff.id, userId: staff.userId, workDate, scheduledStartTime: schedule.startTime, scheduledEndTime: schedule.endTime, status: 'ABSENT', note: reason.trim(), absentMarkedBy: user.id, absentMarkedAt: new Date() }, update: { status: 'ABSENT', note: reason.trim(), absentMarkedBy: user.id, absentMarkedAt: new Date() } });
    const affectedBookings = await this.affectedBookings(user, staffId, date);
    await this.prisma.attendanceEvent.create({ data: {
      attendanceId: attendance.id, businessId: staff.branch.businessId, branchId: staff.branchId, staffId: staff.id, actorId: user.id,
      eventType: 'MARKED_ABSENT', newData: { status: 'ABSENT', affectedBookingIds: affectedBookings.map((item) => item.id) },
      reason: reason.trim(), source: 'MANAGER',
    } });
    await auditLog(this.prisma, { userId: user.id, action: 'STATUS_CHANGE', entityType: 'StaffAttendance', entityId: attendance.id, newData: { status: 'ABSENT', affectedBookingIds: affectedBookings.map((item) => item.id) }, reason: reason.trim() });
    await this.workforce?.syncTimesheet(attendance.id);
    if (staff.userId) await this.notifications.create({ userId: staff.userId, type: 'SYSTEM', severity: 'WARNING', title: 'Bạn đã được đánh dấu vắng mặt', body: `${date}: ${reason.trim()}`, targetType: 'ATTENDANCE', targetId: attendance.id, actionUrl: '/salon/attendance/my' });
    return { attendance, affectedBookings };
  }

  async restoreAbsent(user: AuthUser, attendanceId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Lý do khôi phục là bắt buộc');
    const existing = await this.prisma.staffAttendance.findUnique({ where: { id: attendanceId } });
    if (!existing) throw new NotFoundException('Bản công không tồn tại');
    await assertBranchAccess(this.prisma, user, existing.branchId);
    const status = existing.checkOutAt ? 'CHECKED_OUT' : existing.checkInAt ? 'CHECKED_IN' : 'NOT_CHECKED_IN';
    const updated = await this.prisma.staffAttendance.update({ where: { id: attendanceId }, data: { status, absentMarkedBy: null, absentMarkedAt: null, note: reason.trim(), adjustedBy: user.id, adjustedAt: new Date(), adjustmentReason: reason.trim() } });
    await this.prisma.attendanceEvent.create({ data: {
      attendanceId, businessId: existing.businessId, branchId: existing.branchId, staffId: existing.staffId, actorId: user.id,
      eventType: 'ABSENCE_RESTORED', originalData: { status: existing.status }, newData: { status },
      reason: reason.trim(), source: 'MANAGER',
    } });
    await auditLog(this.prisma, { userId: user.id, action: 'STATUS_CHANGE', entityType: 'StaffAttendance', entityId: attendanceId, oldData: { status: 'ABSENT' }, newData: { status }, reason: reason.trim() });
    await this.workforce?.syncTimesheet(attendanceId);
    if (existing.userId) await this.notifications.create({ userId: existing.userId, type: 'SYSTEM', severity: 'SUCCESS', title: 'Trạng thái vắng mặt đã được khôi phục', body: reason.trim(), targetType: 'ATTENDANCE', targetId: attendanceId, actionUrl: '/salon/attendance/my' });
    return updated;
  }

  async affectedBookings(user: AuthUser, staffId: string, date: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: staffId }, select: { branchId: true } });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    await assertBranchAccess(this.prisma, user, staff.branchId); const workDate = this.workDate(date);
    return this.prisma.booking.findMany({ where: { branchId: staff.branchId, appointmentDate: workDate, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] }, bookingServices: { some: { staffId } }, deletedAt: null }, include: { customer: { include: { user: { select: { fullName: true, phone: true } } } }, bookingServices: { include: { service: true, staff: true } } }, orderBy: { appointmentStartTime: 'asc' } });
  }

  async resolveAffectedBooking(user: AuthUser, staffId: string, bookingId: string, body: { action: 'REASSIGN' | 'RESCHEDULE' | 'CANCEL'; replacementStaffId?: string; newStartTime?: string; newEndTime?: string; reason: string }) {
    if (!body.reason?.trim()) throw new BadRequestException('Lý do xử lý là bắt buộc');
    const affected = await this.prisma.booking.findFirst({ where: { id: bookingId, bookingServices: { some: { staffId } }, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } }, select: { id: true, branchId: true } });
    if (!affected) throw new NotFoundException('Booking không nằm trong danh sách bị ảnh hưởng');
    await assertBranchAccess(this.prisma, user, affected.branchId);
    if (body.action !== 'CANCEL' && !body.replacementStaffId) throw new BadRequestException('Nhân viên thay thế là bắt buộc');
    if (body.action === 'RESCHEDULE' && (!body.newStartTime || !body.newEndTime)) throw new BadRequestException('Thời gian mới là bắt buộc');
    const result = body.action === 'REASSIGN'
      ? await this.bookings.assignStaff(bookingId, body.replacementStaffId || '')
      : body.action === 'RESCHEDULE'
        ? await this.bookings.moveBooking(bookingId, body.newStartTime || '', body.newEndTime || '', body.replacementStaffId || '')
        : await this.bookings.updateStatus(bookingId, 'CANCELLED', user.id, `Lịch hẹn cần thay đổi do nhân viên phụ trách vắng đột xuất. ${body.reason}`, 'SALON', user.roles);
    if (body.action === 'REASSIGN') await notifyBookingBothParties(this.prisma, bookingId, 'SYSTEM', 'Nhân viên phục vụ đã được thay đổi', body.reason.trim());
    if (body.replacementStaffId) {
      const replacement = await this.prisma.staffProfile.findUnique({ where: { id: body.replacementStaffId }, select: { userId: true } });
      if (replacement?.userId) await this.notifications.create({ userId: replacement.userId, type: 'SYSTEM', severity: 'INFO', title: 'Bạn có lịch hẹn được phân công', body: body.reason.trim(), relatedBookingId: bookingId, targetType: 'BOOKING', targetId: bookingId, actionUrl: `/salon/appointments?bookingId=${bookingId}` });
    }
    const newData = body.action === 'CANCEL'
      ? { status: 'CANCELLED' }
      : { staffId: body.replacementStaffId, ...(body.action === 'RESCHEDULE' ? { startTime: body.newStartTime, endTime: body.newEndTime } : {}) };
    await auditLog(this.prisma, { userId: user.id, action: body.action === 'CANCEL' ? 'CANCEL' : 'UPDATE', entityType: 'Booking', entityId: bookingId, oldData: { staffId }, newData, reason: body.reason.trim() });
    return result;
  }
}
