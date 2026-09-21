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
  restrictToRoles,
} from '../common/utils/multi-tenancy';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';
import { VouchersService } from './vouchers.service';
import { isPlatformRole } from '../common/utils/scope-helpers';
import { AuditAction } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { randomUUID } from 'crypto';
import { BookingItemsService } from './booking-items.service';
import { applyServicePriceRules } from '../services/service-price-rules';
import { assertBookingChannelAllowed, resolveBookingSource } from './booking-channel-policy';
import { canOnResource, ensureCanOnResource } from '../common/utils/policy';
import { assertCustomerPrincipal, isCustomerPrincipal } from '../auth/account-separation';
import { readCustomerBookingPolicy } from './customer-booking-policy';

/**
 * RBAC decisions go through @RequireScope + @RequirePermission +
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
    private readonly bookingItemsService: BookingItemsService,
  ) {}

  private async counterBranchIds(user: AuthUser, branchIds: string[]) {
    if (!branchIds.length) return [];
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds }, deletedAt: null },
      select: { id: true, businessId: true },
    });
    return branches.filter((branch) => this.bookingsAccess.canReadBranch(user,
      { businessId: branch.businessId, branchId: branch.id })).map((branch) => branch.id);
  }

  private administrativePrincipal(user: AuthUser): AuthUser {
    return restrictToRoles(user, ['BUSINESS_OWNER', 'PLATFORM_ADMIN']);
  }

  private customerBookingView(booking: any) {
    return {
      id: booking.id,
      branchId: booking.branchId,
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
      cancelReason: booking.cancelReason,
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
        serviceId: item.serviceId,
        status: item.status,
        serviceNameSnapshot: item.serviceNameSnapshot,
        itemStartAt: item.itemStartAt,
        itemEndAt: item.itemEndAt,
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
      violationSummary: booking.violationSummary,
      changeRequests: (booking.changeRequests ?? []).map((request: any) => ({
        id: request.id, requestType: request.requestType, status: request.status,
        reason: request.reason, reviewNote: request.reviewNote,
        createdAt: request.createdAt, expiresAt: request.expiresAt,
        violationEvent: request.violationEvent ? { kind: request.violationEvent.kind,
          occurredAt: request.violationEvent.occurredAt, voidedAt: request.violationEvent.voidedAt } : null,
      })),
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
  @Get('self-booking-policy')
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  async selfBookingPolicy(@Query('branchId') branchId: string, @CurrentUser() user: AuthUser) {
    assertCustomerPrincipal(user);
    if (!branchId) throw new BadRequestException('Cần chọn chi nhánh');
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, status: 'ACTIVE', deletedAt: null,
      business: { status: { in: ['APPROVED', 'ACTIVE'] }, deletedAt: null } },
      select: { businessId: true, business: { select: { name: true } } } });
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!branch || !customer) throw new BadRequestException('Chi nhánh hoặc hồ sơ khách hàng không hợp lệ');
    return { ...await readCustomerBookingPolicy(this.prisma, customer.id, branch.businessId), businessName: branch.business.name };
  }

  @Post('guest')
  @Roles('CUSTOMER')
  @RequirePermission('booking:create:self')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async createGuest(
    @Body() body: CreateGuestBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertCustomerPrincipal(user);
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
      violationAcknowledged: body.violationAcknowledged,
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
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'CUSTOMER')
  @RequirePermission(
    'booking:create:self',
    'booking:create:tenant',
    'booking:create:branch',
  )
  async create(@Body() body: CreateBookingDto, @CurrentUser() user: AuthUser) {
    const businessId = await this.bookingsAccess.assertCustomerCreate(user, body.branchId);
    const customerOnly = isCustomerPrincipal(user);
    if (!customerOnly && !body.customerId && !body.guestName?.trim()) {
      throw new ForbiddenException('Dùng tài khoản CUSTOMER riêng để tự đặt lịch; đặt tại quầy phải chọn khách hàng hoặc khách vãng lai.');
    }
    const mayOverbook = canOnResource(user, 'booking:create:tenant', { businessId, branchId: body.branchId });
    const requestedSource = resolveBookingSource(customerOnly, body.source, Boolean(body.guestName?.trim()));
    // Check the branch channel policy before creating a walk-in shadow
    // customer. The service repeats this check as defence in depth, while
    // this early guard prevents rejected requests from leaving orphan users.
    if (!customerOnly) {
      const policy = await this.prisma.branchBookingPolicy.findUnique({
        where: { branchId: body.branchId },
        select: { allowWalkIn: true, allowCounterBooking: true },
      });
      assertBookingChannelAllowed(requestedSource, policy);
    }
    if (body.controlledOverbooking && !mayOverbook) {
      throw new ForbiddenException('Chỉ chủ doanh nghiệp được phép overbooking có kiểm soát');
    }
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
      source: requestedSource,
      guestContact: body.guestName
        ? { fullName: body.guestName.trim(), phone: body.guestPhone?.trim() || null }
        : undefined,
      controlledOverbooking: body.controlledOverbooking === true && mayOverbook,
      overbookingReason: body.controlledOverbooking === true && mayOverbook
        ? body.overbookingReason?.trim()
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
    @Body('loyaltyPoints') loyaltyPoints: number | undefined,
    @Body('variantSelections') variantSelections: Record<string, string> | undefined,
    @Body('appointmentDate') appointmentDate: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if ((!serviceIds || serviceIds.length === 0) && !comboId) throw new BadRequestException('Chọn dịch vụ hoặc combo');
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    if (comboId) {
      const combo = await this.prisma.combo.findFirst({
        where: { id: comboId, branchId, status: 'ACTIVE', deletedAt: null },
      });
      if (!combo) throw new BadRequestException('Combo không hợp lệ');
      const subtotal = Number(combo.comboPrice);
      const comboItems = await this.prisma.comboService.findMany({
        where: { comboId },
        select: { serviceId: true, priceSnapshot: true, quantity: true },
      });
      const comboBase = comboItems.reduce((sum, item) => sum + Number(item.priceSnapshot) * item.quantity, 0) || subtotal;
      let allocated = 0;
      const lineItems = comboItems.map((item, index) => {
        const amount = index === comboItems.length - 1
          ? subtotal - allocated
          : Math.round(subtotal * Number(item.priceSnapshot) * item.quantity / comboBase);
        allocated += amount;
        return { serviceId: item.serviceId, amount };
      });
      return this.vouchersService.preview({
        customerId: customer.id,
        branchId,
        voucherCode: voucherCode ?? '',
        subtotal,
        comboId,
        serviceIds: comboItems.map((item) => item.serviceId),
        lineItems,
        loyaltyPoints,
      });
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
    const variantIds = Object.values(variantSelections ?? {});
    const variants = variantIds.length
      ? await this.prisma.serviceVariant.findMany({
          where: { id: { in: variantIds }, serviceId: { in: serviceIds }, status: 'ACTIVE', deletedAt: null },
        })
      : [];
    if (variants.length !== new Set(variantIds).size) throw new BadRequestException('Biến thể dịch vụ không hợp lệ');
    const variantsByService = new Map(variants.map((variant) => [variant.serviceId, variant]));
    for (const [serviceId, variantId] of Object.entries(variantSelections ?? {})) {
      const variant = variantsByService.get(serviceId);
      if (!variant || variant.id !== variantId) throw new BadRequestException('Biến thể không thuộc dịch vụ đã chọn');
      if (variant.priceType === 'QUOTE') {
        throw new BadRequestException('Lựa chọn này cần báo giá trước khi đặt trực tuyến');
      }
    }
    const pricingAt = appointmentDate ? new Date(appointmentDate) : new Date();
    if (!Number.isFinite(pricingAt.getTime())) throw new BadRequestException('appointmentDate không hợp lệ');
    const rules = await this.prisma.servicePriceRule.findMany({
      where: {
        serviceId: { in: serviceIds }, active: true,
        OR: [{ validFrom: null }, { validFrom: { lte: pricingAt } }],
        AND: [{ OR: [{ validTo: null }, { validTo: { gte: pricingAt } }] }],
      },
    });
    const lineItems = services.map((service) => {
      const variant = variantsByService.get(service.id);
      const amount = applyServicePriceRules({
        basePrice: Number(variant?.price ?? service.price),
        at: pricingAt,
        variantId: variant?.id,
        rules: rules.filter((rule) => rule.serviceId === service.id),
      }).amount;
      return { serviceId: service.id, amount };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    return this.vouchersService.preview({
      customerId: customer.id,
      branchId,
      voucherCode: voucherCode ?? '',
      subtotal,
      serviceIds,
      lineItems,
      loyaltyPoints,
    });
  }

  /**
   * GET /api/bookings — role-aware list.
   * - PLATFORM_ADMIN: global read via explicit platform permission
   * - BUSINESS_OWNER: tenant-scoped
   * - RECEPTIONIST/STAFF: branch-scoped
   * - CUSTOMER: own bookings only
   */
  @Get()
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
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
        ['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'].includes(
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
    let allowed = [...new Set((await Promise.all(
      allowedBusinessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
    )).flatMap((ids) => ids ?? []))];
    const counterBranches = await this.counterBranchIds(user, branchId ? allowed.filter((id) => id === branchId) : allowed);
    const staffOnly = counterBranches.length === 0;
    if (!staffOnly) allowed = counterBranches;
    const requestedBranchAllowed = !branchId || allowed.includes(branchId);
    const scopedRequestedBranchIds = requestedBranchIds?.filter((id) => allowed.includes(id));
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
          select: { id: true, requestType: true, status: true, reason: true, reviewNote: true, createdAt: true, expiresAt: true },
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
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF')
  @RequirePermission('booking:read:branch', 'booking:read:tenant')
  async salonQueue(@CurrentUser() user: AuthUser) {
    const allowedBusinessIds = await resolveBusinessIdsForUser(this.prisma, user);
    let allowedBranchIds = (
      await Promise.all(
        allowedBusinessIds.map(async (businessId) =>
          (await resolveBranchIdsForUser(this.prisma, user, businessId)) ?? [],
        ),
      )
    ).flat();
    const counterBranches = await this.counterBranchIds(user, allowedBranchIds);
    const staffOnly = counterBranches.length === 0;
    if (!staffOnly) allowedBranchIds = counterBranches;
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
   * Platform-wide audits or the owner's own business booking audits.
   */
  @Get('salon-violations')
  @Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')
  @RequirePermission('audit:read:tenant', 'audit:read:platform')
  async salonViolations(@CurrentUser() user: AuthUser) {
    user = this.administrativePrincipal(user);
    if (!isPlatformRole(user)) {
      // Salon owners can only see THEIR OWN violations, not the global list.
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
    @Query('variantSelections') rawVariantSelections?: string,
  ) {
    if (!branchId || !serviceIds || !date) {
      throw new BadRequestException('branchId, serviceIds, date are required');
    }
    let variantSelections: Record<string, string> = {};
    if (rawVariantSelections) {
      try { variantSelections = JSON.parse(rawVariantSelections); }
      catch { throw new BadRequestException('variantSelections không hợp lệ'); }
    }
    return this.bookingsService.getAvailableSlots({
      branchId,
      staffId: staffId || null,
      serviceIds: serviceIds.split(',').filter(Boolean),
      date,
      variantSelections,
    });
  }

  @Get('scheduler')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF')
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
    const businessId = await assertBranchAccess(this.prisma, user, branchId);
    const staffOnly = !this.bookingsAccess.canReadBranch(user, { businessId, branchId });
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
  )
  @RequirePermission('report:overview:tenant', 'report:overview:platform', 'report:revenue:platform')
  async getStats(@CurrentUser() user: AuthUser) {
    user = this.administrativePrincipal(user);
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
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async getByCategory(@Query('name') name: string, @CurrentUser() user: AuthUser) {
    user = this.administrativePrincipal(user);
    if (isPlatformRole(user)) return this.bookingsService.getByCategory(name);
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    const branchIds = [...new Set((await Promise.all(
      businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
    )).flatMap((ids) => ids ?? []))];
    return this.bookingsService.getByCategory(name, branchIds);
  }

  @Get('by-branch/:branchId')
  @Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  @RequireScope({
    roles: ['BUSINESS_OWNER', 'RECEPTIONIST', 'PLATFORM_ADMIN'],
    scopeLevel: 'branch',
    permissions: ['booking:read:branch', 'booking:read:tenant', 'booking:read:platform'],
  })
  async getByBranch(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertReadBranch(user, branchId);
    return this.bookingsService.getByBranch(branchId);
  }

  @Get('by-customer/:userId')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
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
        ['BUSINESS_OWNER', 'RECEPTIONIST'].includes(s.code),
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
    return this.bookingsService.getByCustomer(userId, await this.counterBranchIds(user, branchIds));
  }

  @Get(':id')
  @Roles(
    'PLATFORM_ADMIN',
    'BUSINESS_OWNER',
    'RECEPTIONIST',
    'STAFF',
    'CUSTOMER',
  )
  @RequirePermission('booking:read:self', 'booking:read:branch', 'booking:read:tenant', 'booking:read:platform')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const booking = await this.bookingsService.findOne(id);
    const roleCodes = new Set([
      ...(user.roles || []),
      ...(user.scopes || []).map((scope) => scope.code),
    ]);
    const customerOnly =
      roleCodes.has('CUSTOMER') &&
      !['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF']
        .some((role) => roleCodes.has(role));
    // Service-level access check via BookingsAccessService
    const isPlatform = isPlatformRole(user);
    if (!isPlatform) {
      const readPermission = customerOnly
        ? 'booking:read:self'
        : roleCodes.has('BUSINESS_OWNER')
          ? 'booking:read:tenant'
          : 'booking:read:branch';
      const info = await this.bookingsAccess.loadAndAssert(
        user,
        id,
        readPermission,
      );
      if (!customerOnly && !this.bookingsAccess.canReadBranch(user, info) && info.staffUserId !== user.id) {
        throw new BadRequestException('Nhân viên chỉ được xem lịch được phân công cho mình');
      }
    }
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
    'RECEPTIONIST',
  )
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  @Audited({ action: AuditAction.STATUS_CHANGE, entityType: 'Booking' })
  async actionRouter(
    @Param('id') id: string,
    @Body() body: BookingActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const access = await this.bookingsAccess.assertWrite(user, id,
      body.action === BookingAction.RESCHEDULE ? 'reschedule' : 'update');
    if (body.action === BookingAction.RESCHEDULE && body.newStaffId) {
      await this.bookingsAccess.assertWrite(user, id, 'assign');
    }
    const actorRoles = this.bookingsAccess.rolesAtResource(user, access);
    const changedByType = isPlatformRole(user) ? 'ADMIN' : 'SALON';

    switch (body.action) {
      case BookingAction.CONFIRM:
        return this.bookingsService.updateStatus(
          id,
          'CONFIRMED',
          user.id,
          body.reason,
          changedByType,
          actorRoles,
        );

      case BookingAction.AUTO_ACCEPT:
        // auto_accept giữ nhánh riêng để audit phân biệt với confirm thủ công.
        return this.bookingsService.updateStatus(
          id,
          'CONFIRMED',
          user.id,
          body.reason ?? 'auto_accept',
          changedByType,
          actorRoles,
        );

      case BookingAction.REJECT:
        return this.bookingsService.updateStatus(
          id,
          'REJECTED',
          user.id,
          body.reason ?? 'Salon từ chối lịch hẹn',
          changedByType,
          actorRoles,
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
    const cancellation = ['CANCELLED', 'Đã huỷ'].includes(body.status);
    const intent =
      cancellation && isPlatformRole(user)
        ? 'force_cancel'
        : 'normal';
    let actorRoles = user.roles;
    if (intent === 'force_cancel') {
      if (!body.note?.trim()) {
        throw new BadRequestException('Lý do force-cancel là bắt buộc');
      }
      await this.bookingsAccess.assertForceCancel(user, id);
    } else {
      const access = await this.bookingsAccess.assertWrite(user, id,
        cancellation ? 'cancel' : body.status === 'CHECKED_IN' ? 'check_in'
          : ['COMPLETED', 'Hoàn thành'].includes(body.status) ? 'complete' : 'update');
      actorRoles = this.bookingsAccess.rolesAtResource(user, access);
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
      actorRoles,
      body.noShowConfirmed,
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
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:reschedule:branch', 'booking:update:tenant')
  async moveBooking(
    @Param('id') id: string,
    @Body() body: MoveBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id, 'reschedule');
    if (body.newStaffId) await this.bookingsAccess.assertWrite(user, id, 'assign');
    return this.bookingsService.moveBooking(
      id,
      body.newStartTime,
      body.newEndTime,
      body.newStaffId,
    );
  }

  @Patch(':id/resize')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  async resizeBooking(
    @Param('id') id: string,
    @Body() body: ResizeBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const access = await this.bookingsAccess.assertWrite(user, id);
    ensureCanOnResource(user, 'booking:update:tenant', access);
    return this.bookingsService.resizeBooking(id, body.newEndTime);
  }

  @Patch(':id/assign')
  @Audited({ action: AuditAction.UPDATE, entityType: 'Booking' })
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:assign:branch', 'booking:assign:tenant')
  async assignStaff(
    @Param('id') id: string,
    @Body() body: AssignStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.bookingsAccess.assertWrite(user, id, 'assign');
    return this.bookingsService.assignStaff(id, body.staffId);
  }

  @Post(':id/items')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
  @RequirePermission('booking:update:branch', 'booking:update:tenant')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BookingService' })
  async addBookingItem(
    @Param('id') id: string,
    @Body() body: {
      serviceId: string;
      variantId?: string;
      staffId?: string;
      reason: string;
      durationMinutes?: number;
      price?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const access = await this.bookingsAccess.assertWrite(user, id);
    const actorRoles = this.bookingsAccess.rolesAtResource(user, access);
    const owner = actorRoles.includes('BUSINESS_OWNER');
    if (!owner && !actorRoles.includes('RECEPTIONIST')) {
      throw new ForbiddenException('Chỉ lễ tân tại chi nhánh hoặc chủ doanh nghiệp được thêm dịch vụ');
    }
    if (!owner && (body.price !== undefined || body.durationMinutes !== undefined)) {
      throw new ForbiddenException('Chỉ chủ doanh nghiệp được điều chỉnh giá hoặc thời lượng dịch vụ');
    }
    if (body.staffId) await this.bookingsAccess.assertWrite(user, id, 'assign');
    return this.bookingItemsService.add(id, user.id, body);
  }

  @Patch(':id/items/:itemId')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF')
  @RequirePermission('booking:update:branch', 'booking:update:tenant', 'booking:complete:branch')
  @Audited({ action: AuditAction.UPDATE, entityType: 'BookingService', idParam: 'itemId' })
  async updateBookingItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: {
      action: 'REMOVE' | 'SKIP' | 'REASSIGN' | 'START' | 'COMPLETE' | 'RESIZE' | 'REPRICE';
      reason: string;
      expectedRevision: number;
      staffId?: string;
      durationMinutes?: number;
      price?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const access = await this.bookingsAccess.assertWrite(user, id,
      body.action === 'REASSIGN' ? 'assign' : ['REMOVE', 'SKIP'].includes(body.action) ? 'cancel'
        : body.action === 'COMPLETE' ? 'complete' : 'update');
    const actorRoles = this.bookingsAccess.rolesAtResource(user, access);
    const owner = actorRoles.includes('BUSINESS_OWNER');
    const staffOnly = actorRoles.includes('STAFF') && !owner && !actorRoles.includes('RECEPTIONIST');
    if (staffOnly && !['START', 'COMPLETE'].includes(body.action)) {
      throw new ForbiddenException('Nhân viên chỉ có thể bắt đầu hoặc hoàn thành dịch vụ được giao');
    }
    if (['REPRICE', 'RESIZE'].includes(body.action) && !owner) {
      throw new ForbiddenException('Chỉ chủ doanh nghiệp được điều chỉnh giá hoặc thời lượng dịch vụ');
    }
    const serviceLifecycle = ['START', 'COMPLETE'].includes(body.action);
    if (serviceLifecycle && !owner && !actorRoles.includes('STAFF')) {
      throw new ForbiddenException('Chỉ nhân viên được giao hoặc chủ doanh nghiệp được thực hiện dịch vụ');
    }
    return this.bookingItemsService.update(id, itemId, user.id, body,
      serviceLifecycle && !owner ? { assignedStaffUserId: user.id } : undefined);
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
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
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
    const businessId = await assertBranchAccess(this.prisma, user, request.booking.branchId);
    this.assertChangeRequestPermission(user, businessId, request.booking.branchId);
    return this.changeRequestsService.approve(reqId, user.id, body.reviewNote);
  }

  @Patch('change-requests/:reqId/reject')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
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
    const businessId = await assertBranchAccess(this.prisma, user, request.booking.branchId);
    this.assertChangeRequestPermission(user, businessId, request.booking.branchId);
    return this.changeRequestsService.reject(reqId, user.id, body.reviewNote);
  }

  @Get('change-requests/pending')
  @Roles('BUSINESS_OWNER', 'RECEPTIONIST')
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
    return this.changeRequestsService.listPending(allowedBusinessIds, await this.counterBranchIds(user, allowedBranchIds));
  }

  private assertChangeRequestPermission(user: AuthUser, businessId: string, branchId: string) {
    if (!['change_request:approve:branch', 'change_request:approve:tenant'].some((permission) =>
      canOnResource(user, permission, { businessId, branchId }),
    )) throw new ForbiddenException('Bạn không có quyền xử lý yêu cầu thay đổi tại chi nhánh này');
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
  @Roles('RECEPTIONIST', 'BUSINESS_OWNER')
  @RequirePermission('booking:check_in:branch', 'booking:check_in:tenant')
  async checkin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const access = await this.bookingsAccess.assertWrite(user, id, 'check_in');
    return this.bookingsService.checkin(id, user.id, this.bookingsAccess.rolesAtResource(user, access));
  }
}
