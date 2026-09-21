import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertBusinessAccess,
  resolveBusinessIdsForUser,
  resolveBranchIdsForUser,
  ALL_TENANTS,
} from '../common/utils/multi-tenancy';
import { bookableStaffWhere, professionalTitle, staffRating } from './bookable-staff';
import { TokenBlacklistService } from '../auth/token-blacklist.service';

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
    }));
  }

  async findPublic(branchId: string, serviceIds: string[] = []) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    const staff = await this.prisma.staffProfile.findMany({
      where: bookableStaffWhere({ branchId, publicOnly: true, serviceIds }),
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
        ...bookableStaffWhere({ publicOnly: true }),
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
      status?: 'PROFILE_ONLY' | 'INVITED' | 'ACTIVE' | 'LOCKED' | 'INACTIVE';
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
            role: { code: { in: ['RECEPTIONIST', 'STAFF'] } },
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

  private dateOnly(value: string | Date) {
    const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ');
    return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  // Branch-level opening exceptions remain part of booking availability.
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

  async createSpecialDay(branchId: string, input: { date: string; startTime: string; endTime: string }) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày đặc biệt không hợp lệ');
    this.assertTimeRange(input.startTime, input.endTime);
    return this.prisma.specialWorkingDay.upsert({
      where: { branchId_date: { branchId, date } },
      create: {
        branchId,
        date,
        startTime: new Date(`1970-01-01T${input.startTime}:00.000Z`),
        endTime: new Date(`1970-01-01T${input.endTime}:00.000Z`),
      },
      update: {
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
