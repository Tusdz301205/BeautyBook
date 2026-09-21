import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ALL_TENANTS, assertBranchAccess, restrictToRoles, resolveBranchIdsForUser, resolveBusinessIdsForUser } from '../common/utils/multi-tenancy';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { bookableStaffWhere, professionalTitle, staffRating } from '../staff/bookable-staff';
import { BranchStateService } from './branch-state.service';
import { SaveBranchOnboardingDto } from './dto/branch.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

function formatWorkingTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function summarizeWorkingHours(hours: Array<{ dayOfWeek: number; openTime: Date; closeTime: Date; isClosed: boolean }>) {
  const openDays = hours.filter((item) => !item.isClosed).sort((left, right) => left.dayOfWeek - right.dayOfWeek);
  if (!openDays.length) return null;
  const first = openDays[0];
  return {
    openTime: formatWorkingTime(first.openTime),
    closeTime: formatWorkingTime(first.closeTime),
    openDays: openDays.map((item) => item.dayOfWeek),
    summary: `${formatWorkingTime(first.openTime)} - ${formatWorkingTime(first.closeTime)}`,
  };
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly branchState: BranchStateService,
  ) {}

  /**
   * Lấy danh sách cơ sở/chi nhánh (cho Admin và filters)
   */
  listDistricts() {
    return this.prisma.district.findMany({
      select: {
        id: true,
        name: true,
        province: { select: { id: true, name: true } },
      },
      orderBy: [{ province: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async findAll(
    query?: {
      search?: string; status?: string; categoryId?: string; districtId?: string; area?: string;
      serviceQuery?: string; minPrice?: number; maxPrice?: number; sort?: string;
      page?: number; limit?: number;
    },
    includeNonPublic = false,
  ) {
    const { search, status, categoryId, districtId, area, serviceQuery, sort } = query || {};
    const page = Math.max(1, Number(query?.page) || 1);
    const defaultLimit = includeNonPublic ? 100 : 50;
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || defaultLimit));

    const where: any = {
      deletedAt: null,
      ...(includeNonPublic ? {} : {
        status: 'ACTIVE',
        reviewStatus: 'APPROVED',
        operationalStatus: 'ACTIVE',
        business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
        services: { some: { status: 'ACTIVE', deletedAt: null } },
        staff: { some: bookableStaffWhere({ publicOnly: true }) },
      }),
    };
    if (includeNonPublic && status && status !== 'Tất cả') {
      const statusMap: Record<string, string> = {
        'Hoạt động': 'ACTIVE',
        'Chờ duyệt': 'PENDING',
        'Ngừng hoạt động': 'INACTIVE',
      };
      const enums = ['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED', 'REJECTED'];
      if (enums.includes(status)) where.status = status;
      else if (statusMap[status]) where.status = statusMap[status];
    }

    if (districtId) where.districtId = districtId;
    if (area) {
      where.district = {
        OR: [
          { name: { contains: area, mode: 'insensitive' } },
          { province: { name: { contains: area, mode: 'insensitive' } } },
        ],
      };
    }

    const minPrice = Number(query?.minPrice);
    const maxPrice = Number(query?.maxPrice);
    const matchedServiceWhere: any = {
      deletedAt: null,
      ...(!includeNonPublic ? { status: 'ACTIVE' } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(serviceQuery ? { name: { contains: serviceQuery, mode: 'insensitive' } } : {}),
      ...((Number.isFinite(minPrice) && minPrice >= 0) || (Number.isFinite(maxPrice) && maxPrice >= 0)
        ? { price: {
            ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}),
            ...(Number.isFinite(maxPrice) && maxPrice >= 0 ? { lte: maxPrice } : {}),
          } }
        : {}),
    };
    if (categoryId || serviceQuery || Object.keys(matchedServiceWhere.price ?? {}).length) {
      where.services = { some: matchedServiceWhere };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { business: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const branches = await this.prisma.branch.findMany({
      where,
      include: {
        business: { select: { id: true, name: true, status: true, description: true } },
        district: {
          include: { province: { select: { name: true } } },
        },
        _count: {
          select: {
            services: { where: matchedServiceWhere },
            bookings: { where: { deletedAt: null } },
            staff: { where: bookableStaffWhere({ publicOnly: true }) },
          },
        },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        images: {
          where: { media: { visibility: 'PUBLIC' } },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { media: { select: { url: true } } },
        },
        services: {
          where: matchedServiceWhere,
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
            category: { select: { id: true, name: true } },
            _count: { select: { bookingServices: true } },
          },
        },
      },
      orderBy: sort === 'popular' ? { bookings: { _count: 'desc' } } : { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Aggregate only the current page in PostgreSQL. Never hydrate all
    // bookings/reviews merely to calculate marketplace cards.
    const branchIds = branches.map((branch) => branch.id);
    const ratingRows = branchIds.length
      ? await this.prisma.$queryRaw<Array<{ branchId: string; rating: unknown }>>(Prisma.sql`
          SELECT b.branch_id AS "branchId", AVG(r.overall_rating)::numeric(4,2) AS rating
          FROM bookings b
          JOIN reviews r ON r.booking_id = b.id
          WHERE b.branch_id IN (${Prisma.join(branchIds)})
            AND b.deleted_at IS NULL
            AND r.deleted_at IS NULL
            AND r.status = 'APPROVED'
          GROUP BY b.branch_id
        `)
      : [];
    const ratingByBranch = new Map(
      ratingRows.map((row) => [row.branchId, Number(row.rating) || 0]),
    );

    const result = branches.map((b) => ({
      id: b.id,
      businessId: b.businessId,
      name: b.business?.name || b.name,
      branch_name: b.name,
      address: b.addressLine,
      category: b.services[0]?.category?.name || 'Chưa phân nhóm',
      categories: [...new Map(b.services.map((service) => [service.category.id, service.category])).values()],
      categoryServiceCount: b._count.services,
      district: `${b.district?.name || ''}, ${b.district?.province?.name || ''}`,
      districtId: b.districtId,
      rating: Math.round((ratingByBranch.get(b.id) ?? 0) * 10) / 10,
      services: b._count.services,
      bookings: b._count.bookings,
      minPrice: b.services.length ? Math.min(...b.services.map((service) => Number(service.price))) : null,
      maxPrice: b.services.length ? Math.max(...b.services.map((service) => Number(service.price))) : null,
      coverImage: b.images[0]?.media.url ?? null,
      workingHours: summarizeWorkingHours(b.workingHours),
      description: b.business?.description ?? null,
      totalStaff: b._count.staff,
      topServices: [...b.services]
        .sort((left, right) => right._count.bookingServices - left._count.bookingServices)
        .slice(0, 5)
        .map((service) => ({
          id: service.id,
          name: service.name,
          price: Number(service.price),
          duration: service.durationMinutes,
        })),
      status: b.status,
    }));
    if (sort === 'rating') return result.sort((a, b) => b.rating - a.rating);
    if (sort === 'price_asc') return result.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    if (sort === 'price_desc') return result.sort((a, b) => (b.maxPrice ?? -1) - (a.maxPrice ?? -1));
    return result;
  }

  async findAccessible(user: AuthUser) {
    const businessIds = await resolveBusinessIdsForUser(this.prisma, user);
    if (!businessIds.length) return [];

    let where: any = { deletedAt: null };
    if (!businessIds.includes(ALL_TENANTS)) {
      const branchScoped = user.roles.some((role) => ['RECEPTIONIST', 'STAFF'].includes(role));
      if (branchScoped) {
        const branchIds = (await Promise.all(
          businessIds.map((businessId) => resolveBranchIdsForUser(this.prisma, user, businessId)),
        )).flatMap((ids) => ids ?? []);
        where = { ...where, id: { in: branchIds } };
      } else {
        where = { ...where, businessId: { in: businessIds } };
      }
    }

    return this.prisma.branch.findMany({
      where,
      select: {
        id: true,
        businessId: true,
        name: true,
        publicName: true,
        status: true,
        reviewStatus: true,
        operationalStatus: true,
        bookingPolicy: {
          select: { allowWalkIn: true, allowCounterBooking: true },
        },
        onboardingProgress: {
          select: { currentStep: true, completedSteps: true, updatedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lấy chi tiết chi nhánh
   */
  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            status: true,
            logoMediaId: true,
            bookingRestrictedAt: true,
            bookingRestrictionReason: true,
          },
        },
        district: { include: { province: true } },
        workingHours: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          include: { media: true },
        },
        staff: {
          where: { deletedAt: null },
          include: { user: { select: { fullName: true } } },
        },
        services: {
          where: { deletedAt: null },
          include: { category: true },
        },
        combos: {
          where: { deletedAt: null },
          include: {
            comboServices: {
              include: { service: { select: { id: true, name: true, status: true } } },
            },
          },
        },
        staffAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            staff: {
              select: {
                id: true,
                fullName: true,
                position: true,
                status: true,
                isBookable: true,
              },
            },
          },
        },
        onboardingProgress: true,
        bookingPolicy: true,
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { createdAt: 'desc' },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: {
                id: true,
                version: true,
                documentName: true,
                note: true,
                createdAt: true,
                media: {
                  select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    fileSize: true,
                    visibility: true,
                  },
                },
              },
            },
          },
        },
        reviewEvents: { orderBy: { createdAt: 'asc' } },
      },
    });
    return branch ? { ...branch, readiness: await this.getReadiness(id) } : null;
  }

  async findPublic(id: string) {
    return this.publicPresentation(id, false);
  }

  async previewPublic(id: string, user: AuthUser) {
    const owner = restrictToRoles(user, ['BUSINESS_OWNER']);
    if (!owner.roles.length || user.sessionType !== 'salon') {
      throw new ForbiddenException('Chỉ chủ doanh nghiệp được xem trước chi nhánh của mình');
    }
    await assertBranchAccess(this.prisma, owner, id);
    return this.publicPresentation(id, true);
  }

  /** Same projection in both modes; only publication filters differ. Never
   * return management documents, internal notes or private media URLs. */
  private async publicPresentation(id: string, preview: boolean) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(preview ? { business: { deletedAt: null } } : {
          status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE',
          business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
          services: { some: { status: 'ACTIVE', deletedAt: null } },
          staff: { some: bookableStaffWhere({ publicOnly: true }) },
        }),
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        addressLine: true,
        latitude: true,
        longitude: true,
        phone: true,
        status: true,
        reviewStatus: true,
        operationalStatus: true,
        district: { select: { id: true, name: true, province: { select: { id: true, name: true } } } },
        business: {
          select: {
            id: true, name: true, slug: true, description: true,
            contactPhone: true, logoMediaId: true,
          },
        },
        workingHours: true,
        images: {
          where: { media: { visibility: 'PUBLIC' } },
          select: { id: true, sortOrder: true, media: { select: { id: true, url: true, fileType: true } } },
        },
        services: {
          where: { ...(preview ? {} : { status: 'ACTIVE' as const }), deletedAt: null },
          include: { category: true },
        },
        staff: {
          where: preview ? { deletedAt: null, publicVisible: true } : bookableStaffWhere({ publicOnly: true }),
          select: {
            id: true, fullName: true, position: true, bio: true, experienceYears: true,
            user: { select: { avatarMedia: { select: { url: true, visibility: true } } } },
            staffServices: {
              where: { service: { ...(preview ? {} : { status: 'ACTIVE' as const }), deletedAt: null } },
              select: { service: { select: { id: true, name: true } } },
            },
            images: {
              where: { media: { visibility: 'PUBLIC' } },
              select: { media: { select: { url: true } } },
              orderBy: { sortOrder: 'asc' },
            },
            reviewRatings: {
              where: { review: { status: 'APPROVED', deletedAt: null } },
              select: { rating: true },
            },
          },
          orderBy: { fullName: 'asc' },
        },
      },
    });
    if (!branch) return null;
    const reviewWhere = {
      status: 'APPROVED' as const,
      deletedAt: null,
      booking: { branchId: id, deletedAt: null },
    };
    const [reviewStats, recentReviews] = await Promise.all([
      this.prisma.review.aggregate({
        where: reviewWhere,
        _avg: { overallRating: true },
        _count: true,
      }),
      this.prisma.review.findMany({
        where: reviewWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          overallRating: true,
          comment: true,
          isAnonymous: true,
          createdAt: true,
          customer: { select: { user: { select: { fullName: true } } } },
          serviceRatings: {
            where: { staffId: { not: null } },
            take: 1,
            select: { staff: { select: { fullName: true } } },
          },
        },
      }),
    ]);
    const servicesByCategory = [...branch.services.reduce((groups, service) => {
      const key = service.category.id;
      const group = groups.get(key) ?? {
        categoryId: key,
        categoryName: service.category.name,
        services: [],
      };
      group.services.push({
        id: service.id,
        name: service.name,
        description: service.description,
        price: Number(service.price),
        duration: service.durationMinutes,
        status: service.status,
      });
      groups.set(key, group);
      return groups;
    }, new Map<string, {
      categoryId: string;
      categoryName: string;
      services: Array<{ id: string; name: string; description: string | null; price: number; duration: number; status: string }>;
    }>()).values()];
    return {
      ...branch,
      servicesByCategory,
      stats: {
        totalServices: branch.services.length,
        totalStaff: branch.staff.length,
        averageRating: Math.round(Number(reviewStats._avg.overallRating ?? 0) * 10) / 10,
        totalReviews: reviewStats._count,
      },
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        customerName: review.isAnonymous ? 'Ẩn danh' : review.customer.user.fullName,
        rating: review.overallRating,
        comment: review.comment,
        createdAt: review.createdAt,
        staffName: review.serviceRatings[0]?.staff?.fullName,
      })),
      staff: branch.staff.map(({ user, images, reviewRatings, position, ...item }) => ({
        ...item,
        images,
        professionalTitle: professionalTitle(position),
        specialties: item.staffServices.map((entry) => entry.service.name),
        avatarUrl: user?.avatarMedia?.visibility === 'PUBLIC'
          ? user.avatarMedia.url
          : images[0]?.media?.url || null,
        ...staffRating(reviewRatings),
      })),
    };
  }

  async findPublicServices(id: string, query: { categoryId?: string; search?: string; page?: number; limit?: number }) {
    const branch = await this.findPublicBranchIdentity(id);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.BranchServiceOfferingWhereInput = {
      branchId: branch.id,
      status: 'ACTIVE',
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };
    const [services, total] = await Promise.all([
      this.prisma.branchServiceOffering.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.branchServiceOffering.count({ where }),
    ]);
    const data = [...services.reduce((groups, service) => {
      const group = groups.get(service.category.id) ?? {
        categoryId: service.category.id,
        categoryName: service.category.name,
        services: [],
      };
      group.services.push({
        id: service.id,
        name: service.name,
        description: service.description,
        price: Number(service.price),
        duration: service.durationMinutes,
        status: service.status,
      });
      groups.set(service.category.id, group);
      return groups;
    }, new Map<string, { categoryId: string; categoryName: string; services: Array<Record<string, unknown>> }>()).values()];
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findPublicReviews(id: string, query: { sort?: 'newest' | 'highest' | 'lowest'; page?: number; limit?: number }) {
    const branch = await this.findPublicBranchIdentity(id);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.ReviewWhereInput = {
      status: 'APPROVED',
      deletedAt: null,
      booking: { branchId: branch.id, deletedAt: null },
    };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] = query.sort === 'highest'
      ? [{ overallRating: 'desc' }, { createdAt: 'desc' }]
      : query.sort === 'lowest'
        ? [{ overallRating: 'asc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const [reviews, total, summary] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          overallRating: true,
          comment: true,
          isAnonymous: true,
          createdAt: true,
          customer: {
            select: {
              user: { select: { fullName: true, avatarMedia: { select: { url: true, visibility: true } } } },
            },
          },
          serviceRatings: {
            select: {
              rating: true,
              comment: true,
              staff: { select: { fullName: true } },
              bookingService: { select: { serviceNameSnapshot: true } },
            },
          },
          businessReply: { select: { content: true, createdAt: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { overallRating: true } }),
    ]);
    return {
      data: reviews.map((review) => ({
        id: review.id,
        customerName: review.isAnonymous ? 'Ẩn danh' : review.customer.user.fullName,
        customerAvatar: review.isAnonymous || review.customer.user.avatarMedia?.visibility !== 'PUBLIC'
          ? null
          : review.customer.user.avatarMedia.url,
        rating: review.overallRating,
        comment: review.comment,
        createdAt: review.createdAt,
        serviceRatings: review.serviceRatings.map((rating) => ({
          serviceName: rating.bookingService.serviceNameSnapshot,
          staffName: rating.staff?.fullName,
          rating: rating.rating,
          comment: rating.comment,
        })),
        businessReply: review.businessReply,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { averageRating: Math.round(Number(summary._avg.overallRating ?? 0) * 10) / 10, totalReviews: total },
    };
  }

  private async findPublicBranchIdentity(id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        reviewStatus: 'APPROVED',
        operationalStatus: 'ACTIVE',
        deletedAt: null,
        business: { status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null, deletedAt: null },
        services: { some: { status: 'ACTIVE', deletedAt: null } },
        staff: { some: bookableStaffWhere({ publicOnly: true }) },
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Cơ sở không tồn tại hoặc chưa được công khai');
    return branch;
  }

  /**
   * Cập nhật trạng thái chi nhánh (duyệt/ngừng)
   */
  async updateStatus(id: string, status: string, reason?: string) {
    const decisionMap: Record<string, 'APPROVE' | 'REQUEST_INFO' | 'REJECT'> = {
      APPROVED: 'APPROVE',
      ACTIVE: 'APPROVE',
      'Hoạt động': 'APPROVE',
      REQUEST_INFO: 'REQUEST_INFO',
      NEED_MORE_INFO: 'REQUEST_INFO',
      PENDING: 'REQUEST_INFO',
      'Chờ duyệt': 'REQUEST_INFO',
      REJECTED: 'REJECT',
      INACTIVE: 'REJECT',
      'Ngừng hoạt động': 'REJECT',
    };
    const decision = decisionMap[status];
    if (!decision) {
      throw new BadRequestException('Trạng thái review chi nhánh không hợp lệ');
    }
    // Compatibility route: it can review a branch, but never publishes it.
    return this.review(id, decision, reason, null);
  }

  /** Create a new branch under a business. Caller-side assertBusinessAccess
   *  already verified the principal has rights to the business. */
  async create(data: {
    businessId: string;
    name?: string;
    sameLegalEntity?: boolean;
    serviceMode?: 'AT_LOCATION' | 'MOBILE' | 'BOTH';
    addressLine?: string;
    districtId?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
  }, actorId?: string) {
    if (data.sameLegalEntity === false) {
      return {
        created: false,
        requiresNewBusiness: true,
        redirectTo: '/register/business',
        reason: 'Cơ sở khác pháp nhân phải được đăng ký thành doanh nghiệp mới.',
      };
    }
    const business = await this.prisma.business.findFirst({
      where: { id: data.businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        bookingRestrictedAt: true,
        bookingRestrictionReason: true,
      },
    });
    if (!business || !['APPROVED', 'ACTIVE'].includes(business.status)) {
      throw new ForbiddenException('Doanh nghiệp phải được duyệt trước khi tạo chi nhánh');
    }
    if (business.bookingRestrictedAt) {
      throw new ForbiddenException(
        business.bookingRestrictionReason || 'Doanh nghiệp đang bị hạn chế tạo chi nhánh.',
      );
    }
    const policy = await this.settings.getEffective();
    const branchCount = await this.prisma.branch.count({ where: { businessId: data.businessId, deletedAt: null } });
    if (branchCount >= policy.maxBranchesPerBusiness) {
      throw new ConflictException('Doanh nghiệp đã đạt giới hạn số chi nhánh cho phép.');
    }
    if (data.addressLine?.trim() && data.districtId) {
      const duplicate = await this.prisma.branch.findFirst({
        where: {
          businessId: data.businessId,
          districtId: data.districtId,
          addressLine: { equals: data.addressLine.trim(), mode: 'insensitive' },
          reviewStatus: { in: ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'NEED_MORE_INFO', 'APPROVED'] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Đã có chi nhánh hoặc hồ sơ nháp tại địa chỉ này.');
      }
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          businessId: data.businessId,
          name: data.name?.trim() || `Chi nhánh mới của ${business.name}`,
          sameLegalEntity: true,
          serviceMode: data.serviceMode ?? 'AT_LOCATION',
          addressLine: data.addressLine?.trim() || null,
          districtId: data.districtId || null,
          latitude: data.latitude as any,
          longitude: data.longitude as any,
          phone: data.phone,
          status: 'PENDING',
          reviewStatus: 'DRAFT',
          operationalStatus: 'INACTIVE',
          onboardingProgress: {
            create: {
              currentStep: 1,
              completedSteps: [],
              draftData: {
                sameLegalEntity: true,
                serviceMode: data.serviceMode ?? 'AT_LOCATION',
              },
            },
          },
          bookingPolicy: { create: {} },
        },
      });
      if (actorId) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'CREATE',
            entityType: 'Branch',
            entityId: branch.id,
            newData: {
              businessId: branch.businessId,
              reviewStatus: branch.reviewStatus,
              operationalStatus: branch.operationalStatus,
            },
          },
        });
      }
      return branch;
    });
    return { created: true, branch: created };
  }

  async getReadiness(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: {
        status: true,
        reviewStatus: true,
        operationalStatus: true,
        serviceMode: true,
        serviceAreas: true,
        addressLine: true,
        districtId: true,
        phone: true,
        email: true,
        pendingHoldMinutes: true,
        bookingPolicy: { select: { confirmedAt: true } },
        business: { select: { status: true, bookingRestrictedAt: true, bookingRestrictionReason: true } },
        _count: {
          select: {
            services: { where: { status: 'ACTIVE', deletedAt: null } },
            staff: { where: bookableStaffWhere() },
            workingHours: { where: { isClosed: false } },
          },
        },
        combos: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: {
            id: true,
            name: true,
            comboServices: {
              select: {
                service: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    deletedAt: true,
                    staffServices: { select: { staffId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!branch) return { ready: false, reasons: ['Chi nhánh không tồn tại'] };
    const reasons: string[] = [];
    if (!['APPROVED', 'ACTIVE'].includes(branch.business.status)) reasons.push('Doanh nghiệp chưa được duyệt');
    if (branch.reviewStatus !== 'APPROVED') reasons.push('Chi nhánh chưa được duyệt');
    if (
      branch.serviceMode !== 'MOBILE' &&
      (!branch.addressLine || !branch.districtId)
    ) reasons.push('Chưa hoàn tất địa chỉ chi nhánh');
    if (
      branch.serviceMode === 'MOBILE' &&
      (!Array.isArray(branch.serviceAreas) || branch.serviceAreas.length === 0)
    ) reasons.push('Chưa cấu hình khu vực phục vụ tại nhà');
    if (!branch.phone && !branch.email) reasons.push('Chưa có thông tin liên hệ');
    if (!branch._count.services) reasons.push('Chưa có dịch vụ đang hoạt động');
    if (!branch._count.staff) reasons.push('Chưa có chuyên viên được bật nhận lịch');
    if (!branch._count.workingHours) reasons.push('Chưa cấu hình giờ mở cửa');
    if (!branch.bookingPolicy?.confirmedAt) reasons.push('Chưa xác nhận chính sách đặt lịch');
    if (branch.pendingHoldMinutes < 5 || branch.pendingHoldMinutes > 1440) reasons.push('Thời gian giữ lịch PENDING không hợp lệ');
    if (branch.business.bookingRestrictedAt) reasons.push(branch.business.bookingRestrictionReason || 'Đang bị hạn chế nhận booking');
    for (const combo of branch.combos) {
      const invalidService = combo.comboServices.find(({ service }) =>
        service.status !== 'ACTIVE' ||
        service.deletedAt !== null ||
        service.staffServices.length === 0,
      );
      if (invalidService) {
        reasons.push(`Combo ${combo.name} chưa thể kích hoạt vì dịch vụ ${invalidService.service.name} chưa sẵn sàng`);
      }
    }
    const total = 8;
    const completed = Math.max(0, total - new Set(reasons).size);
    return {
      ready: reasons.length === 0,
      reasons: [...new Set(reasons)],
      completed,
      total,
      progress: Math.round((completed / total) * 100),
      reviewStatus: branch.reviewStatus,
      operationalStatus: branch.operationalStatus,
    };
  }

  /** Update editable branch contact and operating settings. */
  async update(id: string, data: {
    name?: string; publicName?: string; description?: string;
    addressLine?: string; districtId?: string; ward?: string; floor?: string; directions?: string;
    latitude?: number; longitude?: number; phone?: string;
    email?: string; managerName?: string; scheduledOpeningDate?: string;
    timezone?: string; bookingStartDate?: string;
    serviceMode?: 'AT_LOCATION' | 'MOBILE' | 'BOTH';
    serviceAreas?: unknown; serviceRadiusKm?: number; travelFee?: number; excludedServiceAreas?: unknown;
    bookingConfirmationMode?: 'MANUAL_CONFIRMATION' | 'AUTO_CONFIRMATION';
    staffAssignmentMode?: 'CUSTOMER_SELECTS_STAFF' | 'AUTO_ASSIGN_IF_ANY_STAFF' | 'MANUAL_ASSIGN_BY_RECEPTIONIST';
    pendingHoldMinutes?: number;
  }, client: Prisma.TransactionClient = this.prisma) {
    const current = await client.branch.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, businessId: true, addressLine: true, districtId: true },
    });
    if (!current) throw new NotFoundException('Chi nhánh không tồn tại');
    const addressLine = data.addressLine?.trim() ?? current.addressLine;
    const districtId = data.districtId ?? current.districtId;
    if (addressLine && districtId) {
      const duplicate = await client.branch.findFirst({
        where: {
          id: { not: id },
          businessId: current.businessId,
          districtId,
          addressLine: { equals: addressLine, mode: 'insensitive' },
          reviewStatus: { not: 'REJECTED' },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Địa chỉ này đã được dùng cho một chi nhánh khác.');
    }
    return client.branch.update({
      where: { id },
      data: {
        ...data,
        scheduledOpeningDate: data.scheduledOpeningDate ? new Date(data.scheduledOpeningDate) : undefined,
        bookingStartDate: data.bookingStartDate ? new Date(data.bookingStartDate) : undefined,
        latitude: data.latitude as any,
        longitude: data.longitude as any,
        travelFee: data.travelFee as any,
        serviceAreas: data.serviceAreas as Prisma.InputJsonValue,
        excludedServiceAreas: data.excludedServiceAreas as Prisma.InputJsonValue,
      },
    });
  }

  async saveOnboarding(
    id: string,
    input: SaveBranchOnboardingDto,
  ) {
    // Also validate non-HTTP callers before any write. Nested identifiers and
    // Prisma relation operations must never pass through onboarding settings.
    input = plainToInstance(SaveBranchOnboardingDto, input);
    const errors = validateSync(input, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadRequestException('Thông tin thiết lập chi nhánh không hợp lệ');
    }
    for (const hour of input.workingHours ?? []) {
      if (!hour.isClosed && hour.openTime >= hour.closeTime) {
        throw new BadRequestException('Giờ hoạt động không hợp lệ');
      }
    }
    return this.prisma.$transaction(async (tx) => {
      if (input.branch) await this.update(id, input.branch, tx);
      if (input.workingHours) {
        await tx.branchWorkingHour.deleteMany({ where: { branchId: id } });
        if (input.workingHours.length) {
          await tx.branchWorkingHour.createMany({
            data: input.workingHours.map((hour) => ({
              branchId: id,
              dayOfWeek: hour.dayOfWeek,
              openTime: new Date(`1970-01-01T${hour.openTime}:00.000Z`),
              closeTime: new Date(`1970-01-01T${hour.closeTime}:00.000Z`),
              isClosed: Boolean(hour.isClosed),
            })),
          });
        }
      }
      if (input.bookingPolicy) {
        const policy = input.bookingPolicy;
        const policyData = {
          leadTimeMinutes: policy.leadTimeMinutes,
          bookingHorizonDays: policy.bookingHorizonDays,
          cancellationHours: policy.cancellationHours,
          rescheduleHours: policy.rescheduleHours,
          noShowHandling: policy.noShowHandling,
          earlyCheckInMinutes: policy.earlyCheckInMinutes,
          gracePeriodMinutes: policy.gracePeriodMinutes,
          allowWalkIn: policy.allowWalkIn,
          allowCounterBooking: policy.allowCounterBooking,
          defaultBufferMinutes: policy.defaultBufferMinutes,
          overbookingEnabled: policy.overbookingEnabled,
          maxOverbookedSlots: policy.maxOverbookedSlots,
          confirmedAt: new Date(),
        };
        await tx.branchBookingPolicy.upsert({
          where: { branchId: id },
          create: {
            branchId: id,
            ...policyData,
          },
          update: policyData,
        });
      }
      return tx.branchOnboardingProgress.upsert({
        where: { branchId: id },
        create: {
          branchId: id,
          currentStep: input.currentStep,
          completedSteps: input.completedSteps ?? [],
          draftData: input.draftData as Prisma.InputJsonValue,
        },
        update: {
          currentStep: input.currentStep,
          completedSteps: input.completedSteps ?? undefined,
          draftData: input.draftData as Prisma.InputJsonValue,
        },
      });
    });
  }

  async copyServices(
    id: string,
    sourceBranchId: string,
    serviceIds: string[],
  ) {
    if (!serviceIds.length) throw new BadRequestException('Chọn ít nhất một dịch vụ để sao chép');
    const [target, source] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id, deletedAt: null }, select: { businessId: true } }),
      this.prisma.branch.findFirst({ where: { id: sourceBranchId, deletedAt: null }, select: { businessId: true } }),
    ]);
    if (!target || !source || target.businessId !== source.businessId) {
      throw new ForbiddenException('Chỉ được sao chép dịch vụ trong cùng doanh nghiệp');
    }
    const services = await this.prisma.branchServiceOffering.findMany({
      where: { id: { in: serviceIds }, branchId: sourceBranchId, deletedAt: null },
      select: {
        id: true,
        businessServiceId: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        durationMinutes: true,
      },
    });
    if (services.length !== new Set(serviceIds).size) {
      throw new BadRequestException('Có dịch vụ không thuộc chi nhánh nguồn');
    }
    await this.prisma.branchServiceOffering.createMany({
      data: services.map((service) => ({
        branchId: id,
        businessServiceId: service.businessServiceId,
        categoryId: service.categoryId,
        name: service.name,
        description: service.description,
        price: service.price,
        durationMinutes: service.durationMinutes,
        status: 'INACTIVE',
      })),
      skipDuplicates: true,
    });
    return this.prisma.branchServiceOffering.findMany({
      where: {
        branchId: id,
        businessServiceId: { in: services.map((item) => item.businessServiceId).filter((value): value is string => !!value) },
        deletedAt: null,
      },
      select: { id: true, name: true, price: true, durationMinutes: true, status: true },
    });
  }

  async attachDocument(
    id: string,
    actorId: string,
    input: {
      mediaId: string;
      documentType: 'OPERATING_LICENSE' | 'LOCATION_DOCUMENT' | 'SERVICE_LICENSE' | 'FIRE_SAFETY' | 'OTHER';
      documentName: string;
      documentNumber?: string;
      issuedAt?: string;
      expiresAt?: string;
      note?: string;
      replaceDocumentId?: string;
    },
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: { businessId: true, reviewStatus: true },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(branch.reviewStatus)) {
      throw new ConflictException('Chỉ được thay đổi tài liệu khi hồ sơ ở trạng thái nháp hoặc cần bổ sung');
    }
    const media = await this.prisma.mediaFile.findFirst({
      where: {
        id: input.mediaId,
        uploadedBy: actorId,
        businessId: branch.businessId,
        branchId: id,
        visibility: 'PRIVATE',
      },
      select: { id: true },
    });
    if (!media) throw new BadRequestException('Tài liệu phải là file private đúng chi nhánh');
    return this.prisma.$transaction(async (tx) => {
      if (input.replaceDocumentId) {
        const document = await tx.branchDocument.findFirst({
          where: { id: input.replaceDocumentId, branchId: id },
        });
        if (!document) throw new NotFoundException('Tài liệu không tồn tại');
        const version = document.currentVersion + 1;
        return tx.branchDocument.update({
          where: { id: document.id },
          data: {
            documentType: input.documentType,
            documentNumber: input.documentNumber?.trim() || null,
            issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            status: 'DRAFT',
            currentVersion: version,
            versions: {
              create: {
                version,
                mediaId: media.id,
                documentName: input.documentName.trim(),
                note: input.note?.trim() || null,
                createdBy: actorId,
              },
            },
          },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        });
      }
      return tx.branchDocument.create({
        data: {
          branchId: id,
          documentType: input.documentType,
          documentNumber: input.documentNumber?.trim() || null,
          issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          versions: {
            create: {
              version: 1,
              mediaId: media.id,
              documentName: input.documentName.trim(),
              note: input.note?.trim() || null,
              createdBy: actorId,
            },
          },
        },
        include: { versions: true },
      });
    });
  }

  async archiveDocument(id: string, documentId: string, actorId: string) {
    const document = await this.prisma.branchDocument.findFirst({
      where: { id: documentId, branchId: id, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        status: true,
        branch: { select: { reviewStatus: true } },
      },
    });
    if (!document) throw new NotFoundException('Tài liệu không tồn tại');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(document.branch.reviewStatus)) {
      throw new ConflictException('Không thể xóa tài liệu khi hồ sơ đang được xét duyệt hoặc đã duyệt');
    }
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.branchDocument.update({
        where: { id: document.id },
        data: { status: 'ARCHIVED' },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'DELETE',
          entityType: 'BranchDocument',
          entityId: document.id,
          oldData: { status: document.status },
          newData: { status: 'ARCHIVED' },
        },
      });
      return archived;
    });
  }

  async submit(id: string, actorId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: {
        business: { select: { status: true, bookingRestrictedAt: true } },
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        },
      },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    if (!['DRAFT', 'NEED_MORE_INFO'].includes(branch.reviewStatus)) {
      throw new ConflictException('Chi nhánh không ở trạng thái có thể gửi duyệt');
    }
    if (!['APPROVED', 'ACTIVE'].includes(branch.business.status) || branch.business.bookingRestrictedAt) {
      throw new ForbiddenException('Doanh nghiệp không đủ điều kiện gửi duyệt chi nhánh');
    }
    const missing = [
      !branch.sameLegalEntity && 'xác nhận pháp nhân',
      !branch.name.trim() && 'tên chi nhánh',
      branch.serviceMode !== 'MOBILE' && (!branch.addressLine || !branch.districtId) && 'địa chỉ',
      !branch.phone && !branch.email && 'thông tin liên hệ',
    ].filter(Boolean);
    if (missing.length) throw new BadRequestException(`Thiếu thông tin: ${missing.join(', ')}`);
    if (branch.documents.some((document) => !document.versions.length)) {
      throw new BadRequestException('Có tài liệu chưa tải lên phiên bản hợp lệ');
    }
    const snapshot = {
      id: branch.id,
      businessId: branch.businessId,
      name: branch.name,
      publicName: branch.publicName,
      serviceMode: branch.serviceMode,
      addressLine: branch.addressLine,
      districtId: branch.districtId,
      phone: branch.phone,
      email: branch.email,
      submittedAt: new Date().toISOString(),
    };
    const state = await this.branchState.transition(id, 'SUBMIT', actorId, 'Gửi hồ sơ chi nhánh để xét duyệt');
    if (!state.transitioned) throw new ConflictException('Không thể gửi hồ sơ khi còn lịch bị ảnh hưởng chưa xử lý');
    return this.prisma.$transaction(async (tx) => {
      const fromStatus = branch.reviewStatus;
      const now = new Date();
      const updated = await tx.branch.update({ where: { id }, data: { submittedAt: now, reviewNote: null } });
      await tx.branchReviewRequest.create({
        data: {
          branchId: id,
          requestedBy: actorId,
          status: 'PENDING_REVIEW',
          profileSnapshot: snapshot,
          documentSnapshot: branch.documents.map((document) => ({
            id: document.id,
            type: document.documentType,
            version: document.currentVersion,
            expiresAt: document.expiresAt,
          })),
        },
      });
      await tx.branchReviewEvent.create({
        data: {
          branchId: id,
          actorId,
          action: fromStatus === 'NEED_MORE_INFO' ? 'RESUBMIT' : 'SUBMIT',
          fromStatus,
          toStatus: 'PENDING_REVIEW',
        },
      });
      await tx.branchDocument.updateMany({
        where: { branchId: id, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });
      const reviewers = await tx.userRole.findMany({
        where: { role: { code: 'PLATFORM_ADMIN' }, expiresAt: null },
        select: { userId: true },
        distinct: ['userId'],
      });
      if (reviewers.length) {
        await tx.notification.createMany({
          data: reviewers.map(({ userId }) => ({
            userId,
            type: 'SYSTEM',
            severity: 'INFO',
            title: 'Có hồ sơ chi nhánh chờ duyệt',
            body: branch.name,
            targetType: 'BRANCH',
            targetId: id,
            actionUrl: `/admin/branches/${id}`,
          })),
        });
      }
      return updated;
    });
  }

  async review(
    id: string,
    decision: 'APPROVE' | 'REQUEST_INFO' | 'REJECT',
    reason?: string,
    actorId?: string | null,
    targetStep?: number,
    deadline?: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: {
        business: { select: { status: true } },
        reviewRequests: {
          where: { status: 'PENDING_REVIEW' },
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    if (!['PENDING_REVIEW', 'SUBMITTED'].includes(branch.reviewStatus)) {
      throw new ConflictException('Chi nhánh không chờ xét duyệt');
    }
    if (decision === 'APPROVE' && !['APPROVED', 'ACTIVE'].includes(branch.business.status)) {
      throw new ConflictException('Doanh nghiệp chủ quản phải được duyệt trước khi duyệt chi nhánh');
    }
    if (decision !== 'APPROVE' && !reason?.trim()) {
      throw new BadRequestException('Cần ghi rõ lý do và nội dung cần bổ sung');
    }
    if (!actorId) throw new ForbiddenException('Không xác định được người xét duyệt');
    const nextStatus = decision === 'APPROVE'
      ? 'APPROVED'
      : decision === 'REQUEST_INFO'
        ? 'NEED_MORE_INFO'
        : 'REJECTED';
    const transitionAction = decision === 'APPROVE' ? 'APPROVE' : decision === 'REQUEST_INFO' ? 'REQUEST_INFO' : 'REJECT';
    const state = await this.branchState.transition(id, transitionAction, actorId, reason?.trim() || `Platform ${decision.toLowerCase()} hồ sơ chi nhánh`);
    if (!state.transitioned || !('branch' in state)) throw new ConflictException('Không thể đổi trạng thái chi nhánh khi còn lịch bị ảnh hưởng chưa xử lý');
    const reviewed = await this.prisma.$transaction(async (tx) => {
      const updated = state.branch!;
      if (branch.reviewRequests[0]) {
        await tx.branchReviewRequest.update({
          where: { id: branch.reviewRequests[0].id },
          data: {
            status: nextStatus,
            assignedTo: actorId || undefined,
            resolvedAt: new Date(),
          },
        });
      }
      await tx.branchReviewEvent.create({
        data: {
          branchId: id,
          actorId: actorId || null,
          action: decision,
          fromStatus: branch.reviewStatus,
          toStatus: nextStatus,
          reason: reason?.trim() || null,
          targetStep,
          deadline: deadline ? new Date(deadline) : null,
        },
      });
      await tx.branchDocument.updateMany({
        where: { branchId: id, status: { in: ['SUBMITTED', 'NEED_MORE_INFO'] } },
        data: {
          status: decision === 'APPROVE'
            ? 'APPROVED'
            : decision === 'REQUEST_INFO'
              ? 'NEED_MORE_INFO'
              : 'REJECTED',
        },
      });
      return updated;
    });
    return reviewed;
  }

  async publish(id: string, actorId: string) {
    const readiness = await this.getReadiness(id);
    if (readiness.reviewStatus !== 'APPROVED') {
      throw new ConflictException('Chi nhánh phải được duyệt trước khi đăng');
    }
    if (!readiness.ready) {
      throw new ConflictException({
        message: 'Chi nhánh chưa đủ điều kiện nhận đặt lịch',
        reasons: readiness.reasons,
      });
    }
    const state = await this.branchState.transition(id, 'PUBLISH', actorId, 'Owner bật nhận đặt lịch sau khi checklist đạt yêu cầu');
    if (!state.transitioned || !('branch' in state)) throw new ConflictException('Không thể đăng chi nhánh');
    return state.branch;
  }
}
