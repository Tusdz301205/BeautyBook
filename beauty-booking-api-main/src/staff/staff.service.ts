import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBusinessAccess,
  resolveBusinessIdsForUser,
  resolveBranchIdsForUser,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { bookableStaffWhere, professionalTitle, staffRating } from './bookable-staff';
import { TokenBlacklistService } from '../auth/token-blacklist.service';

function impactedConflicts(
  bookings: Array<{ id: string; bookingId: string; startAt: string; endAt: string }>,
) {
  const conflicts: Array<{ firstBookingId: string; secondBookingId: string }> = [];
  const sorted = [...bookings].sort((left, right) => left.startAt.localeCompare(right.startAt));
  for (let index = 0; index < sorted.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
      const current = sorted[index];
      const next = sorted[nextIndex];
      if (new Date(next.startAt) >= new Date(current.endAt)) break;
      if (current.bookingId !== next.bookingId) {
        conflicts.push({
          firstBookingId: current.bookingId,
          secondBookingId: next.bookingId,
        });
      }
    }
  }
  return conflicts;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  private timeMinutes(value: string): number {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException(`Giờ không hợp lệ: ${value}`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new BadRequestException(`Giờ không hợp lệ: ${value}`);
    return hour * 60 + minute;
  }

  private assertTimeRange(startTime: string, endTime: string) {
    if (this.timeMinutes(startTime) >= this.timeMinutes(endTime)) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }
  }

  // ============================================================
  // STAFF CRUD
  // ============================================================

  /**
   * Lấy danh sách nhân viên theo chi nhánh/tenant.
   * - Branch-scoped roles: chỉ thấy staff cùng chi nhánh.
   * - Tenant-wide roles (Owner): thấy tất cả chi nhánh.
   * - Platform roles: thấy cross-tenant.
   */
  async findAll(user: AuthUser, branchId?: string) {
    const allowedIds = await resolveBusinessIdsForUser(this.prisma, user);
    const where: any = { deletedAt: null };

    if (branchId) {
      where.branchId = branchId;
    } else if (!allowedIds.includes(ALL_TENANTS)) {
      // Non-platform user without explicit branchId → restrict to their branches
      const scopedBranchIds = (await Promise.all(
        allowedIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
      )).flatMap((ids) => ids ?? []);
      where.branchId = { in: [...new Set(scopedBranchIds)] };
    }

    const staff = await this.prisma.staffProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarMedia: { select: { url: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            business: { select: { id: true, name: true } },
          },
        },
        images: {
          include: { media: { select: { id: true, url: true, originalName: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        staffServices: {
          include: {
            service: { select: { id: true, name: true, price: true } },
          },
        },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      fullName: s.fullName,
      position: s.position,
      bio: s.bio,
      status: s.status,
      publicVisible: s.publicVisible,
      isBookable: s.isBookable,
      hiredAt: s.hiredAt,
      branch: s.branch
        ? { id: s.branch.id, name: s.branch.name, businessId: s.branch.business?.id, businessName: s.branch.business?.name }
        : null,
      images: s.images,
      user: s.user
        ? {
            id: s.user.id,
            fullName: s.user.fullName,
            email: s.user.email,
            phone: s.user.phone,
            avatar: s.user.avatarMedia?.url ?? null,
          }
        : null,
      services: s.staffServices.map((ss) => ({
        id: ss.service.id,
        name: ss.service.name,
        price: Number(ss.service.price),
      })),
      workingHours: s.workingHours.map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.startTime,
        endTime: wh.endTime,
        isOff: wh.isOff,
      })),
    }));
  }

  async findPublic(branchId: string, serviceIds: string[] = []) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    const staff = await this.prisma.staffProfile.findMany({
      where: bookableStaffWhere({ branchId, publicOnly: true, requireSchedule: true, serviceIds }),
      select: {
        id: true, fullName: true, position: true, bio: true, experienceYears: true,
        user: { select: { avatarMedia: { select: { url: true } } } },
        images: { select: { media: { select: { url: true } } }, orderBy: { sortOrder: 'asc' }, take: 1 },
        staffServices: {
          ...(serviceIds.length ? { where: { serviceId: { in: serviceIds } } } : {}),
          select: { serviceId: true, service: { select: { id: true, name: true } } },
        },
        reviewRatings: {
          where: { review: { status: 'APPROVED', deletedAt: null } },
          select: { rating: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    const requiredCount = new Set(serviceIds).size;
    return staff
      .filter((item) => !requiredCount || new Set(item.staffServices.map((entry) => entry.serviceId)).size === requiredCount)
      .map(({ user, images, reviewRatings, position, ...item }) => ({
        ...item,
        professionalTitle: professionalTitle(position),
        specialties: item.staffServices.map((entry) => entry.service.name),
        avatarUrl: user?.avatarMedia?.url || images[0]?.media?.url || null,
        ...staffRating(reviewRatings),
      }));
  }

  async findPublicOne(id: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id,
        ...bookableStaffWhere({ publicOnly: true, requireSchedule: true }),
        branch: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true, fullName: true, position: true, bio: true, experienceYears: true,
        branch: { select: { id: true, name: true, addressLine: true, business: { select: { name: true } } } },
        user: { select: { avatarMedia: { select: { url: true } } } },
        staffServices: {
          where: { service: { status: 'ACTIVE', deletedAt: null } },
          select: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } },
        },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        images: { select: { media: { select: { url: true } } }, orderBy: { sortOrder: 'asc' } },
        reviewRatings: {
          where: { review: { status: 'APPROVED', deletedAt: null } },
          select: { rating: true },
        },
      },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại hoặc không nhận lịch');
    const { user, position, reviewRatings, ...profile } = staff;
    return {
      ...profile,
      professionalTitle: professionalTitle(position),
      specialties: profile.staffServices.map((entry) => entry.service.name),
      avatarUrl: user?.avatarMedia?.url || profile.images[0]?.media?.url || null,
      ...staffRating(reviewRatings),
    };
  }

  /**
   * Lấy chi tiết nhân viên.
   */
  async findOne(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarMedia: { select: { url: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            business: { select: { id: true, name: true } },
          },
        },
        staffServices: {
          include: {
            service: { select: { id: true, name: true, price: true, durationMinutes: true } },
          },
        },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        images: {
          include: { media: { select: { url: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        invitations: {
          select: {
            id: true,
            email: true,
            roleCode: true,
            status: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        branchAssignments: {
          include: { branch: { select: { id: true, name: true } } },
          orderBy: { startDate: 'desc' },
        },
        scheduleVersions: { orderBy: { version: 'desc' }, take: 10 },
        timesheets: { orderBy: { workDate: 'desc' }, take: 31 },
        compensationAssignments: {
          include: { rule: true },
          orderBy: { effectiveFrom: 'desc' },
        },
        payRunItems: {
          include: {
            payRun: { select: { id: true, status: true, periodStart: true, periodEnd: true } },
          },
          orderBy: { payRun: { periodStart: 'desc' } },
          take: 12,
        },
      },
    });

    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const [futureBookings, auditTrail] = await Promise.all([
      this.prisma.bookingService.findMany({
        where: {
          staffId: id,
          booking: {
            appointmentDate: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            deletedAt: null,
          },
        },
        select: {
          id: true,
          serviceNameSnapshot: true,
          itemStartAt: true,
          itemEndAt: true,
          booking: {
            select: { id: true, bookingCode: true, appointmentDate: true, status: true, branchId: true },
          },
        },
        orderBy: { booking: { appointmentDate: 'asc' } },
        take: 50,
      }),
      this.prisma.auditLog.findMany({
        where: { entityId: id },
        select: {
          id: true,
          action: true,
          entityType: true,
          reason: true,
          oldData: true,
          newData: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { ...staff, futureBookings, auditTrail };
  }

  async findMine(userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        position: true,
        status: true,
        isBookable: true,
        branch: { select: { id: true, name: true, businessId: true } },
      },
    });
    if (!staff) throw new NotFoundException('Tài khoản chưa được liên kết hồ sơ nhân viên');
    return staff;
  }

  /**
   * Tạo nhân viên mới (gán vào chi nhánh).
   * - Nếu userId được cung cấp → liên kết user hiện có.
   * - Nếu không → tạo StaffProfile mà không liên kết user (cho phép liên kết sau).
   */
  async create(data: {
    branchId: string;
    fullName: string;
    position?: string;
    bio?: string;
    userId?: string;
    hiredAt?: string;
    publicVisible?: boolean;
    isBookable?: boolean;
  }) {
    // Validate branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');

    // If userId provided, check not already staff
    if (data.userId) {
      const existing = await this.prisma.staffProfile.findUnique({
        where: { userId: data.userId },
      });
      if (existing) {
        throw new BadRequestException('User này đã là nhân viên');
      }
    }

    return this.prisma.staffProfile.create({
      data: {
        branchId: data.branchId,
        fullName: data.fullName,
        position: data.position ?? null,
        bio: data.bio ?? null,
        userId: data.userId ?? null,
        hiredAt: data.hiredAt ? new Date(data.hiredAt) : null,
        status: data.userId ? 'ACTIVE' : 'PROFILE_ONLY',
        publicVisible: data.userId ? Boolean(data.publicVisible) : false,
        isBookable: data.userId ? Boolean(data.isBookable) : false,
        branchAssignments: {
          create: {
            branchId: data.branchId,
            startDate: data.hiredAt ? new Date(data.hiredAt) : new Date(),
            jobTitle: data.position ?? null,
            isPrimary: true,
            isBookable: data.userId ? Boolean(data.isBookable) : false,
          },
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Cập nhật hồ sơ nhân viên.
   */
  async update(
    id: string,
    data: {
      fullName?: string;
      position?: string;
      bio?: string;
      status?: 'PROFILE_ONLY' | 'INVITED' | 'ACTIVE' | 'LOCKED' | 'INACTIVE' | 'ON_LEAVE';
      publicVisible?: boolean;
      isBookable?: boolean;
    },
  ) {
    await this.assertExists(id);
    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.publicVisible !== undefined && { publicVisible: data.publicVisible }),
        ...(data.isBookable !== undefined && { isBookable: data.isBookable }),
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async assignBranch(
    staffId: string,
    input: {
      branchId: string;
      startDate: string;
      endDate?: string;
      jobTitle?: string;
      isPrimary?: boolean;
      isBookable?: boolean;
    },
  ) {
    const [staff, target] = await Promise.all([
      this.prisma.staffProfile.findFirst({
        where: { id: staffId, deletedAt: null },
        select: { id: true, branch: { select: { businessId: true } } },
      }),
      this.prisma.branch.findFirst({
        where: { id: input.branchId, deletedAt: null },
        select: { id: true, businessId: true },
      }),
    ]);
    if (!staff || !target) throw new NotFoundException('Nhân viên hoặc chi nhánh không tồn tại');
    if (staff.branch.businessId !== target.businessId) {
      throw new ForbiddenException('Không thể gán nhân viên sang doanh nghiệp khác');
    }
    const startDate = this.dateOnly(input.startDate);
    const endDate = input.endDate ? this.dateOnly(input.endDate) : null;
    if (endDate && endDate < startDate) throw new BadRequestException('Ngày kết thúc không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.staffBranchAssignment.updateMany({
          where: { staffId, isPrimary: true, status: 'ACTIVE' },
          data: { isPrimary: false },
        });
        await tx.staffProfile.update({
          where: { id: staffId },
          data: { branchId: input.branchId },
        });
      }
      return tx.staffBranchAssignment.upsert({
        where: {
          staffId_branchId_startDate: {
            staffId,
            branchId: input.branchId,
            startDate,
          },
        },
        create: {
          staffId,
          branchId: input.branchId,
          startDate,
          endDate,
          jobTitle: input.jobTitle?.trim() || null,
          isPrimary: Boolean(input.isPrimary),
          isBookable: Boolean(input.isBookable),
        },
        update: {
          endDate,
          status: 'ACTIVE',
          jobTitle: input.jobTitle?.trim() || null,
          isPrimary: Boolean(input.isPrimary),
          isBookable: Boolean(input.isBookable),
        },
      });
    });
  }

  /**
   * Khóa nhân viên (soft deactivate).
   * Tạm ngưng nhận lịch → status INACTIVE nhưng vẫn giữ hồ sơ để quản lý.
   */
  async offboardingImpact(id: string) {
    await this.assertExists(id);
    const assignedBookings = await this.prisma.bookingService.findMany({
      where: {
        staffId: id,
        booking: {
          appointmentDate: { gte: new Date() },
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          deletedAt: null,
        },
      },
      select: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            appointmentDate: true,
            status: true,
            branchId: true,
          },
        },
      },
      orderBy: { booking: { appointmentDate: 'asc' } },
    });
    const bookings = [
      ...new Map(assignedBookings.map((item) => [item.booking.id, item.booking])).values(),
    ];
    return {
      futureBookingCount: bookings.length,
      requiresReassignment: bookings.length > 0,
      bookings,
    };
  }

  async deactivate(id: string, input: { reason: string }, actorId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        branchId: true,
        branch: { select: { businessId: true } },
      },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');

    if (!input.reason?.trim()) throw new BadRequestException('Lý do ngừng làm việc là bắt buộc');
    const impact = await this.offboardingImpact(id);
    if (impact.requiresReassignment) {
      const completed = await this.prisma.operationalImpactCase.findFirst({
        where: { subjectType: 'STAFF', subjectId: id, action: 'OFFBOARD', status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });
      if (!completed) {
        const existing = await this.prisma.operationalImpactCase.findFirst({
          where: { subjectType: 'STAFF', subjectId: id, action: 'OFFBOARD', status: { in: ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'] } },
        });
        const impactCase = existing ?? await this.prisma.operationalImpactCase.create({ data: {
          businessId: staff.branch.businessId,
          branchId: staff.branchId,
          subjectType: 'STAFF',
          subjectId: id,
          action: 'OFFBOARD',
          reason: input.reason.trim(),
          ownerId: actorId,
          createdBy: actorId,
          deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        } });
        if (!existing) await this.prisma.operationalImpactItem.createMany({
          data: impact.bookings.map((booking) => ({ caseId: impactCase.id, bookingId: booking.id })),
          skipDuplicates: true,
        });
        return { deactivated: false, requiresImpactResolution: true, impactCase, impact };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.staffProfile.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          isBookable: false,
          publicVisible: false,
          deletedAt: null,
        },
      });
      await tx.staffBranchAssignment.updateMany({
        where: { staffId: staff.id, status: 'ACTIVE' },
        data: { status: 'ENDED', endDate: new Date() },
      });
      await tx.staffInvitation.updateMany({
        where: { staffProfileId: staff.id, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (staff.userId) {
        await tx.userRole.deleteMany({
          where: {
            userId: staff.userId,
            businessId: staff.branch.businessId,
            role: { code: { in: ['BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'] } },
          },
        });
        await tx.userSession.updateMany({
          where: {
            userId: staff.userId,
            workspace: 'SALON',
            businessId: staff.branch.businessId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      return profile;
    });
    return { ...updated, deactivated: true, impact, reason: input.reason.trim() };
  }

  // ============================================================
  // WORKING HOURS
  // ============================================================

  /**
   * Lấy lịch làm việc của nhân viên.
   */
  async getWorkingHours(staffId: string) {
    await this.assertExists(staffId);
    return this.prisma.staffWorkingHour.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * Cập nhật lịch làm việc — upsert theo ngày trong tuần.
   * Body: [{ dayOfWeek: 0-6, startTime, endTime, isOff }]
   */
  async upsertWorkingHours(
    staffId: string,
    hours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isOff?: boolean;
    }>,
  ) {
    await this.assertExists(staffId);

    const days = new Set<number>();
    for (const hour of hours) {
      if (!Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek phải từ 0 đến 6');
      }
      if (days.has(hour.dayOfWeek)) throw new BadRequestException('Lịch làm việc bị trùng ngày');
      days.add(hour.dayOfWeek);
      if (!hour.isOff) this.assertTimeRange(hour.startTime, hour.endTime);
    }

    const results: any[] = [];
    for (const h of hours) {
      const result = await this.prisma.staffWorkingHour.upsert({
        where: {
          staffId_dayOfWeek: { staffId, dayOfWeek: h.dayOfWeek },
        },
        update: {
          startTime: new Date(`1970-01-01T${h.startTime}:00.000Z`),
          endTime: new Date(`1970-01-01T${h.endTime}:00.000Z`),
          isOff: h.isOff ?? false,
        },
        create: {
          staffId,
          dayOfWeek: h.dayOfWeek,
          startTime: new Date(`1970-01-01T${h.startTime}:00.000Z`),
          endTime: new Date(`1970-01-01T${h.endTime}:00.000Z`),
          isOff: h.isOff ?? false,
        },
      });
      results.push(result);
    }
    return results;
  }

  async getScheduleVersions(staffId: string, branchId?: string) {
    const staff = await this.assertExists(staffId);
    return this.prisma.staffScheduleVersion.findMany({
      where: { staffId: staff.id, branchId },
      select: {
        id: true,
        branchId: true,
        version: true,
        effectiveFrom: true,
        effectiveTo: true,
        status: true,
        note: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        segments: {
          orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { version: 'desc' }],
    });
  }

  private validateScheduleSegments(
    segments: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      sortOrder?: number;
    }>,
  ) {
    if (!segments.length) throw new BadRequestException('Lịch phải có ít nhất một khung giờ làm việc');
    const byDay = new Map<number, Array<{ start: number; end: number }>>();
    for (const segment of segments) {
      if (!Number.isInteger(segment.dayOfWeek) || segment.dayOfWeek < 0 || segment.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek phải từ 0 đến 6');
      }
      this.assertTimeRange(segment.startTime, segment.endTime);
      const next = {
        start: this.timeMinutes(segment.startTime),
        end: this.timeMinutes(segment.endTime),
      };
      const current = byDay.get(segment.dayOfWeek) ?? [];
      if (current.some((range) => next.start < range.end && next.end > range.start)) {
        throw new BadRequestException(`Các khung giờ ngày ${segment.dayOfWeek} không được chồng lấn`);
      }
      current.push(next);
      byDay.set(segment.dayOfWeek, current);
    }
  }

  private dateOnly(value: string | Date) {
    const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ');
    return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  private timeLabel(value: Date) {
    return value.toISOString().slice(11, 16);
  }

  private dateTime(date: Date, time: Date) {
    return `${date.toISOString().slice(0, 10)}T${time.toISOString().slice(11, 19)}.000Z`;
  }

  private async impactedBookings(
    staffId: string,
    branchId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    segments: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
        appointmentDate: {
          gte: effectiveFrom,
          ...(effectiveTo ? { lte: effectiveTo } : {}),
        },
        bookingServices: { some: { staffId } },
      },
      select: {
        id: true,
        bookingCode: true,
        appointmentDate: true,
        appointmentStartTime: true,
        appointmentEndTime: true,
        status: true,
      },
      orderBy: [{ appointmentDate: 'asc' }, { appointmentStartTime: 'asc' }],
    });
    return bookings.filter((booking) => {
      const day = booking.appointmentDate.getUTCDay();
      const start = booking.appointmentStartTime.getUTCHours() * 60 + booking.appointmentStartTime.getUTCMinutes();
      const end = booking.appointmentEndTime.getUTCHours() * 60 + booking.appointmentEndTime.getUTCMinutes();
      return !segments.some((segment) =>
        segment.dayOfWeek === day &&
        this.timeMinutes(segment.startTime) <= start &&
        this.timeMinutes(segment.endTime) >= end,
      );
    });
  }

  async saveScheduleVersion(
    staffId: string,
    input: {
      branchId: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      note?: string;
      acknowledgeOutOfHours?: boolean;
      segments: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        sortOrder?: number;
      }>;
    },
    actor: AuthUser,
  ) {
    this.validateScheduleSegments(input.segments);
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id: staffId,
        deletedAt: null,
        OR: [
          { branchId: input.branchId },
          {
            branchAssignments: {
              some: {
                branchId: input.branchId,
                status: 'ACTIVE',
                startDate: { lte: new Date() },
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
              },
            },
          },
        ],
      },
      select: { id: true, userId: true, branchId: true },
    });
    if (!staff) throw new BadRequestException('Nhân viên chưa được phân công vào chi nhánh này');
    const targetBranch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { businessId: true },
    });
    if (!targetBranch) throw new BadRequestException('Chi nhánh không tồn tại');
    const staffOnly =
      actor.roles.includes('STAFF') &&
      !actor.roles.some((role) => ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'PLATFORM_ADMIN'].includes(role));
    if (staffOnly) {
      if (staff.userId !== actor.id) throw new ForbiddenException('Nhân viên chỉ được sửa lịch của chính mình');
      if (!actor.permissions?.includes('staff_schedule:manage:self')) {
        throw new ForbiddenException('Bạn cần gửi yêu cầu thay đổi lịch để quản lý xét duyệt');
      }
    }
    const effectiveFrom = this.dateOnly(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? this.dateOnly(input.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày áp dụng');
    }
    const openingHours = await this.prisma.branchWorkingHour.findMany({
      where: { branchId: input.branchId },
      select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
    });
    const outside = input.segments.filter((segment) => {
      const opening = openingHours.find((item) => item.dayOfWeek === segment.dayOfWeek);
      if (!opening || opening.isClosed) return true;
      const open = opening.openTime.getUTCHours() * 60 + opening.openTime.getUTCMinutes();
      const close = opening.closeTime.getUTCHours() * 60 + opening.closeTime.getUTCMinutes();
      return this.timeMinutes(segment.startTime) < open || this.timeMinutes(segment.endTime) > close;
    });
    if (outside.length && (staffOnly || !input.acknowledgeOutOfHours)) {
      throw new ConflictException({
        message: 'Có khung giờ nằm ngoài giờ hoạt động của chi nhánh',
        code: 'OUTSIDE_BRANCH_HOURS',
        segments: outside,
      });
    }
    const impacted = await this.impactedBookings(
      staffId,
      input.branchId,
      effectiveFrom,
      effectiveTo,
      input.segments,
    );
    if (impacted.length) {
      const scheduleKey = createHash('sha256').update(JSON.stringify({
        staffId,
        branchId: input.branchId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        segments: [...input.segments].sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime)),
        bookingIds: impacted.map((booking) => booking.id).sort(),
      })).digest('hex');
      const subjectId = `${staffId}:${scheduleKey}`;
      const completed = await this.prisma.operationalImpactCase.findFirst({
        where: { subjectType: 'SCHEDULE', subjectId, action: 'SCHEDULE_CHANGE', status: 'COMPLETED' },
        select: { id: true },
      });
      if (!completed) {
        const existing = await this.prisma.operationalImpactCase.findFirst({
          where: { subjectType: 'SCHEDULE', subjectId, action: 'SCHEDULE_CHANGE', status: { in: ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'] } },
        });
        const impactCase = existing ?? await this.prisma.operationalImpactCase.create({ data: {
          businessId: targetBranch.businessId,
          branchId: input.branchId,
          subjectType: 'SCHEDULE',
          subjectId,
          action: 'SCHEDULE_CHANGE',
          reason: input.note?.trim() || 'Thay đổi lịch làm việc ảnh hưởng booking tương lai',
          ownerId: actor.id,
          createdBy: actor.id,
          deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        } });
        if (!existing) await this.prisma.operationalImpactItem.createMany({
          data: impacted.map((booking) => ({ caseId: impactCase.id, bookingId: booking.id })),
          skipDuplicates: true,
        });
        throw new ConflictException({
          message: 'Lịch mới ảnh hưởng booking tương lai. Hãy xử lý từng booking trong Trung tâm vận hành.',
          code: 'BOOKING_IMPACT_WORKFLOW',
          impactCaseId: impactCase.id,
          count: impacted.length,
          bookings: impacted,
        });
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.staffScheduleVersion.findFirst({
        where: { staffId, branchId: input.branchId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, effectiveFrom: true },
      });
      if (latest && latest.effectiveFrom < effectiveFrom) {
        const priorEnd = new Date(effectiveFrom);
        priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
        await tx.staffScheduleVersion.update({
          where: { id: latest.id },
          data: { effectiveTo: priorEnd },
        });
      } else if (latest && latest.effectiveFrom.getTime() === effectiveFrom.getTime()) {
        await tx.staffScheduleVersion.update({
          where: { id: latest.id },
          data: { status: 'ARCHIVED' },
        });
      }
      const created = await tx.staffScheduleVersion.create({
        data: {
          staffId,
          branchId: input.branchId,
          version: (latest?.version ?? 0) + 1,
          effectiveFrom,
          effectiveTo,
          note: input.note?.trim() || null,
          createdBy: actor.id,
          segments: {
            create: input.segments.map((segment, index) => ({
              dayOfWeek: segment.dayOfWeek,
              startTime: new Date(`1970-01-01T${segment.startTime}:00.000Z`),
              endTime: new Date(`1970-01-01T${segment.endTime}:00.000Z`),
              sortOrder: segment.sortOrder ?? index,
            })),
          },
        },
        include: { segments: { orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }] } },
      });
      // Keep the old one-range table as a current-state compatibility
      // projection. Immutable history lives in StaffScheduleVersion.
      await tx.staffWorkingHour.deleteMany({ where: { staffId } });
      const firstByDay = new Map<number, (typeof input.segments)[number]>();
      for (const segment of input.segments) {
        if (!firstByDay.has(segment.dayOfWeek)) firstByDay.set(segment.dayOfWeek, segment);
      }
      if (firstByDay.size) {
        await tx.staffWorkingHour.createMany({
          data: [...firstByDay.values()].map((segment) => ({
            staffId,
            dayOfWeek: segment.dayOfWeek,
            startTime: new Date(`1970-01-01T${segment.startTime}:00.000Z`),
            endTime: new Date(`1970-01-01T${segment.endTime}:00.000Z`),
            isOff: false,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'UPDATE',
          entityType: 'StaffScheduleVersion',
          entityId: created.id,
          newData: {
            staffId,
            branchId: input.branchId,
            version: created.version,
            effectiveFrom,
            effectiveTo,
            impactedBookings: impacted.map((booking) => booking.id),
          },
        },
      });
      return { ...created, impactedBookings: impacted };
    });
  }

  async requestScheduleChange(
    staffId: string,
    input: {
      branchId: string;
      type: 'RECURRING_SCHEDULE' | 'SINGLE_DAY' | 'LEAVE';
      effectiveFrom: string;
      effectiveTo?: string;
      proposedData: Record<string, unknown>;
      reason: string;
    },
    actor: AuthUser,
  ) {
    if (input.type === 'LEAVE') {
      throw new BadRequestException(
        'Nghỉ phép phải được gửi qua luồng yêu cầu nghỉ phép riêng',
      );
    }
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id: staffId,
        deletedAt: null,
        OR: [
          { branchId: input.branchId },
          { branchAssignments: { some: { branchId: input.branchId, status: 'ACTIVE' } } },
        ],
      },
      select: { id: true, userId: true },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại trong chi nhánh');
    if (actor.roles.includes('STAFF') && staff.userId !== actor.id) {
      throw new ForbiddenException('Nhân viên chỉ được gửi yêu cầu cho chính mình');
    }
    if (!input.reason?.trim()) throw new BadRequestException('Cần nhập lý do thay đổi lịch');
    return this.prisma.staffScheduleChangeRequest.create({
      data: {
        staffId,
        branchId: input.branchId,
        requestedBy: actor.id,
        type: input.type,
        effectiveFrom: this.dateOnly(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? this.dateOnly(input.effectiveTo) : null,
        proposedData: input.proposedData as Prisma.InputJsonValue,
        reason: input.reason.trim(),
      },
    });
  }

  async reviewScheduleChange(
    requestId: string,
    approve: boolean,
    actor: AuthUser,
    reviewNote?: string,
  ) {
    const request = await this.prisma.staffScheduleChangeRequest.findFirst({
      where: { id: requestId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Yêu cầu thay đổi lịch không còn chờ duyệt');
    let scheduleVersionId: string | null = null;
    if (approve && request.type === 'RECURRING_SCHEDULE') {
      const proposed = request.proposedData as any;
      const saved = await this.saveScheduleVersion(
        request.staffId,
        {
          branchId: request.branchId,
          effectiveFrom: request.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: request.effectiveTo?.toISOString().slice(0, 10),
          segments: proposed.segments ?? [],
          note: `Duyệt yêu cầu ${request.id}: ${request.reason}`,
          acknowledgeOutOfHours: false,
        },
        actor,
      );
      scheduleVersionId = saved.id;
    }
    const updated = await this.prisma.staffScheduleChangeRequest.update({
      where: { id: request.id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });
    return { ...updated, scheduleVersionId };
  }

  async getScheduleView(
    staffId: string,
    input: { branchId?: string; from: string; to: string },
  ) {
    const from = this.dateOnly(input.from);
    const to = this.dateOnly(input.to);
    const days = Math.floor((to.getTime() - from.getTime()) / 86400000);
    if (days < 0 || days > 93) throw new BadRequestException('Khoảng xem lịch tối đa 93 ngày');
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        fullName: true,
        position: true,
        status: true,
        isBookable: true,
        branchId: true,
        branch: { select: { id: true, name: true, businessId: true } },
        branchAssignments: {
          where: {
            status: 'ACTIVE',
            startDate: { lte: to },
            OR: [{ endDate: null }, { endDate: { gte: from } }],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            jobTitle: true,
            isPrimary: true,
            isBookable: true,
            branch: { select: { id: true, name: true, businessId: true } },
          },
        },
      },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const allowedBranchIds = new Set([
      staff.branchId,
      ...staff.branchAssignments.map((assignment) => assignment.branch.id),
    ]);
    const branchId = input.branchId || staff.branchId;
    if (!allowedBranchIds.has(branchId)) {
      throw new BadRequestException('Nhân viên không được phân công tại chi nhánh này');
    }
    const [
      versions,
      legacyHours,
      breaks,
      leaves,
      holidays,
      specialDays,
      bookings,
      attendance,
      changeRequests,
    ] = await Promise.all([
      this.prisma.staffScheduleVersion.findMany({
        where: {
          staffId,
          branchId,
          status: 'PUBLISHED',
          effectiveFrom: { lte: to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
        include: { segments: { orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }] } },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.staffWorkingHour.findMany({ where: { staffId, isOff: false } }),
      this.prisma.staffBreak.findMany({ where: { staffId, isActive: true } }),
      this.prisma.staffLeave.findMany({
        where: { staffId, status: 'APPROVED', startAt: { lte: new Date(`${input.to}T23:59:59.999Z`) }, endAt: { gte: from } },
        select: { id: true, startAt: true, endAt: true, reason: true, status: true },
      }),
      this.prisma.branchHoliday.findMany({ where: { branchId, date: { gte: from, lte: to } } }),
      this.prisma.specialWorkingDay.findMany({
        where: { branchId, date: { gte: from, lte: to }, OR: [{ staffId }, { staffId: null }] },
      }),
      this.prisma.booking.findMany({
        where: {
          branchId,
          deletedAt: null,
          appointmentDate: { gte: from, lte: to },
          bookingServices: { some: { staffId } },
        },
        select: {
          id: true,
          bookingCode: true,
          appointmentDate: true,
          appointmentStartTime: true,
          appointmentEndTime: true,
          status: true,
          contact: { select: { fullName: true } },
          customer: { select: { user: { select: { fullName: true } } } },
          bookingServices: {
            where: { staffId },
            select: {
              id: true,
              itemStartAt: true,
              itemEndAt: true,
              durationMinutes: true,
              transitionMinutes: true,
              status: true,
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ appointmentDate: 'asc' }, { appointmentStartTime: 'asc' }],
      }),
      this.prisma.staffAttendance.findMany({
        where: { staffId, branchId, workDate: { gte: from, lte: to } },
        select: {
          id: true,
          workDate: true,
          scheduledStartTime: true,
          scheduledEndTime: true,
          checkInAt: true,
          checkOutAt: true,
          status: true,
          lateMinutes: true,
          earlyLeaveMinutes: true,
          overtimeMinutes: true,
        },
      }),
      this.prisma.staffScheduleChangeRequest.findMany({
        where: { staffId, branchId, effectiveFrom: { lte: to }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] },
        select: {
          id: true,
          type: true,
          effectiveFrom: true,
          effectiveTo: true,
          reason: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const holidayKeys = new Set(holidays.filter((holiday) => holiday.isClosed).map((holiday) => holiday.date.toISOString().slice(0, 10)));
    const shifts: Array<Record<string, unknown>> = [];
    for (let cursor = new Date(from); cursor <= to; cursor = new Date(cursor.getTime() + 86400000)) {
      const key = cursor.toISOString().slice(0, 10);
      const specials = specialDays.filter((item) => item.date.toISOString().slice(0, 10) === key);
      const version = versions.find((item) =>
        item.effectiveFrom <= cursor &&
        (!item.effectiveTo || item.effectiveTo >= cursor),
      );
      const recurring = version
        ? version.segments.filter((segment) => segment.dayOfWeek === cursor.getUTCDay())
        : legacyHours.filter((hour) => hour.dayOfWeek === cursor.getUTCDay());
      if (!holidayKeys.has(key)) {
        for (const segment of recurring) {
          shifts.push({
            id: `${version?.id ?? 'legacy'}:${key}:${segment.id}`,
            date: key,
            startAt: this.dateTime(cursor, segment.startTime),
            endAt: this.dateTime(cursor, segment.endTime),
            source: version ? 'RECURRING_VERSION' : 'LEGACY_RECURRING',
            version: version?.version ?? null,
          });
        }
      }
      for (const special of specials) {
        shifts.push({
          id: special.id,
          date: key,
          startAt: this.dateTime(cursor, special.startTime),
          endAt: this.dateTime(cursor, special.endTime),
          source: 'SPECIAL_DAY',
        });
      }
    }
    const bookingBlocks = bookings.flatMap((booking) =>
      booking.bookingServices.map((item) => ({
        id: item.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        customerName: booking.contact?.fullName || booking.customer.user.fullName,
        service: item.service,
        status: booking.status,
        serviceStatus: item.status,
        startAt: item.itemStartAt?.toISOString() || this.dateTime(booking.appointmentDate, booking.appointmentStartTime),
        endAt: item.itemEndAt?.toISOString() || this.dateTime(booking.appointmentDate, booking.appointmentEndTime),
        bufferMinutes: item.transitionMinutes,
      })),
    );
    const shiftMinutes = shifts.reduce((sum, shift) =>
      sum + Math.max(0, (new Date(String(shift.endAt)).getTime() - new Date(String(shift.startAt)).getTime()) / 60000),
    0);
    const bookedMinutes = bookingBlocks
      .filter((booking) => !['CANCELLED'].includes(booking.status))
      .reduce((sum, booking) =>
        sum + Math.max(0, (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000),
      0);
    const breakBlocks = breaks.flatMap((item) => {
      const rows: Array<Record<string, unknown>> = [];
      for (let cursor = new Date(from); cursor <= to; cursor = new Date(cursor.getTime() + 86400000)) {
        if (cursor.getUTCDay() === item.dayOfWeek) {
          rows.push({
            id: `${item.id}:${cursor.toISOString().slice(0, 10)}`,
            startAt: this.dateTime(cursor, item.startTime),
            endAt: this.dateTime(cursor, item.endTime),
          });
        }
      }
      return rows;
    });
    const breakMinutes = breakBlocks.reduce((sum, item) =>
      sum + Math.max(0, (new Date(String(item.endAt)).getTime() - new Date(String(item.startAt)).getTime()) / 60000),
    0);
    const availableMinutes = Math.max(0, shiftMinutes - breakMinutes - bookedMinutes);
    return {
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        jobTitle: staff.position,
        status: staff.status,
        isBookable: staff.isBookable,
      },
      branchId,
      branchAssignments: [
        {
          branch: staff.branch,
          isPrimary: true,
          isBookable: staff.isBookable,
        },
        ...staff.branchAssignments.map((assignment) => ({
          ...assignment,
          startDate: assignment.startDate.toISOString().slice(0, 10),
          endDate: assignment.endDate?.toISOString().slice(0, 10) ?? null,
        })),
      ],
      range: { from: input.from, to: input.to },
      shifts,
      breaks: breakBlocks,
      leave: leaves,
      holidays,
      specialDays,
      bookings: bookingBlocks,
      attendance,
      changeRequests,
      availability: {
        shiftMinutes,
        breakMinutes,
        bookedMinutes,
        availableMinutes,
        utilizationPercent: shiftMinutes > 0 ? Math.round((bookedMinutes / shiftMinutes) * 1000) / 10 : 0,
        conflicts: impactedConflicts(bookingBlocks),
      },
    };
  }

  async getScheduleExceptions(staffId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: { branchId: true },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const [breaks, leaves, holidays, specialDays] = await Promise.all([
      this.prisma.staffBreak.findMany({ where: { staffId, isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }),
      this.prisma.staffLeave.findMany({ where: { staffId }, orderBy: { startAt: 'desc' } }),
      this.prisma.branchHoliday.findMany({ where: { branchId: staff.branchId }, orderBy: { date: 'asc' } }),
      this.prisma.specialWorkingDay.findMany({ where: { branchId: staff.branchId, OR: [{ staffId }, { staffId: null }] }, orderBy: { date: 'asc' } }),
    ]);
    return { breaks, leaves, holidays, specialDays };
  }

  async replaceBreaks(
    staffId: string,
    breaks: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    await this.assertExists(staffId);
    const byDay = new Map<number, Array<{ start: number; end: number }>>();
    for (const item of breaks) {
      if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 0 || item.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek phải từ 0 đến 6');
      }
      this.assertTimeRange(item.startTime, item.endTime);
      const range = { start: this.timeMinutes(item.startTime), end: this.timeMinutes(item.endTime) };
      const ranges = byDay.get(item.dayOfWeek) ?? [];
      if (ranges.some((current) => range.start < current.end && range.end > current.start)) {
        throw new BadRequestException('Các giờ nghỉ không được chồng lấn');
      }
      ranges.push(range);
      byDay.set(item.dayOfWeek, ranges);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.staffBreak.deleteMany({ where: { staffId } });
      if (breaks.length) {
        await tx.staffBreak.createMany({
          data: breaks.map((item) => ({
            staffId,
            dayOfWeek: item.dayOfWeek,
            startTime: new Date(`1970-01-01T${item.startTime}:00.000Z`),
            endTime: new Date(`1970-01-01T${item.endTime}:00.000Z`),
          })),
        });
      }
      return tx.staffBreak.findMany({ where: { staffId } });
    });
  }

  async requestLeave(
    staffId: string,
    input: { startAt: string; endAt: string; reason?: string },
    user: AuthUser,
  ) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    if (user.roles.includes('STAFF') && staff.userId !== user.id) {
      throw new ForbiddenException('Staff chỉ được gửi yêu cầu nghỉ của chính mình');
    }
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || !(startAt < endAt)) {
      throw new BadRequestException('Khoảng nghỉ không hợp lệ');
    }
    const overlap = await this.prisma.staffLeave.findFirst({
      where: {
        staffId,
        status: { in: ['PENDING', 'APPROVED'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (overlap) throw new BadRequestException('Khoảng nghỉ bị trùng với yêu cầu hiện có');
    return this.prisma.staffLeave.create({
      data: { staffId, startAt, endAt, reason: input.reason },
    });
  }

  async reviewLeave(
    leaveId: string,
    approve: boolean,
    reviewerId: string,
    reviewNote?: string,
  ) {
    const leave = await this.prisma.staffLeave.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Yêu cầu nghỉ không tồn tại');
    if (leave.status !== 'PENDING') throw new BadRequestException('Yêu cầu không còn chờ duyệt');
    return this.prisma.staffLeave.update({
      where: { id: leaveId },
      data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: reviewerId, reviewNote },
    });
  }

  async getBranchIdByLeave(leaveId: string): Promise<string> {
    const leave = await this.prisma.staffLeave.findUnique({
      where: { id: leaveId },
      select: { staff: { select: { branchId: true } } },
    });
    if (!leave) throw new NotFoundException('Yêu cầu nghỉ không tồn tại');
    return leave.staff.branchId;
  }

  async upsertHoliday(branchId: string, input: { date: string; name: string; isClosed?: boolean }) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime()) || !input.name?.trim()) {
      throw new BadRequestException('Ngày và tên ngày nghỉ không hợp lệ');
    }
    return this.prisma.branchHoliday.upsert({
      where: { branchId_date: { branchId, date } },
      create: { branchId, date, name: input.name, isClosed: input.isClosed ?? true },
      update: { name: input.name, isClosed: input.isClosed ?? true },
    });
  }

  async createSpecialDay(branchId: string, input: { staffId?: string; date: string; startTime: string; endTime: string }) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày đặc biệt không hợp lệ');
    this.assertTimeRange(input.startTime, input.endTime);
    if (input.staffId) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: input.staffId },
        select: { branchId: true },
      });
      if (!staff || staff.branchId !== branchId) {
        throw new BadRequestException('Nhân viên không thuộc chi nhánh');
      }
    }
    return this.prisma.specialWorkingDay.create({
      data: {
        branchId,
        staffId: input.staffId,
        date,
        startTime: new Date(`1970-01-01T${input.startTime}:00.000Z`),
        endTime: new Date(`1970-01-01T${input.endTime}:00.000Z`),
      },
    });
  }

  // ============================================================
  // STAFF ↔ SERVICE ASSIGNMENT
  // ============================================================

  /**
   * Gán dịch vụ cho nhân viên.
   */
  async assignServices(staffId: string, serviceIds: string[]) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId }, select: { id: true, branchId: true },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    const uniqueServiceIds = [...new Set(serviceIds)];
    const services = uniqueServiceIds.length ? await this.prisma.branchServiceOffering.findMany({
      where: { id: { in: uniqueServiceIds }, branchId: staff.branchId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    }) : [];
    if (services.length !== uniqueServiceIds.length) {
      throw new BadRequestException('Chỉ được gán dịch vụ đang hoạt động tại chi nhánh của nhân viên');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staffService.deleteMany({ where: { staffId } });
      if (uniqueServiceIds.length) {
        await tx.staffService.createMany({
          data: uniqueServiceIds.map((serviceId) => ({ staffId, serviceId })),
          skipDuplicates: true,
        });
      }
    });

    return this.prisma.staffService.findMany({
      where: { staffId },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });
  }

  /**
   * Lấy danh sách dịch vụ đã gán cho nhân viên.
   */
  async getAssignedServices(staffId: string) {
    return this.prisma.staffService.findMany({
      where: { staffId },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
            status: true,
          },
        },
      },
    });
  }

  // ============================================================
  // COMMISSION / HOA HỒNG
  // ============================================================

  /**
   * Lấy tổng hoa hồng của staff từ booking đã hoàn thành.
   * Staff chỉ xem được hoa hồng của chính mình.
   */
  async getCommission(
    staffId: string,
    period?: { startDate?: string; endDate?: string },
  ) {
    const where: any = {
      staffId,
      booking: { status: 'COMPLETED' },
    };

    if (period?.startDate || period?.endDate) {
      where.booking.appointmentDate = {};
      if (period.startDate) {
        where.booking.appointmentDate.gte = new Date(period.startDate);
      }
      if (period.endDate) {
        where.booking.appointmentDate.lte = new Date(period.endDate);
      }
    }

    const bookingServices = await this.prisma.bookingService.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            appointmentDate: true,
            status: true,
          },
        },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = bookingServices.reduce(
      (sum, bs) => sum + Number(bs.priceAtBooking),
      0,
    );

    return {
      staffId,
      totalBookings: bookingServices.length,
      totalRevenue,
      items: bookingServices.map((bs) => ({
        bookingId: bs.booking.id,
        bookingCode: bs.booking.bookingCode,
        date: bs.booking.appointmentDate,
        serviceName: bs.service.name,
        price: Number(bs.priceAtBooking),
      })),
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async assertExists(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    return staff;
  }

  /**
   * Lấy branchId từ staffId (dùng cho assertBranchAccess ở controller).
   */
  async getBranchIdByStaff(staffId: string): Promise<string> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: { branchId: true },
    });
    if (!staff) throw new NotFoundException('Nhân viên không tồn tại');
    return staff.branchId;
  }
}
