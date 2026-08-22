import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { BookingsAccessService } from './bookings-access.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireScope } from '../common/decorators/scope.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Audited } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateBookingDto,
  CreateGuestBookingDto,
  UpdateStatusDto,
  MoveBookingDto,
  ResizeBookingDto,
  AssignStaffDto,
} from './dto/bookings.dto';
import { BookingAction, BookingActionDto } from './dto/booking-action.dto';
import {
  assertBranchAccess,
  assertBusinessAccess,
  resolveBranchIdsForUser,
  resolveBusinessIdsForUser,
} from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';
import { VouchersService } from './vouchers.service';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { AuditAction } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { randomUUID } from 'crypto';

/**
 * Routes that previously allowed the legacy role `ADMIN` keep that
 * compatibility — `ADMIN` is seeded as an alias of `PLATFORM_ADMIN`.
 * All other RBAC decisions go through @RequireScope + @RequirePermission +
 * BookingsAccessService at the service layer.
 */
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingsAccess: BookingsAccessService,
    private readonly prisma: PrismaService,
    private readonly changeRequestsService: ChangeRequestsService,
    private readonly vouchersService: VouchersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private customerBookingView(booking: any) {
    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      source: booking.source,
      appointmentDate: booking.appointmentDate,
      appointmentStartTime: booking.appointmentStartTime,
      appointmentEndTime: booking.appointmentEndTime,
      totalAmount: booking.totalAmount,
      voucherDiscountAmount: booking.voucherDiscountAmount,
      finalAmount: booking.finalAmount,
      note: booking.note,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      branch: booking.branch
        ? {
            id: booking.branch.id,
            name: booking.branch.name,
            addressLine: booking.branch.addressLine,
            phone: booking.branch.phone,
            latitude: booking.branch.latitude,
            longitude: booking.branch.longitude,
            business: booking.branch.business
              ? {
                  id: booking.branch.business.id,
                  name: booking.branch.business.name,
                  description: booking.branch.business.description,
                  logoMediaId: booking.branch.business.logoMediaId,
                }
              : undefined,
          }
        : undefined,
      bookingServices: (booking.bookingServices ?? []).map((item: any) => ({
        id: item.id,
        priceAtBooking: item.priceAtBooking,
        durationMinutes: item.durationMinutes,
        service: item.service
          ? {
              id: item.service.id,
              name: item.service.name,
              description: item.service.description,
              category: item.service.category
                ? { id: item.service.category.id, name: item.service.category.name }
                : undefined,
            }
          : undefined,
        staff: item.staff
          ? {
              id: item.staff.id,
              fullName: item.staff.fullName,
              position: item.staff.position,
              bio: item.staff.bio,
              user: item.staff.user
                ? {
                    id: item.staff.user.id,
                    fullName: item.staff.user.fullName,
                    avatarMediaId: item.staff.user.avatarMediaId,
                  }
                : undefined,
            }
          : undefined,
      })),
      statusHistory: booking.statusHistory,
      payments: (booking.payments ?? []).map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
      review: booking.review,
      transitionAvailability: booking.transitionAvailability,
    };
  }

  /** Compatibility endpoint kept for existing clients; online booking requires an authenticated customer. */
  @Post('guest')
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async createGuest(
    @Body() body: CreateGuestBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    }
    const booking = await this.bookingsService.create({
      branchId: body.branchId,
      serviceIds: body.serviceIds,
      comboId: body.comboId,
      appointmentDate: body.appointmentDate,
      note: body.note,
      staffId: body.staffId,
      customerId: profile.id,
      createdBy: user.id,
      source: 'ONLINE_WEB',
    });
    return this.customerBookingView(booking);
  }

  /**
   * POST /api/bookings
   * Tạo lịch hẹn.
   *  - Customer tự đặt: customerId = user.customerId
   *  - Salon tạo hộ: phải assertBusinessAccess
   */
  @Post()
  @Audited({ action: AuditAction.CREATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission(
    'booking:create:self',
    'booking:create:tenant',
    'booking:create:branch',
  )
  async create(@Body() body: CreateBookingDto, @CurrentUser() user: AuthUser) {
    await this.bookingsAccess.assertCustomerCreate(user, body.branchId);
    const customerOnly = user.roles.includes('CUSTOMER') &&
      !user.roles.some((role) => ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role));
    let customerId = body.customerId;
    if (customerOnly) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      customerId = profile.id;
    }
    if (!customerId) {
      if (!body.guestName?.trim()) {
        throw new BadRequestException('Nhập tên khách vãng lai hoặc chọn hồ sơ khách hàng');
      }
      const guest = await this.prisma.user.create({
        data: {
          email: `walkin-${randomUUID()}@guest.local`,
          phone: null,
          fullName: body.guestName.trim(),
          passwordHash: 'WALK_IN_ACCOUNT_DISABLED',
          isActive: false,
          customerProfile: { create: { note: 'Khách tại quầy' } },
        },
        select: { customerProfile: { select: { id: true } } },
      });
      customerId = guest.customerProfile!.id;
    }
    const booking = await this.bookingsService.create({
      ...body,
      customerId,
      createdBy: user.id,
      source: customerOnly ? 'ONLINE_WEB' : body.source ?? (body.guestName ? 'WALK_IN' : 'STAFF_CREATED'),
      guestContact: body.guestName
        ? { fullName: body.guestName.trim(), phone: body.guestPhone?.trim() || null }
        : undefined,
    });
    return customerOnly ? this.customerBookingView(booking) : booking;
  }

  @Post('preview-price')
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  async previewPrice(
    @Body('voucherCode') voucherCode: string | undefined,
    @Body('serviceIds') serviceIds: string[],
    @Body('branchId') branchId: string,
    @Body('comboId') comboId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if ((!serviceIds || serviceIds.length === 0) && !comboId) throw new BadRequestException('Chọn dịch vụ hoặc combo');
    if (comboId) {
      const combo = await this.prisma.combo.findFirst({
        where: { id: comboId, branchId, status: 'ACTIVE', deletedAt: null },
      });
      if (!combo) throw new BadRequestException('Combo không hợp lệ');
      const subtotal = Number(combo.comboPrice);
      if (!voucherCode) return { subtotal, voucherDiscount: 0, finalAmount: subtotal, voucherApplied: false };
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
      return this.vouchersService.preview({ customerId: customer.id, branchId, voucherCode, subtotal });
    }
    const services = await this.prisma.branchServiceOffering.findMany({
      where: {
        id: { in: serviceIds },
        branchId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (services.length !== new Set(serviceIds).size) {
      throw new BadRequestException('Dịch vụ không hợp lệ hoặc không thuộc chi nhánh');
    }
    const subtotal = services.reduce((s, sv) => s + Number(sv.price), 0);
    if (!voucherCode) {
      return {
        subtotal,
        voucherDiscount: 0,
        finalAmount: subtotal,
        voucherApplied: false,
      };
    }
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return this.vouchersService.preview({
      customerId: customer.id,
      branchId,
      voucherCode,
      subtotal,
    });
  }

  /**
   * GET /api/bookings — role-aware list.
   * - PLATFORM_ADMIN: global read via explicit platform permission
   * - BUSINESS_OWNER/BRANCH_MANAGER: tenant-scoped
   * - RECEPTIONIST/STAFF: branch-scoped
   * - CUSTOMER: own bookings only
   */
  @Get()
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
    'STAFF',
    'CUSTOMER',
  )
  @RequirePermission('booking:read:self', 'booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('branchIds') branchIds?: string,
    @Query('categoryId') categoryId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('businessId') businessId?: string,
    @Query('customerQuery') customerQuery?: string,
    @Query('staffId') requestedStaffId?: string,
    @Query('source') source?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortOrder') sortOrder?: 'newest' | 'oldest',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const allowedBusinessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const requestedBranchIds = branchIds?.split(',').filter(Boolean);

    // CUSTOMER-only path
    if (
      user.scopes?.some((s) => s.code === 'CUSTOMER') &&
      !user.scopes?.some((s) =>
        ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'].includes(
          s.code,
        ),
      )
    ) {
      const customerProfile = await this.prisma.customerProfile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!customerProfile) {
        throw new ForbiddenException('Tài khoản không có hồ sơ khách hàng hợp lệ');
      }
      return this.bookingsService.findAll({
        search,
        status,
        branchId,
        allowedBranchIds: requestedBranchIds,
        categoryId,
        serviceId,
        businessId,
        customerQuery,
        source,
        dateFrom,
        dateTo,
        sortOrder,
        customerId: customerProfile.id,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
    }

    if (isPlatformRole(user)) {
      return this.bookingsService.findAll({
        search,
        status,
        branchId,
        allowedBranchIds: requestedBranchIds,
        categoryId,
        serviceId,
        businessId,
        customerQuery,
        staffId: requestedStaffId,
        source,
        dateFrom,
        dateTo,
        sortOrder,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
    }

    // Tenant/branch scope — resolve every explicit branch assignment. An empty
    // result must stay empty; treating [] as "no filter" would leak a tenant.
    const allowed = [...new Set((await Promise.all(
      allowedBusinessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
    )).flatMap((ids) => ids ?? []))];
    const requestedBranchAllowed = !branchId || allowed.includes(branchId);
    const scopedRequestedBranchIds = requestedBranchIds?.filter((id) => allowed.includes(id));
    const staffOnly = user.roles.includes('STAFF') && !user.roles.some((role) =>
      ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role),
    );
    const ownStaff = staffOnly
      ? await this.prisma.staffProfile.findFirst({
          where: { userId: user.id, branchId: { in: allowed }, status: 'ACTIVE' },
          select: { id: true },
        })
      : null;

    return this.bookingsService.findAll({
      search,
      status,
      branchId: branchId && requestedBranchAllowed ? branchId : undefined,
      allowedBranchIds: requestedBranchAllowed && (!staffOnly || ownStaff)
        ? scopedRequestedBranchIds?.length ? scopedRequestedBranchIds : allowed
        : [],
      staffId: ownStaff?.id,
      categoryId,
      serviceId,
      businessId,
      customerQuery,
      source,
      dateFrom,
      dateTo,
      sortOrder,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * GET /api/bookings/my-appointments
   * Customer-only listing of own bookings, segmented by tab.
   */
  @Get('my-appointments')
  @Roles('CUSTOMER')
  @RequirePermission('booking:read:self')
  async myAppointments(
    @CurrentUser() user: AuthUser,
    @Query('tab') tab: 'upcoming' | 'completed' | 'cancelled' = 'upcoming',
  ) {
    const customerProfile = await this.prisma.customerProfile.findFirst({
      where: { userId: user.id },
    });
    if (!customerProfile) {
      throw new ForbiddenException('Tài khoản không có hồ sơ khách hàng hợp lệ');
    }

    const statusMap = {
      upcoming: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
      completed: ['COMPLETED'],
      cancelled: ['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'],
    };

    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId: customerProfile.id,
        deletedAt: null,
        status: { in: statusMap[tab] as any },
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            addressLine: true,
            phone: true,
            latitude: true,
            longitude: true,
            business: {
              select: { id: true, name: true, description: true, logoMediaId: true },
            },
          },
        },
        bookingServices: {
          include: {
            service: true,
            staff: {
              select: {
                id: true,
                fullName: true,
                position: true,
                bio: true,
                user: { select: { id: true, fullName: true, avatarMediaId: true } },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
        review: {
          select: {
            id: true,
            overallRating: true,
            comment: true,
            status: true,
            createdAt: true,
          },
        },
        changeRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, requestType: true, status: true, reason: true, reviewNote: true, createdAt: true },
        },
      },
      orderBy: [
        { appointmentDate: tab === 'upcoming' ? 'asc' : 'desc' },
        { appointmentStartTime: tab === 'upcoming' ? 'asc' : 'desc' },
      ],
    });
    return { data: bookings };
  }

  /**
   * GET /api/bookings/salon-queue
   * Salon-side pending bookings + change requests.
   */
  @Get('salon-queue')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
  @RequirePermission('booking:read:branch', 'booking:read:tenant')
  async salonQueue(@CurrentUser() user: AuthUser) {
    const allowedBusinessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const allowedBranchIds = (
      await Promise.all(
        allowedBusinessIds.map(async (businessId) =>
          (await resolveBranchIdsForUser(this.prisma, user, businessId)) ?? [],
        ),
      )
    ).flat();
    const staffOnly =
      user.roles.includes('STAFF') &&
      !user.roles.some((role) =>
        ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'PLATFORM_ADMIN'].includes(role),
      );
    const ownStaff = staffOnly
      ? await this.prisma.staffProfile.findFirst({
          where: { userId: user.id, branchId: { in: allowedBranchIds } },
          select: { id: true },
        })
      : null;
    if (staffOnly && !ownStaff) {
      return this.bookingsService.findAll({
        status: 'PENDING',
        allowedBranchIds: [],
        limit: 100,
      });
    }
    return this.bookingsService.findAll({
      status: 'PENDING',
      allowedBranchIds,
      staffId: ownStaff?.id,
      limit: 100,
    });
  }

  /**
   * GET /api/bookings/salon-violations
   * Only platform roles can see forced cancels / escalations.
   */
  @Get('salon-violations')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'PLATFORM_ADMIN')
  @RequirePermission('audit:read:branch', 'audit:read:tenant', 'audit:read:platform')
  async salonViolations(@CurrentUser() user: AuthUser) {
    if (!isPlatformRole(user)) {
      // Salon owner/managers can only see THEIR OWN violations, not the global list.
      const allowedBusinessIds = await resolveBusinessIdsForUser(
        this.prisma,
        user,
      );
      const allowedBranchIds = (
        await Promise.all(
          allowedBusinessIds.map(async (businessId) =>
            (await resolveBranchIdsForUser(this.prisma, user, businessId)) ?? [],
          ),
        )
      ).flat();
      const allowedBookings = await this.prisma.booking.findMany({
        where: { branchId: { in: allowedBranchIds } },
        select: { id: true },
      });
      const audits = await this.prisma.auditLog.findMany({
        where: {
          entityType: 'Booking',
          entityId: { in: allowedBookings.map((b) => b.id) },
          action: {
            in: ['FORCE_CANCEL', 'REFUND', 'ESCALATION', 'POLICY_OVERRIDE'] as any,
          },
        },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { data: audits };
    }
    const audits = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'Booking',
        action: { in: ['FORCE_CANCEL', 'REFUND', 'ESCALATION', 'POLICY_OVERRIDE'] as any },
      },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: audits };
  }

  @Get('available-slots')
  @Public()
  getAvailableSlots(
    @Query('branchId') branchId: string,
    @Query('staffId') staffId: string,
    @Query('serviceIds') serviceIds: string,
    @Query('date') date: string,
  ) {
    if (!branchId || !serviceIds || !date) {
      throw new BadRequestException('branchId, serviceIds, date are required');
    }
    return this.bookingsService.getAvailableSlots({
      branchId,
      staffId: staffId || null,
      serviceIds: serviceIds.split(',').filter(Boolean),
      date,
    });
  }

  @Get('scheduler')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async getSchedulerData(
    @Query('branchId') branchId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!branchId || !startDate || !endDate) {
      throw new BadRequestException('branchId, startDate, endDate are required');
    }
    await assertBranchAccess(this.prisma, user, branchId);
    const staffOnly =
      user.roles.includes('STAFF') &&
      !user.roles.some((role) =>
        ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'PLATFORM_ADMIN'].includes(role),
      );
    if (!staffOnly) {
      return this.bookingsService.getSchedulerData(branchId, startDate, endDate);
    }
    const ownStaff = await this.prisma.staffProfile.findFirst({
      where: { userId: user.id, branchId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!ownStaff) return { staff: [], bookings: [] };
    return this.bookingsService.getSchedulerData(branchId, startDate, endDate, {
      staffId: ownStaff.id,
      redactCustomerContact: true,
    });
  }

  @Get('stats')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
  )
  @RequirePermission('report:overview:branch', 'report:overview:tenant', 'report:overview:platform', 'report:revenue:platform')
  async getStats(@CurrentUser() user: AuthUser) {
    if (isPlatformRole(user)) {
      return this.bookingsService.getStats();
    }
    const allowedBusinessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const allowedBranchIds = (
      await Promise.all(
        allowedBusinessIds.map(async (businessId) =>
          (await resolveBranchIdsForUser(this.prisma, user, businessId)) ?? [],
        ),
      )
    ).flat();
    return this.bookingsService.getStatsForBranches(allowedBranchIds);
  }

  @Get('by-category')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async getByCategory(@Query('name') name: string, @CurrentUser() user: AuthUser) {
    if (isPlatformRole(user)) return this.bookingsService.getByCategory(name);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = [...new Set((await Promise.all(
      businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
    )).flatMap((ids) => ids ?? []))];
    return this.bookingsService.getByCategory(name, branchIds);
  }

  @Get('by-branch/:branchId')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequireScope({
    roles: ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'PLATFORM_ADMIN'],
    scopeLevel: 'branch',
    permissions: ['booking:read:branch', 'booking:read:tenant', 'booking:read:platform'],
  })
  async getByBranch(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const businessId = await (
      await this.prisma.branch.findUniqueOrThrow({ where: { id: branchId } })
    ).businessId;
    await assertBusinessAccess(this.prisma, user, businessId);
    return this.bookingsService.getByBranch(branchId);
  }

  @Get('by-customer/:userId')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
    'CUSTOMER',
  )
  @RequirePermission('booking:read:self', 'booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async getByCustomer(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Customer chỉ xem được của mình — guard via policy.ts in service.
    if (
      user.scopes?.some((s) => s.code === 'CUSTOMER') &&
      !isPlatformRole(user) &&
      !user.scopes?.some((s) =>
        ['BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(s.code),
      ) &&
      user.id !== userId
    ) {
      throw new BadRequestException('Bạn chỉ xem được lịch của mình');
    }
    if (user.id === userId && user.roles.includes('CUSTOMER')) {
      return this.bookingsService.getByCustomer(userId);
    }
    if (isPlatformRole(user)) return this.bookingsService.getByCustomer(userId);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = [...new Set((await Promise.all(
      businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
    )).flatMap((ids) => ids ?? []))];
    return this.bookingsService.getByCustomer(userId, branchIds);
  }

  @Get(':id')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
    'STAFF',
    'CUSTOMER',
  )
  @RequirePermission('booking:read:self', 'booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const booking = await this.bookingsService.findOne(id);
    const staffOnly = user.roles.includes('STAFF') && !user.roles.some((role) =>
      ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(role),
    );
    // Service-level access check via BookingsAccessService
    const isPlatform = isPlatformRole(user);
    if (!isPlatform) {
      const info = await this.bookingsAccess.loadAndAssert(
        user,
        id,
        user.scopes?.some((s) => s.code === 'CUSTOMER')
          ? 'booking:read:self'
          : user.scopes?.some((s) => ['STAFF', 'RECEPTIONIST'].includes(s.code))
            ? 'booking:read:branch'
            : 'booking:read:branch',
      );
      if (staffOnly && info.staffUserId !== user.id) {
        throw new BadRequestException('Nhân viên chỉ được xem lịch được phân công cho mình');
      }
    }
    const customerOnly =
      user.roles.includes('CUSTOMER') &&
      !user.roles.some((role) =>
        ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF'].includes(role),
      );
    return customerOnly ? this.customerBookingView(booking) : booking;
  }

  /**
   * PUT /api/v1/bookings/:id — Booking Action Router (API Rule 7).
   * Payload `action` quyết định nhánh xử lý: confirm | reject | reschedule | auto_accept.
   * Mỗi nhánh gọi MỘT service function riêng (Rule 14 — không gộp).
   */
  @Put(':id')
  @Roles(
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
  )
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Booking' })
  async actionRouter(
    @Param('id') id: string,
    @Body() body: BookingActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id);
    const changedByType = isPlatformRole(user) ? 'ADMIN' : 'SALON';

    switch (body.action) {
      case BookingAction.CONFIRM:
        return this.bookingsService.updateStatus(
          id,
          'CONFIRMED',
          user.id,
          body.reason,
          changedByType,
          user.roles,
        );

      case BookingAction.AUTO_ACCEPT:
        // auto_accept giữ nhánh riêng để audit phân biệt với confirm thủ công.
        return this.bookingsService.updateStatus(
          id,
          'CONFIRMED',
          user.id,
          body.reason ?? 'auto_accept',
          changedByType,
          user.roles,
        );

      case BookingAction.REJECT:
        return this.bookingsService.updateStatus(
          id,
          'REJECTED',
          user.id,
          body.reason ?? 'Salon từ chối lịch hẹn',
          changedByType,
          user.roles,
        );

      case BookingAction.RESCHEDULE: {
        // Known bug fix (Rule 11): "Chấp nhận đổi lịch" phải GHI ĐÈ giờ mới
        // vào DB chứ không chỉ tắt banner. moveBooking chạy trong transaction,
        // kiểm tra trùng slot + buffer trước khi ghi đè booking_datetime.
        if (!body.newStartTime || !body.newEndTime) {
          throw new BadRequestException(
            'reschedule cần newStartTime và newEndTime (ISO 8601)',
          );
        }
        return this.bookingsService.moveBooking(
          id,
          body.newStartTime,
          body.newEndTime,
          body.newStaffId ?? '',
        );
      }
    }
  }

  /**
   * PATCH /api/bookings/:id/status — update booking status.
   * Permission scope varies by intent (cancel vs update vs force-cancel).
   */
  @Patch(':id/status')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'BRANCH_MANAGER',
    'RECEPTIONIST',
    'STAFF',
    'CUSTOMER',
  )
  @RequirePermission('booking:update:self', 'booking:update:branch', 'booking:update:tenant', 'booking:cancel:platform')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Booking' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Service asserts write access via BookingsAccessService.
    const intent =
      body.status === 'CANCELLED' && isPlatformRole(user)
        ? 'force_cancel'
        : 'normal';
    if (intent === 'force_cancel') {
      if (!body.note?.trim()) {
        throw new BadRequestException('Lý do force-cancel là bắt buộc');
      }
      await this.bookingsAccess.assertForceCancel(user, id);
    } else {
      await this.bookingsAccess.assertWrite(user, id);
    }

    const changedByType =
      isPlatformRole(user)
        ? 'ADMIN'
        : user.scopes?.some((s) => s.code === 'CUSTOMER')
          ? 'CUSTOMER'
          : 'SALON';
    return this.bookingsService.updateStatus(
      id,
      body.status,
      user.id,
      body.note,
      changedByType,
      user.roles,
    );
  }

  @Get(':id/force-cancel-preview')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('booking:cancel:platform')
  async forceCancelPreview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertForceCancel(user, id);
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        appointmentDate: true,
        totalAmount: true,
        finalAmount: true,
        branch: { select: { id: true, name: true, businessId: true } },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            refundRequests: { select: { id: true, amount: true, status: true } },
          },
        },
        bookingServices: {
          select: { id: true, serviceNameSnapshot: true, staffId: true, status: true },
        },
      },
    });
    if (!booking) throw new BadRequestException('Booking không tồn tại');
    return {
      booking,
      impact: {
        releasesAssignedSlots: booking.bookingServices.length,
        hasSuccessfulPayment: booking.payments.some((payment) => ['PAID', 'PARTIALLY_PAID'].includes(payment.status)),
        createsRefundAutomatically: false,
        requiresSeparateRefundWorkflow: booking.payments.some((payment) => ['PAID', 'PARTIALLY_PAID'].includes(payment.status)),
      },
    };
  }

  @Patch(':id/move')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async moveBooking(
    @Param('id') id: string,
    @Body() body: MoveBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id);
    return this.bookingsService.moveBooking(
      id,
      body.newStartTime,
      body.newEndTime,
      body.newStaffId,
    );
  }

  @Patch(':id/resize')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async resizeBooking(
    @Param('id') id: string,
    @Body() body: ResizeBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id);
    return this.bookingsService.resizeBooking(id, body.newEndTime);
  }

  @Patch(':id/assign')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async assignStaff(
    @Param('id') id: string,
    @Body() body: AssignStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id);
    return this.bookingsService.assignStaff(id, body.staffId);
  }

  // ============= CHANGE REQUESTS =============

  @Post(':id/change-requests')
  @Audited({ action: AuditAction.CREATE, entityType: 'AppointmentChangeRequest' })
  @Roles('CUSTOMER')
  @RequirePermission('change_request:create:self')
  async createChangeRequest(
    @Param('id') bookingId: string,
    @Body()
    body: {
      requestType: 'RESCHEDULE' | 'STAFF_CHANGE' | 'CANCEL';
      proposedStartTime?: string;
      proposedEndTime?: string;
      proposedStaffId?: string;
      reason?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, bookingId);
    const requestedByType = user.scopes?.some((s) => s.code === 'CUSTOMER')
      ? 'CUSTOMER'
      : 'SALON';
    return this.changeRequestsService.create(bookingId, user.id, requestedByType, body);
  }

  @Patch('change-requests/:reqId/approve')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('change_request:approve:branch', 'change_request:approve:tenant')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'AppointmentChangeRequest', idParam: 'reqId' })
  async approveChangeRequest(
    @Param('reqId') reqId: string,
    @Body() body: { reviewNote?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const request = await this.prisma.appointmentChangeRequest.findUniqueOrThrow({
      where: { id: reqId },
      select: { booking: { select: { branchId: true } } },
    });
    await assertBranchAccess(this.prisma, user, request.booking.branchId);
    return this.changeRequestsService.approve(reqId, user.id, body.reviewNote);
  }

  @Patch('change-requests/:reqId/reject')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('change_request:approve:branch', 'change_request:approve:tenant')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'AppointmentChangeRequest', idParam: 'reqId' })
  async rejectChangeRequest(
    @Param('reqId') reqId: string,
    @Body() body: { reviewNote?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const request = await this.prisma.appointmentChangeRequest.findUniqueOrThrow({
      where: { id: reqId },
      select: { booking: { select: { branchId: true } } },
    });
    await assertBranchAccess(this.prisma, user, request.booking.branchId);
    return this.changeRequestsService.reject(reqId, user.id, body.reviewNote);
  }

  @Get('change-requests/pending')
  @Roles('BUSINESS_OWNER', 'BRANCH_MANAGER')
  @RequirePermission('change_request:approve:branch', 'change_request:approve:tenant')
  async pendingChangeRequests(@CurrentUser() user: AuthUser) {
    const allowedBusinessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const allowedBranchIds = (
      await Promise.all(
        allowedBusinessIds.map(async (businessId) =>
          (await resolveBranchIdsForUser(this.prisma, user, businessId)) ?? [],
        ),
      )
    ).flat();
    return this.changeRequestsService.listPending(allowedBusinessIds, allowedBranchIds);
  }

  /**
   * POST /api/bookings/:id/refund — Platform-only manual refund.
   */
  @Post(':id/refund')
  @Roles('PLATFORM_ADMIN')
  @RequirePermission('refund:create:platform')
  @Audited({ action: AuditAction.REFUND, entityType: 'Booking' })
  async refundBooking(
    @Param('id') id: string,
    @Body() body: { amount: number; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertRefund(user, id);
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId: id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!payment) throw new BadRequestException('Booking chưa có payment có thể hoàn');
    return this.paymentsService.requestRefund(
      payment.id,
      body.amount,
      body.reason ?? 'Platform support request',
      undefined,
      user,
    );
  }

  /**
   * POST /api/bookings/:id/checkin — Receptionist marks customer arrived.
   */
  @Post(':id/checkin')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Booking' })
  @Roles('RECEPTIONIST', 'BRANCH_MANAGER', 'BUSINESS_OWNER')
  @RequirePermission('booking:check_in:branch', 'booking:check_in:tenant')
  async checkin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.bookingsAccess.assertWrite(user, id);
    return this.bookingsService.checkin(id, user.id, user.roles);
  }
}
