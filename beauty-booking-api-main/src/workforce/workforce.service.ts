import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompensationEntryType,
  CompensationRuleType,
  PayRunStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';
import {
  ALL_TENANTS,
  assertBranchAccess,
  assertBusinessAccess,
  resolveBusinessIdsForUser,
} from '../common/utils/multi-tenancy';
import { auditLog } from '../common/utils/audit';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ApproveTimesheetDto,
  AssignCompensationRuleDto,
  CalculateCompensationDto,
  CreateCompensationRuleDto,
  CreatePayRunDto,
  CreateTimesheetAdjustmentDto,
  GenerateTimesheetsDto,
  ReplaceAvailabilityDto,
  ReviewTimesheetAdjustmentDto,
  TransitionPayRunDto,
} from './workforce.dto';

const DAY_MS = 86_400_000;

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  private dateOnly(value: string, label = 'Ngày') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} phải có định dạng YYYY-MM-DD`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} không hợp lệ`);
    return date;
  }

  private timeOnly(value: string, label: string) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
      throw new BadRequestException(`${label} phải có định dạng HH:mm`);
    }
    return new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}.000Z`);
  }

  private minutesBetween(start: Date, end: Date) {
    let result = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (result < 0) result += 24 * 60;
    return Math.max(0, result);
  }

  private async selfStaff(user: AuthUser) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: user.id },
      include: { branch: { select: { id: true, businessId: true, name: true } } },
    });
    if (!staff || staff.deletedAt || staff.status === 'INACTIVE') {
      throw new ForbiddenException('Tài khoản chưa có hồ sơ nhân sự đang hoạt động');
    }
    return staff;
  }

  private async assertStaffRead(user: AuthUser, staffId: string, permission: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: { branch: { select: { businessId: true } } },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const own = staff.userId === user.id;
    if (own && can(user, permission.replace(/:(branch|tenant)$/, ':self'), { ownerId: user.id })) {
      return staff;
    }
    if (
      can(user, permission, {
        tenantId: staff.branch.businessId,
        branchId: staff.branchId,
      })
    ) {
      await assertBranchAccess(this.prisma, user, staff.branchId);
      return staff;
    }
    throw new ForbiddenException('Không có quyền truy cập dữ liệu nhân sự này');
  }

  async listAvailability(user: AuthUser, staffId?: string, branchId?: string) {
    let resolvedStaffId = staffId;
    if (!resolvedStaffId) {
      const self = await this.selfStaff(user);
      resolvedStaffId = self.id;
    }
    const staff = await this.assertStaffRead(user, resolvedStaffId, 'availability:read:branch');
    if (branchId && branchId !== staff.branchId) await assertBranchAccess(this.prisma, user, branchId);
    return this.prisma.staffAvailability.findMany({
      where: { staffId: resolvedStaffId, branchId: branchId || undefined },
      orderBy: [{ effectiveFrom: 'desc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async replaceAvailability(user: AuthUser, body: ReplaceAvailabilityDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: body.staffId },
      include: { branch: { select: { businessId: true } } },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const own = staff.userId === user.id;
    const context = { tenantId: staff.branch.businessId, branchId: body.branchId };
    if (
      !(own && can(user, 'availability:manage:self', { ownerId: user.id })) &&
      !can(user, 'availability:manage:branch', context) &&
      !can(user, 'availability:manage:tenant', context)
    ) {
      throw new ForbiddenException('Không có quyền cập nhật availability này');
    }
    await assertBranchAccess(this.prisma, user, body.branchId);
    const assignment = await this.prisma.staffBranchAssignment.findFirst({
      where: {
        staffId: body.staffId,
        branchId: body.branchId,
        status: 'ACTIVE',
        startDate: { lte: this.dateOnly(body.effectiveFrom) },
        OR: [{ endDate: null }, { endDate: { gte: this.dateOnly(body.effectiveFrom) } }],
      },
    });
    if (!assignment) throw new BadRequestException('Nhân viên không được phân công tại chi nhánh trong kỳ này');

    const normalized = body.ranges.map((range) => ({
      ...range,
      start: this.timeOnly(range.startTime, 'Giờ bắt đầu'),
      end: this.timeOnly(range.endTime, 'Giờ kết thúc'),
    }));
    for (const range of normalized) {
      if (this.minutesBetween(range.start, range.end) <= 0) {
        throw new BadRequestException('Khoảng availability phải có độ dài lớn hơn 0');
      }
      const siblings = normalized.filter((item) => item.dayOfWeek === range.dayOfWeek);
      for (const sibling of siblings) {
        if (sibling === range) continue;
        const start = range.start.getTime();
        const end = range.end.getTime();
        const otherStart = sibling.start.getTime();
        const otherEnd = sibling.end.getTime();
        if (start < otherEnd && end > otherStart) {
          throw new BadRequestException(`Availability ngày ${range.dayOfWeek} bị chồng lấn`);
        }
      }
    }
    const effectiveFrom = this.dateOnly(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? this.dateOnly(body.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }
    const closeAt = new Date(effectiveFrom.getTime() - DAY_MS);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.staffAvailability.updateMany({
        where: {
          staffId: body.staffId,
          branchId: body.branchId,
          status: 'ACTIVE',
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
        data: { effectiveTo: closeAt },
      });
      return Promise.all(normalized.map((range) => tx.staffAvailability.create({
        data: {
          businessId: staff.branch.businessId,
          branchId: body.branchId,
          staffId: body.staffId,
          dayOfWeek: range.dayOfWeek,
          startTime: range.start,
          endTime: range.end,
          effectiveFrom,
          effectiveTo,
          createdBy: user.id,
        },
      })));
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'UPDATE',
      entityType: 'StaffAvailability',
      entityId: body.staffId,
      newData: { branchId: body.branchId, effectiveFrom, effectiveTo, ranges: body.ranges },
      reason: 'Cập nhật availability có hiệu lực theo thời gian',
    });
    return created;
  }

  private async breakMinutes(
    attendanceId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const events = await client.attendanceEvent.findMany({
      where: { attendanceId, eventType: { in: ['BREAK_START', 'BREAK_END'] } },
      orderBy: { eventAt: 'asc' },
      select: { eventType: true, eventAt: true },
    });
    let open: Date | null = null;
    let total = 0;
    for (const event of events) {
      if (event.eventType === 'BREAK_START' && !open) open = event.eventAt;
      if (event.eventType === 'BREAK_END' && open) {
        total += Math.max(0, Math.round((event.eventAt.getTime() - open.getTime()) / 60_000));
        open = null;
      }
    }
    return total;
  }

  async syncTimesheet(
    attendanceId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const attendance = await client.staffAttendance.findUnique({ where: { id: attendanceId } });
    if (!attendance) throw new NotFoundException('Bản chấm công không tồn tại');
    const existing = await client.timesheet.findUnique({ where: { attendanceId } });
    if (existing && ['APPROVED', 'LOCKED'].includes(existing.status)) return existing;
    const breakMinutes = await this.breakMinutes(attendanceId, client);
    const scheduleSnapshot = attendance.scheduleSnapshot as {
      segments?: Array<{ startTime?: string; endTime?: string; roleCode?: string | null }>;
    } | null;
    const scheduledMinutes = scheduleSnapshot?.segments?.length
      ? scheduleSnapshot.segments.reduce((sum, segment) => {
          const start = new Date(segment.startTime || '');
          const end = new Date(segment.endTime || '');
          return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
            ? sum
            : sum + this.minutesBetween(start, end);
        }, 0)
      : this.minutesBetween(attendance.scheduledStartTime, attendance.scheduledEndTime);
    const rawMinutes = attendance.checkInAt && attendance.checkOutAt
      ? Math.max(0, Math.round((attendance.checkOutAt.getTime() - attendance.checkInAt.getTime()) / 60_000))
      : 0;
    const actualWorkedMinutes = Math.max(0, rawMinutes - breakMinutes);
    return client.timesheet.upsert({
      where: { attendanceId },
      create: {
        attendanceId,
        businessId: attendance.businessId,
        branchId: attendance.branchId,
        staffId: attendance.staffId,
        workDate: attendance.workDate,
        scheduledMinutes,
        actualWorkedMinutes,
        breakMinutes,
      },
      update: {
        scheduledMinutes,
        actualWorkedMinutes,
        breakMinutes,
        generatedAt: new Date(),
        status: 'RAW',
      },
    });
  }

  async generateTimesheets(user: AuthUser, body: GenerateTimesheetsDto) {
    const from = this.dateOnly(body.from, 'Từ ngày');
    const to = this.dateOnly(body.to, 'Đến ngày');
    if (to < from || to.getTime() - from.getTime() > 366 * DAY_MS) {
      throw new BadRequestException('Khoảng tạo bảng công phải từ 0 đến 366 ngày');
    }
    if (body.branchId) await assertBranchAccess(this.prisma, user, body.branchId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const rows = await this.prisma.staffAttendance.findMany({
      where: {
        workDate: { gte: from, lte: to },
        branchId: body.branchId || undefined,
        businessId: businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds },
        OR: [{ checkOutAt: { not: null } }, { status: 'ABSENT' }],
      },
      select: { id: true },
      orderBy: { workDate: 'asc' },
    });
    const result: any[] = [];
    for (const row of rows) result.push(await this.syncTimesheet(row.id));
    return { generated: result.length, timesheets: result };
  }

  async listTimesheets(
    user: AuthUser,
    query: { from?: string; to?: string; branchId?: string; staffId?: string; status?: string },
  ) {
    let staffId = query.staffId;
    const selfOnly =
      can(user, 'timesheet:read:self') &&
      !can(user, 'timesheet:read:branch') &&
      !can(user, 'timesheet:read:tenant');
    if (selfOnly || (!staffId && user.roles.includes('STAFF'))) {
      staffId = (await this.selfStaff(user)).id;
    }
    if (query.branchId) await assertBranchAccess(this.prisma, user, query.branchId);
    if (staffId) await this.assertStaffRead(user, staffId, 'timesheet:read:branch');
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.timesheet.findMany({
      where: {
        staffId,
        branchId: query.branchId || undefined,
        businessId: businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds },
        workDate: {
          gte: query.from ? this.dateOnly(query.from) : undefined,
          lte: query.to ? this.dateOnly(query.to) : undefined,
        },
        status: query.status as any || undefined,
      },
      include: {
        staff: { select: { id: true, fullName: true, position: true, userId: true } },
        branch: { select: { id: true, name: true } },
        adjustments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ workDate: 'desc' }, { staffId: 'asc' }],
      take: 1000,
    });
  }

  async approveTimesheet(
    user: AuthUser,
    id: string,
    body: ApproveTimesheetDto,
  ) {
    const existing = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bảng công không tồn tại');
    await assertBranchAccess(this.prisma, user, existing.branchId);
    if (existing.status === 'LOCKED') {
      throw new ConflictException('Bảng công đã khóa trong kỳ thu nhập');
    }
    const approvedBreakdown = body.approvedRoleMinutes || undefined;
    if (approvedBreakdown) {
      const values = Object.values(approvedBreakdown);
      if (
        values.some((value) => !Number.isInteger(value) || value < 0 || value > 1_440) ||
        values.reduce((sum, value) => sum + value, 0) !== body.approvedPaidMinutes
      ) {
        throw new BadRequestException('Phân bổ phút theo vai trò phải hợp lệ và bằng tổng phút được duyệt');
      }
    }
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        approvedPaidMinutes: body.approvedPaidMinutes,
        approvedBreakdown: approvedBreakdown as Prisma.InputJsonValue | undefined,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'STATUS_CHANGE',
      entityType: 'Timesheet',
      entityId: id,
      oldData: existing,
      newData: updated,
      reason: body.reason,
    });
    return updated;
  }

  async createTimesheetAdjustment(
    user: AuthUser,
    id: string,
    body: CreateTimesheetAdjustmentDto,
  ) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: { staff: { select: { userId: true } } },
    });
    if (!timesheet) throw new NotFoundException('Bảng công không tồn tại');
    const own = timesheet.staff.userId === user.id;
    if (!own) await assertBranchAccess(this.prisma, user, timesheet.branchId);
    if (timesheet.status === 'LOCKED') {
      throw new ConflictException('Kỳ công đã khóa; điều chỉnh phải đưa vào kỳ sau');
    }
    const allowed = new Set(['actualWorkedMinutes', 'breakMinutes', 'approvedPaidMinutes']);
    const next = Object.fromEntries(
      Object.entries(body.newData).filter(([key]) => allowed.has(key)),
    );
    if (!Object.keys(next).length) throw new BadRequestException('Không có trường điều chỉnh hợp lệ');
    for (const value of Object.values(next)) {
      if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1_440) {
        throw new BadRequestException('Số phút điều chỉnh không hợp lệ');
      }
    }
    return this.prisma.timesheetAdjustment.create({
      data: {
        timesheetId: id,
        proposedBy: user.id,
        reason: body.reason.trim(),
        oldData: {
          actualWorkedMinutes: timesheet.actualWorkedMinutes,
          breakMinutes: timesheet.breakMinutes,
          approvedPaidMinutes: timesheet.approvedPaidMinutes,
        },
        newData: next as Prisma.InputJsonValue,
      },
    });
  }

  async reviewTimesheetAdjustment(
    user: AuthUser,
    id: string,
    body: ReviewTimesheetAdjustmentDto,
  ) {
    const adjustment = await this.prisma.timesheetAdjustment.findUnique({
      where: { id },
      include: { timesheet: true },
    });
    if (!adjustment) throw new NotFoundException('Yêu cầu điều chỉnh không tồn tại');
    await assertBranchAccess(this.prisma, user, adjustment.timesheet.branchId);
    if (adjustment.proposedBy === user.id) {
      throw new ForbiddenException('Người đề nghị không được tự duyệt điều chỉnh');
    }
    if (adjustment.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu điều chỉnh đã được xử lý');
    }
    if (adjustment.timesheet.status === 'LOCKED') {
      throw new ConflictException('Kỳ công đã khóa');
    }
    return this.prisma.$transaction(async (tx) => {
      if (body.action === 'APPROVE') {
        await tx.timesheet.update({
          where: { id: adjustment.timesheetId },
          data: { ...(adjustment.newData as Record<string, number>), status: 'RAW' },
        });
      }
      return tx.timesheetAdjustment.update({
        where: { id },
        data: {
          status: body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewReason: body.reason,
        },
      });
    });
  }

  async createCompensationRule(user: AuthUser, body: CreateCompensationRuleDto) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    if (body.branchId) {
      const businessId = await assertBranchAccess(this.prisma, user, body.branchId);
      if (businessId !== body.businessId) throw new BadRequestException('Chi nhánh không thuộc doanh nghiệp');
    }
    if (body.rate == null && body.fixedAmount == null) {
      throw new BadRequestException('Quy tắc cần rate hoặc fixedAmount');
    }
    if (body.type === 'SERVICE_COMMISSION' && Number(body.rate) > 100) {
      throw new BadRequestException('Tỷ lệ hoa hồng không được vượt quá 100%');
    }
    const effectiveFrom = this.dateOnly(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? this.dateOnly(body.effectiveTo) : null;
    const latest = await this.prisma.compensationRule.findFirst({
      where: { businessId: body.businessId, branchId: body.branchId || null, name: body.name },
      orderBy: { version: 'desc' },
    });
    if (latest?.status === 'ACTIVE' && (!latest.effectiveTo || latest.effectiveTo >= effectiveFrom)) {
      await this.prisma.compensationRule.update({
        where: { id: latest.id },
        data: { effectiveTo: new Date(effectiveFrom.getTime() - DAY_MS), status: 'ARCHIVED' },
      });
    }
    return this.prisma.compensationRule.create({
      data: {
        businessId: body.businessId,
        branchId: body.branchId || null,
        name: body.name.trim(),
        type: body.type as CompensationRuleType,
        version: (latest?.version || 0) + 1,
        calculationBasis: body.calculationBasis as any,
        rate: body.rate,
        fixedAmount: body.fixedAmount,
        effectiveFrom,
        effectiveTo,
        createdBy: user.id,
      },
    });
  }

  async assignCompensationRule(
    user: AuthUser,
    ruleId: string,
    body: AssignCompensationRuleDto,
  ) {
    const rule = await this.prisma.compensationRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Quy tắc thu nhập không tồn tại');
    await assertBusinessAccess(this.prisma, user, rule.businessId);
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: body.staffId } });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const branchBusinessId = await assertBranchAccess(this.prisma, user, body.branchId);
    if (branchBusinessId !== rule.businessId) throw new BadRequestException('Sai phạm vi doanh nghiệp');
    return this.prisma.compensationAssignment.create({
      data: {
        ruleId,
        staffId: body.staffId,
        branchId: body.branchId,
        roleCode: body.roleCode as any || null,
        effectiveFrom: this.dateOnly(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? this.dateOnly(body.effectiveTo) : null,
      },
    });
  }

  private entryType(ruleType: CompensationRuleType): CompensationEntryType {
    return ruleType === 'HOURLY_WAGE' ? 'HOURLY_WAGE'
      : ruleType === 'FIXED_COMPONENT' ? 'FIXED_COMPONENT'
      : ruleType === 'SERVICE_COMMISSION' ? 'SERVICE_COMMISSION'
      : ruleType === 'PRODUCT_COMMISSION' ? 'PRODUCT_COMMISSION'
      : ruleType === 'BONUS' ? 'BONUS'
      : ruleType === 'ALLOWANCE' ? 'ALLOWANCE'
      : 'DEDUCTION';
  }

  async calculateCompensation(user: AuthUser, body: CalculateCompensationDto) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    const from = this.dateOnly(body.from);
    const to = this.dateOnly(body.to);
    if (to < from) throw new BadRequestException('Khoảng tính thu nhập không hợp lệ');
    const assignments = await this.prisma.compensationAssignment.findMany({
      where: {
        rule: {
          businessId: body.businessId,
          status: { in: ['ACTIVE', 'ARCHIVED'] },
          effectiveFrom: { lte: to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      include: { rule: true },
    });
    let created = 0;
    for (const assignment of assignments) {
      const rule = assignment.rule;
      const effectiveFrom = [from, assignment.effectiveFrom, rule.effectiveFrom]
        .reduce((latest, value) => value > latest ? value : latest);
      const endCandidates = [to, assignment.effectiveTo, rule.effectiveTo]
        .filter((value): value is Date => Boolean(value));
      const effectiveTo = endCandidates.reduce(
        (earliest, value) => value < earliest ? value : earliest,
        to,
      );
      if (effectiveTo < effectiveFrom) continue;
      if (rule.type === 'HOURLY_WAGE') {
        const timesheets = await this.prisma.timesheet.findMany({
          where: {
            staffId: assignment.staffId,
            branchId: assignment.branchId,
            status: { in: ['APPROVED', 'LOCKED'] },
            workDate: {
              gte: effectiveFrom,
              lte: effectiveTo,
            },
          },
          include: { attendance: true },
        });
        for (const timesheet of timesheets) {
          let paidMinutes = timesheet.approvedPaidMinutes || 0;
          if (assignment.roleCode) {
            const approvedBreakdown = timesheet.approvedBreakdown as Record<string, number> | null;
            if (approvedBreakdown && approvedBreakdown[assignment.roleCode] != null) {
              paidMinutes = Number(approvedBreakdown[assignment.roleCode]);
            } else {
              const snapshot = timesheet.attendance.scheduleSnapshot as {
                segments?: Array<{ startTime?: string; endTime?: string; roleCode?: string | null }>;
              } | null;
              const segments = snapshot?.segments || [];
              const segmentMinutes = (segment: { startTime?: string; endTime?: string }) => {
                const start = new Date(segment.startTime || '');
                const end = new Date(segment.endTime || '');
                return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                  ? 0
                  : this.minutesBetween(start, end);
              };
              const totalScheduled = segments.reduce((sum, segment) => sum + segmentMinutes(segment), 0);
              const roleScheduled = segments
                .filter((segment) => segment.roleCode === assignment.roleCode)
                .reduce((sum, segment) => sum + segmentMinutes(segment), 0);
              if (!roleScheduled || !totalScheduled) continue;
              paidMinutes = Math.round(paidMinutes * roleScheduled / totalScheduled);
            }
          }
          if (paidMinutes <= 0) continue;
          const amount = Number(((Number(rule.rate || 0) * paidMinutes) / 60).toFixed(2));
          await this.prisma.compensationEntry.upsert({
            where: { dedupeKey: `TIMESHEET:${timesheet.id}:RULE:${rule.id}:V${rule.version}` },
            update: {},
            create: {
              businessId: body.businessId,
              branchId: assignment.branchId,
              staffId: assignment.staffId,
              timesheetId: timesheet.id,
              ruleId: rule.id,
              type: 'HOURLY_WAGE',
              amount,
              calculationBasis: 'APPROVED_PAID_TIME',
              calculationSnapshot: {
                ruleVersion: rule.version,
                rate: Number(rule.rate || 0),
                approvedPaidMinutes: paidMinutes,
                roleCode: assignment.roleCode,
              },
              sourceType: 'TIMESHEET',
              sourceId: timesheet.id,
              dedupeKey: `TIMESHEET:${timesheet.id}:RULE:${rule.id}:V${rule.version}`,
              earnedAt: timesheet.workDate,
            },
          });
          created += 1;
        }
      }
      if (rule.type === 'SERVICE_COMMISSION') {
        const services = await this.prisma.bookingService.findMany({
          where: {
            staffId: assignment.staffId,
            booking: {
              branchId: assignment.branchId,
              status: 'COMPLETED',
              appointmentDate: { gte: effectiveFrom, lte: effectiveTo },
              OR: [
                { paymentTransactions: { some: { status: 'VERIFIED' } } },
                { payments: { some: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } } },
              ],
            },
            status: 'COMPLETED',
          },
          include: { booking: true },
        });
        for (const service of services) {
          const gross = Number(service.priceAtBooking);
          const bookingTotal = Math.max(0.01, Number(service.booking.totalAmount));
          const finalTotal = Number(service.booking.finalAmount ?? service.booking.totalAmount);
          const basis = ['AFTER_DISCOUNT', 'AFTER_VOUCHER', 'AFTER_REFUND'].includes(rule.calculationBasis)
            ? gross * (finalTotal / bookingTotal)
            : gross;
          const amount = Number((basis * Number(rule.rate || 0) / 100).toFixed(2));
          const dedupeKey = `BOOKING_SERVICE:${service.id}:RULE:${rule.id}:V${rule.version}`;
          await this.prisma.compensationEntry.upsert({
            where: { dedupeKey },
            update: {},
            create: {
              businessId: body.businessId,
              branchId: assignment.branchId,
              staffId: assignment.staffId,
              bookingServiceId: service.id,
              ruleId: rule.id,
              type: 'SERVICE_COMMISSION',
              amount,
              calculationBasis: rule.calculationBasis,
              calculationSnapshot: {
                ruleVersion: rule.version,
                rate: Number(rule.rate || 0),
                grossServiceAmount: gross,
                bookingFinalAmount: finalTotal,
                basis,
              },
              sourceType: 'BOOKING_SERVICE',
              sourceId: service.id,
              dedupeKey,
              earnedAt: service.booking.appointmentDate,
            },
          });
          created += 1;
        }
      }
    }
    return { evaluatedAssignments: assignments.length, entriesProcessed: created };
  }

  async recordRefundAdjustments(
    refundId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const refund = await client.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            booking: { include: { bookingServices: true } },
          },
        },
      },
    });
    if (!refund || refund.status !== 'REFUNDED') return [];
    const serviceIds = refund.payment.booking.bookingServices.map((item) => item.id);
    const originals = await client.compensationEntry.findMany({
      where: {
        bookingServiceId: { in: serviceIds },
        type: 'SERVICE_COMMISSION',
        status: { in: ['EARNED', 'INCLUDED_IN_PAY_RUN', 'LOCKED'] },
      },
    });
    const ratio = Math.min(1, Number(refund.amount) / Math.max(0.01, Number(refund.payment.amount)));
    const results: any[] = [];
    for (const original of originals) {
      const dedupeKey = `REFUND:${refund.id}:COMPENSATION:${original.id}`;
      const amount = -Math.abs(Number((Number(original.amount) * ratio).toFixed(2)));
      const resulting = await client.compensationEntry.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          businessId: original.businessId,
          branchId: original.branchId,
          staffId: original.staffId,
          bookingServiceId: original.bookingServiceId,
          ruleId: original.ruleId,
          originalEntryId: original.id,
          type: 'ADJUSTMENT',
          amount,
          calculationBasis: 'REFUND_REVERSAL',
          calculationSnapshot: {
            refundId: refund.id,
            originalEntryId: original.id,
            refundRatio: ratio,
          },
          sourceType: 'REFUND',
          sourceId: refund.id,
          dedupeKey,
          earnedAt: refund.processedAt || new Date(),
        },
      });
      await client.compensationAdjustment.upsert({
        where: { resultingEntryId: resulting.id },
        update: {},
        create: {
          originalEntryId: original.id,
          resultingEntryId: resulting.id,
          refundId: refund.id,
          reason: refund.reason,
          actorId: refund.processedBy || refund.reviewedBy || refund.requestedBy,
        },
      });
      results.push(resulting);
    }
    return results;
  }

  async listCompensation(
    user: AuthUser,
    query: { businessId?: string; staffId?: string; from?: string; to?: string },
  ) {
    let staffId = query.staffId;
    if (!can(user, 'compensation:read:tenant')) {
      const self = await this.selfStaff(user);
      staffId = self.id;
    }
    if (query.businessId) await assertBusinessAccess(this.prisma, user, query.businessId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.compensationEntry.findMany({
      where: {
        staffId,
        businessId: query.businessId
          ? query.businessId
          : businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds },
        earnedAt: {
          gte: query.from ? this.dateOnly(query.from) : undefined,
          lte: query.to ? new Date(this.dateOnly(query.to).getTime() + DAY_MS - 1) : undefined,
        },
      },
      include: {
        staff: { select: { id: true, fullName: true, position: true } },
        branch: { select: { id: true, name: true } },
        rule: { select: { id: true, name: true, version: true, type: true } },
      },
      orderBy: { earnedAt: 'desc' },
      take: 2000,
    });
  }

  async createPayRun(user: AuthUser, body: CreatePayRunDto) {
    await assertBusinessAccess(this.prisma, user, body.businessId);
    const periodStart = this.dateOnly(body.periodStart);
    const periodEnd = this.dateOnly(body.periodEnd);
    if (periodEnd < periodStart) throw new BadRequestException('Kỳ thu nhập không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.payRun.findUnique({
        where: { businessId_periodStart_periodEnd: { businessId: body.businessId, periodStart, periodEnd } },
      });
      if (existing) return existing;
      const entries = await tx.compensationEntry.findMany({
        where: {
          businessId: body.businessId,
          status: 'EARNED',
          payRunItemId: null,
          earnedAt: { gte: periodStart, lt: new Date(periodEnd.getTime() + DAY_MS) },
        },
      });
      const byStaff = new Map<string, typeof entries>();
      for (const entry of entries) {
        const rows = byStaff.get(entry.staffId) || [];
        rows.push(entry);
        byStaff.set(entry.staffId, rows);
      }
      const gross = entries.filter((item) => Number(item.amount) >= 0).reduce((sum, item) => sum + Number(item.amount), 0);
      const deductions = Math.abs(entries.filter((item) => item.type === 'DEDUCTION').reduce((sum, item) => sum + Number(item.amount), 0));
      const adjustments = entries.filter((item) => item.type === 'ADJUSTMENT').reduce((sum, item) => sum + Number(item.amount), 0);
      const payRun = await tx.payRun.create({
        data: {
          businessId: body.businessId,
          periodStart,
          periodEnd,
          grossAmount: gross,
          adjustmentAmount: adjustments,
          deductionAmount: deductions,
          netAmount: entries.reduce((sum, item) => sum + Number(item.amount), 0),
          createdBy: user.id,
        },
      });
      for (const [staffId, staffEntries] of byStaff) {
        const itemGross = staffEntries.filter((entry) => Number(entry.amount) >= 0).reduce((sum, entry) => sum + Number(entry.amount), 0);
        const itemAdjust = staffEntries.filter((entry) => entry.type === 'ADJUSTMENT').reduce((sum, entry) => sum + Number(entry.amount), 0);
        const itemDeduct = Math.abs(staffEntries.filter((entry) => entry.type === 'DEDUCTION').reduce((sum, entry) => sum + Number(entry.amount), 0));
        const item = await tx.payRunItem.create({
          data: {
            payRunId: payRun.id,
            staffId,
            grossAmount: itemGross,
            adjustmentAmount: itemAdjust,
            deductionAmount: itemDeduct,
            netAmount: staffEntries.reduce((sum, entry) => sum + Number(entry.amount), 0),
          },
        });
        await tx.compensationEntry.updateMany({
          where: { id: { in: staffEntries.map((entry) => entry.id) }, status: 'EARNED' },
          data: { payRunItemId: item.id, status: 'INCLUDED_IN_PAY_RUN' },
        });
      }
      return tx.payRun.findUnique({
        where: { id: payRun.id },
        include: { items: { include: { staff: { select: { fullName: true } } } } },
      });
    });
  }

  async listPayRuns(user: AuthUser, businessId?: string) {
    if (!can(user, 'pay_run:manage:tenant')) {
      const self = await this.selfStaff(user);
      return this.prisma.payRun.findMany({
        where: { items: { some: { staffId: self.id } } },
        include: {
          items: {
            where: { staffId: self.id },
            include: { compensationEntries: { orderBy: { earnedAt: 'asc' } } },
          },
        },
        orderBy: { periodStart: 'desc' },
      });
    }
    if (businessId) await assertBusinessAccess(this.prisma, user, businessId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    return this.prisma.payRun.findMany({
      where: {
        businessId: businessId || (businessIds.includes(ALL_TENANTS) ? undefined : { in: businessIds }),
      },
      include: {
        items: { include: { staff: { select: { id: true, fullName: true, position: true } } } },
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  async transitionPayRun(
    user: AuthUser,
    id: string,
    body: TransitionPayRunDto,
  ) {
    const existing = await this.prisma.payRun.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kỳ thu nhập không tồn tại');
    await assertBusinessAccess(this.prisma, user, existing.businessId);
    const transitions: Record<PayRunStatus, PayRunStatus[]> = {
      DRAFT: ['REVIEW'],
      REVIEW: ['APPROVED'],
      APPROVED: ['LOCKED'],
      LOCKED: ['EXPORTED', 'MARKED_PAID'],
      EXPORTED: ['MARKED_PAID'],
      MARKED_PAID: [],
    };
    if (!transitions[existing.status].includes(body.status)) {
      throw new ConflictException(`Không thể chuyển ${existing.status} → ${body.status}`);
    }
    if (['EXPORTED', 'MARKED_PAID'].includes(body.status) && !body.externalReference?.trim()) {
      throw new BadRequestException('Cần mã tham chiếu xử lý bên ngoài');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.payRun.updateMany({
        where: { id, status: existing.status },
        data: {
          status: body.status,
          approvedBy: body.status === 'APPROVED' ? user.id : undefined,
          approvedAt: body.status === 'APPROVED' ? new Date() : undefined,
          lockedAt: body.status === 'LOCKED' ? new Date() : undefined,
          markedPaidAt: body.status === 'MARKED_PAID' ? new Date() : undefined,
          markedPaidBy: body.status === 'MARKED_PAID' ? user.id : undefined,
          exportReference: body.externalReference?.trim() || undefined,
        },
      });
      if (changed.count !== 1) throw new ConflictException('Kỳ thu nhập vừa thay đổi, vui lòng tải lại');
      await tx.payRunItem.updateMany({ where: { payRunId: id }, data: { status: body.status } });
      if (body.status === 'LOCKED') {
        await tx.compensationEntry.updateMany({
          where: { payRunItem: { payRunId: id } },
          data: { status: 'LOCKED' },
        });
        const timesheetIds = await tx.compensationEntry.findMany({
          where: { payRunItem: { payRunId: id }, timesheetId: { not: null } },
          select: { timesheetId: true },
          distinct: ['timesheetId'],
        });
        await tx.timesheet.updateMany({
          where: { id: { in: timesheetIds.flatMap((item) => item.timesheetId || []) } },
          data: { status: 'LOCKED', lockedAt: new Date() },
        });
      }
      return tx.payRun.findUnique({ where: { id }, include: { items: true } });
    });
    await auditLog(this.prisma, {
      userId: user.id,
      action: 'STATUS_CHANGE',
      entityType: 'PayRun',
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: body.status, externalReference: body.externalReference },
      reason: body.reason,
    });
    return updated;
  }
}
