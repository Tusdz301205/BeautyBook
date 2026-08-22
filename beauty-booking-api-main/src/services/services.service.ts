import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { appointmentDateFromInstant } from '../common/utils/booking-datetime';
import { bookableStaffWhere, professionalTitle, staffRating } from '../staff/bookable-staff';

type CatalogStatus = 'ACTIVE' | 'INACTIVE';
type MappingStatus = 'MAPPED' | 'UNMAPPED' | 'SUGGESTED';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    branchId?: string,
    publicOnly = false,
    allowedBranchIds?: string[],
    pagination?: { page?: number; limit?: number },
  ) {
    const where: Prisma.BranchServiceOfferingWhereInput = {
      deletedAt: null,
      ...(publicOnly
        ? {
            status: 'ACTIVE',
            bookable: true,
            businessService: { status: 'ACTIVE', deletedAt: null },
            branch: {
              status: 'ACTIVE',
              reviewStatus: 'APPROVED',
              operationalStatus: 'ACTIVE',
              deletedAt: null,
              business: {
                status: { in: ['APPROVED', 'ACTIVE'] },
                bookingRestrictedAt: null,
                deletedAt: null,
              },
            },
          }
        : {}),
    };
    if (branchId) where.branchId = branchId;
    else if (allowedBranchIds) where.branchId = { in: allowedBranchIds };

    const services = await this.prisma.branchServiceOffering.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        businessService: {
          select: {
            id: true,
            name: true,
            canonicalServiceId: true,
            mappingStatus: true,
            canonicalService: { select: { id: true, name: true, slug: true, status: true } },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            businessId: true,
            business: { select: { id: true, name: true } },
          },
        },
        staffServices: {
          ...(publicOnly
            ? { where: { staff: bookableStaffWhere({ publicOnly: true, requireSchedule: true }) } }
            : {}),
          include: { staff: { include: { user: { select: { fullName: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(publicOnly
        ? {
            skip:
              (Math.max(1, Number(pagination?.page) || 1) - 1) *
              Math.min(100, Math.max(1, Number(pagination?.limit) || 100)),
            take: Math.min(100, Math.max(1, Number(pagination?.limit) || 100)),
          }
        : {}),
    });

    return services.map((service) => ({
      id: service.id,
      branchId: service.branchId,
      businessServiceId: service.businessServiceId,
      canonicalServiceId: service.businessService.canonicalServiceId,
      name: service.businessService.name || service.name,
      description: service.description,
      price: Number(service.price),
      duration: service.durationMinutes,
      durationMinutes: service.durationMinutes,
      category: service.category,
      categoryId: service.categoryId,
      canonicalService: service.businessService.canonicalService,
      mappingStatus: service.businessService.mappingStatus,
      branch: service.branch,
      status: service.status,
      bookable: service.bookable,
      active: service.status === 'ACTIVE' && service.bookable,
      stylists: service.staffServices.map(
        (assignment) => assignment.staff?.user?.fullName || assignment.staff?.fullName || 'N/A',
      ),
    }));
  }

  async getBusinessCategories(businessIds: string[]) {
    if (!businessIds.length) return [];
    return this.prisma.serviceCategory.findMany({
      where: { businessId: { in: businessIds }, deletedAt: null },
      select: { id: true, businessId: true, parentId: true, name: true, slug: true },
      orderBy: [{ businessId: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(data: { businessId: string; parentId?: string; name: string; slug: string }) {
    if (data.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({
        where: { id: data.parentId },
        select: { businessId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt || parent.businessId !== data.businessId) {
        throw new BadRequestException('Danh mục cha không thuộc doanh nghiệp');
      }
    }
    return this.prisma.serviceCategory.create({ data });
  }

  async listCanonical(publicOnly = true) {
    return this.prisma.canonicalService.findMany({
      where: publicOnly ? { status: 'ACTIVE' } : {},
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        synonyms: true,
        status: true,
        replacementCanonicalId: true,
        _count: { select: { businessServices: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async createCanonical(data: {
    code: string;
    slug: string;
    name: string;
    description?: string;
    parentId?: string;
    synonyms?: string[];
  }) {
    if (data.parentId) await this.assertCanonicalExists(data.parentId);
    return this.prisma.canonicalService.create({
      data: { ...data, synonyms: this.normalizeKeywords(data.synonyms) },
    });
  }

  async updateCanonical(
    id: string,
    data: {
      slug?: string;
      name?: string;
      description?: string;
      parentId?: string;
      synonyms?: string[];
      status?: 'ACTIVE' | 'DEPRECATED' | 'MERGED';
      replacementCanonicalId?: string;
    },
  ) {
    await this.assertCanonicalExists(id, false);
    if (data.parentId === id) throw new BadRequestException('Canonical không thể là cha của chính nó');
    if (data.parentId) await this.assertCanonicalExists(data.parentId);
    if (data.status === 'MERGED') {
      if (!data.replacementCanonicalId || data.replacementCanonicalId === id) {
        throw new BadRequestException('Canonical MERGED phải có canonical thay thế khác chính nó');
      }
      await this.assertCanonicalExists(data.replacementCanonicalId);
    }
    if (data.status && data.status !== 'MERGED' && data.replacementCanonicalId) {
      throw new BadRequestException('Chỉ canonical MERGED mới có canonical thay thế');
    }
    return this.prisma.canonicalService.update({
      where: { id },
      data: {
        ...data,
        ...(data.synonyms ? { synonyms: this.normalizeKeywords(data.synonyms) } : {}),
        ...(data.status && data.status !== 'MERGED' ? { replacementCanonicalId: null } : {}),
      },
    });
  }

  async findOne(id: string, publicOnly = false) {
    const service = await this.prisma.branchServiceOffering.findFirst({
      where: {
        id,
        ...(publicOnly
          ? {
              status: 'ACTIVE',
              bookable: true,
              deletedAt: null,
              businessService: { status: 'ACTIVE', deletedAt: null },
              branch: {
                status: 'ACTIVE',
                reviewStatus: 'APPROVED',
                operationalStatus: 'ACTIVE',
                deletedAt: null,
                business: {
                  status: { in: ['APPROVED', 'ACTIVE'] },
                  bookingRestrictedAt: null,
                  deletedAt: null,
                },
              },
            }
          : {}),
      },
      include: {
        businessService: { include: { canonicalService: true } },
        category: true,
        branch: { include: { business: { select: { id: true, name: true } } } },
        staffServices: {
          where: {
            staff: publicOnly
              ? bookableStaffWhere({ publicOnly: true, requireSchedule: true })
              : { status: 'ACTIVE', deletedAt: null },
          },
          include: {
            staff: {
              include: {
                user: { select: { fullName: true, avatarMedia: { select: { url: true } } } },
                images: {
                  select: { media: { select: { url: true } } },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
                reviewRatings: {
                  where: { review: { status: 'APPROVED', deletedAt: null } },
                  select: { rating: true },
                },
              },
            },
          },
        },
        images: {
          include: {
            media: { select: { id: true, url: true, fileType: true, originalName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        promotionLinks: {
          where: {
            promotion: {
              status: 'ACTIVE',
              deletedAt: null,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            },
          },
          include: { promotion: true },
        },
      },
    });
    if (!service || !publicOnly) return service;
    return {
      ...service,
      name: service.businessService.name,
      canonicalService: service.businessService.canonicalService,
      staffServices: service.staffServices.map(({ staff, ...assignment }) => {
        const { user, images, reviewRatings, position, ...profile } = staff;
        return {
          ...assignment,
          staff: {
            ...profile,
            images,
            professionalTitle: professionalTitle(position),
            specialties: [service.businessService.name],
            avatarUrl: user?.avatarMedia?.url || images[0]?.media?.url || null,
            ...staffRating(reviewRatings),
          },
        };
      }),
    };
  }

  async search(input: {
    query?: string;
    location?: string;
    canonicalServiceId?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    date?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const query = input.query?.trim() ?? '';
    const location = input.location?.trim() ?? '';
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 12));
    const offset = (page - 1) * limit;
    const minPrice = Number.isFinite(Number(input.minPrice)) ? Math.max(0, Number(input.minPrice)) : null;
    const maxPrice = Number.isFinite(Number(input.maxPrice)) ? Math.max(0, Number(input.maxPrice)) : null;
    const minRating = Number.isFinite(Number(input.minRating)) ? Math.max(0, Number(input.minRating)) : null;
    const likeQuery = `%${query}%`;
    const likeLocation = `%${location}%`;

    let canonicalId = input.canonicalServiceId ?? null;
    if (canonicalId) {
      const canonical = await this.prisma.canonicalService.findUnique({
        where: { id: canonicalId },
        select: { id: true, status: true, replacementCanonicalId: true },
      });
      if (!canonical) throw new BadRequestException('Loại dịch vụ không tồn tại');
      canonicalId = canonical.status === 'MERGED' ? canonical.replacementCanonicalId : canonical.id;
    }

    const queryPredicate = query
      ? Prisma.sql`AND (
          LOWER(bs."name") LIKE LOWER(${likeQuery})
          OR LOWER(COALESCE(bs."description", '')) LIKE LOWER(${likeQuery})
          OR LOWER(c."name") LIKE LOWER(${likeQuery})
          OR LOWER(resolved."name") LIKE LOWER(${likeQuery})
          OR LOWER(COALESCE(category."name", '')) LIKE LOWER(${likeQuery})
          OR EXISTS (SELECT 1 FROM UNNEST(c."synonyms") synonym WHERE LOWER(synonym) LIKE LOWER(${likeQuery}))
          OR EXISTS (SELECT 1 FROM UNNEST(resolved."synonyms") synonym WHERE LOWER(synonym) LIKE LOWER(${likeQuery}))
          OR EXISTS (
            SELECT 1
            FROM "canonical_services" alias
            WHERE alias."replacement_canonical_id" = resolved."id"
              AND alias."status" = 'MERGED'
              AND (
                LOWER(alias."name") LIKE LOWER(${likeQuery})
                OR EXISTS (
                  SELECT 1 FROM UNNEST(alias."synonyms") synonym
                  WHERE LOWER(synonym) LIKE LOWER(${likeQuery})
                )
              )
          )
          OR EXISTS (SELECT 1 FROM UNNEST(bs."keywords") keyword WHERE LOWER(keyword) LIKE LOWER(${likeQuery}))
        )`
      : Prisma.empty;
    const locationPredicate = location
      ? Prisma.sql`AND (
          LOWER(branch."name") LIKE LOWER(${likeLocation})
          OR LOWER(COALESCE(branch."address_line", '')) LIKE LOWER(${likeLocation})
          OR LOWER(COALESCE(district."name", '')) LIKE LOWER(${likeLocation})
          OR LOWER(COALESCE(province."name", '')) LIKE LOWER(${likeLocation})
        )`
      : Prisma.empty;
    const canonicalPredicate = canonicalId
      ? Prisma.sql`AND resolved."id" = ${canonicalId}`
      : Prisma.empty;
    const minPricePredicate = minPrice !== null ? Prisma.sql`AND offering."price" >= ${minPrice}` : Prisma.empty;
    const maxPricePredicate = maxPrice !== null ? Prisma.sql`AND offering."price" <= ${maxPrice}` : Prisma.empty;
    const datePredicate = input.date
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "branch_working_hours" hours
          WHERE hours."branch_id" = branch."id"
            AND hours."day_of_week" = EXTRACT(DOW FROM ${input.date}::date)
            AND hours."is_closed" = FALSE
        )`
      : Prisma.empty;
    const ratingPredicate = minRating !== null
      ? Prisma.sql`AND COALESCE(rating."average_rating", 0) >= ${minRating}`
      : Prisma.empty;
    const orderBy = input.sort === 'price_asc'
      ? Prisma.sql`offering."price" ASC, "searchRank" DESC`
      : input.sort === 'price_desc'
        ? Prisma.sql`offering."price" DESC, "searchRank" DESC`
        : input.sort === 'rating'
          ? Prisma.sql`COALESCE(rating."average_rating", 0) DESC, "searchRank" DESC`
          : Prisma.sql`"searchRank" DESC, COALESCE(rating."average_rating", 0) DESC, offering."updated_at" DESC`;

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        offering."id",
        offering."branch_id" AS "branchId",
        offering."business_service_id" AS "businessServiceId",
        bs."name" AS "displayName",
        bs."description",
        bs."mapping_status" AS "mappingStatus",
        offering."price",
        offering."duration_minutes" AS "durationMinutes",
        branch."name" AS "branchName",
        branch."address_line" AS "address",
        business."id" AS "businessId",
        business."name" AS "businessName",
        district."name" AS "districtName",
        province."name" AS "provinceName",
        category."name" AS "categoryName",
        resolved."id" AS "canonicalServiceId",
        resolved."name" AS "canonicalServiceName",
        COALESCE(rating."average_rating", 0) AS "rating",
        COALESCE(rating."review_count", 0) AS "reviewCount",
        COALESCE(staff."staff_count", 0) AS "availableStaffCount",
        CASE
          WHEN ${query} = '' THEN 0
          WHEN LOWER(bs."name") = LOWER(${query}) THEN 100
          WHEN LOWER(resolved."name") = LOWER(${query}) THEN 90
          WHEN LOWER(c."name") = LOWER(${query}) THEN 85
          WHEN EXISTS (
            SELECT 1 FROM "canonical_services" alias
            WHERE alias."replacement_canonical_id" = resolved."id"
              AND alias."status" = 'MERGED'
              AND LOWER(alias."name") = LOWER(${query})
          ) THEN 82
          WHEN EXISTS (SELECT 1 FROM UNNEST(resolved."synonyms") synonym WHERE LOWER(synonym) = LOWER(${query})) THEN 80
          WHEN EXISTS (SELECT 1 FROM UNNEST(c."synonyms") synonym WHERE LOWER(synonym) = LOWER(${query})) THEN 78
          WHEN LOWER(bs."name") LIKE LOWER(${likeQuery}) THEN 70
          WHEN LOWER(resolved."name") LIKE LOWER(${likeQuery}) THEN 60
          WHEN LOWER(c."name") LIKE LOWER(${likeQuery}) THEN 58
          WHEN EXISTS (SELECT 1 FROM UNNEST(resolved."synonyms") synonym WHERE LOWER(synonym) LIKE LOWER(${likeQuery})) THEN 55
          WHEN EXISTS (SELECT 1 FROM UNNEST(c."synonyms") synonym WHERE LOWER(synonym) LIKE LOWER(${likeQuery})) THEN 53
          WHEN LOWER(COALESCE(bs."description", '')) LIKE LOWER(${likeQuery}) THEN 40
          ELSE 30
        END AS "searchRank"
      FROM "services" offering
      JOIN "business_services" bs ON bs."id" = offering."business_service_id"
      LEFT JOIN "canonical_services" c ON c."id" = bs."canonical_service_id"
      LEFT JOIN "canonical_services" resolved ON resolved."id" = COALESCE(c."replacement_canonical_id", c."id")
      JOIN "service_categories" category ON category."id" = bs."category_id"
      JOIN "branches" branch ON branch."id" = offering."branch_id"
      JOIN "businesses" business ON business."id" = branch."business_id"
      LEFT JOIN "districts" district ON district."id" = branch."district_id"
      LEFT JOIN "provinces" province ON province."id" = district."province_id"
      LEFT JOIN LATERAL (
        SELECT AVG(review_row."overall_rating")::numeric(4,2) AS "average_rating",
               COUNT(*)::int AS "review_count"
        FROM (
          SELECT DISTINCT review."id", review."overall_rating"
          FROM "booking_services" booked
          JOIN "reviews" review ON review."booking_id" = booked."booking_id"
          WHERE booked."service_id" = offering."id"
            AND review."status" = 'APPROVED'
            AND review."deleted_at" IS NULL
        ) review_row
      ) rating ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT profile."id")::int AS "staff_count"
        FROM "staff_services" skill
        JOIN "staff_profiles" profile ON profile."id" = skill."staff_id"
        WHERE skill."service_id" = offering."id"
          AND profile."status" = 'ACTIVE'
          AND profile."is_bookable" = TRUE
          AND profile."public_visible" = TRUE
          AND profile."deleted_at" IS NULL
      ) staff ON TRUE
      WHERE offering."deleted_at" IS NULL
        AND offering."status" = 'ACTIVE'
        AND offering."bookable" = TRUE
        AND bs."deleted_at" IS NULL
        AND bs."status" = 'ACTIVE'
        AND branch."deleted_at" IS NULL
        AND branch."status" = 'ACTIVE'
        AND branch."review_status" = 'APPROVED'
        AND branch."operational_status" = 'ACTIVE'
        AND business."deleted_at" IS NULL
        AND business."status" IN ('APPROVED', 'ACTIVE')
        AND business."booking_restricted_at" IS NULL
        AND COALESCE(staff."staff_count", 0) > 0
        ${queryPredicate}
        ${locationPredicate}
        ${canonicalPredicate}
        ${minPricePredicate}
        ${maxPricePredicate}
        ${datePredicate}
        ${ratingPredicate}
      ORDER BY ${orderBy}
      OFFSET ${offset}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((row) => ({
        ...row,
        price: Number(row.price),
        rating: Number(row.rating),
        reviewCount: Number(row.reviewCount),
        availableStaffCount: Number(row.availableStaffCount),
        searchRank: Number(row.searchRank),
        availabilitySummary: Number(row.availableStaffCount) > 0
          ? `${Number(row.availableStaffCount)} chuyên viên đang nhận lịch`
          : 'Chưa có lịch khả dụng',
      })),
      page,
      limit,
      hasMore,
    };
  }

  async create(data: {
    branchId: string;
    categoryId?: string;
    name: string;
    price: number;
    durationMinutes: number;
    description?: string;
    canonicalServiceId?: string;
    keywords?: string[];
  }) {
    return this.createCatalog({ ...data, branchIds: [data.branchId] });
  }

  async findWorkspace(allowedBranchIds: string[], selectedBranchId?: string) {
    const branchIds = selectedBranchId ? [selectedBranchId] : allowedBranchIds;
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds }, deletedAt: null },
      select: { id: true, name: true, businessId: true },
      orderBy: { name: 'asc' },
    });
    const businessIds = [...new Set(branches.map((branch) => branch.businessId))];
    const appointmentDate = appointmentDateFromInstant(new Date());
    const catalogs = await this.prisma.businessService.findMany({
      where: { businessId: { in: businessIds }, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        canonicalService: { select: { id: true, name: true, slug: true, status: true } },
        branchServices: {
          where: { branchId: { in: branches.map((branch) => branch.id) }, deletedAt: null },
          include: {
            branch: { select: { id: true, name: true } },
            _count: {
              select: {
                staffServices: true,
                bookingServices: {
                  where: {
                    booking: {
                      deletedAt: null,
                      appointmentDate: { gte: appointmentDate },
                      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return catalogs.map((catalog) => {
      const scopedBranches = branches.filter((branch) => branch.businessId === catalog.businessId);
      const availability = scopedBranches.map((branch) => {
        const row = catalog.branchServices.find((service) => service.branchId === branch.id);
        return {
          branchId: branch.id,
          branchName: branch.name,
          branchServiceId: row?.id ?? null,
          status: !row ? 'NOT_APPLIED' : row.status === 'ACTIVE' && row.bookable ? 'ACTIVE' : 'PAUSED',
          price: row ? Number(row.price) : Number(catalog.basePrice),
          durationMinutes: row?.durationMinutes ?? catalog.baseDurationMinutes,
          staffCount: row?._count.staffServices ?? 0,
          futureBookingCount: row?._count.bookingServices ?? 0,
        };
      });
      const count = (status: string) => availability.filter((item) => item.status === status).length;
      return {
        id: catalog.id,
        businessId: catalog.businessId,
        name: catalog.name,
        description: catalog.description,
        keywords: catalog.keywords,
        price: Number(catalog.basePrice),
        durationMinutes: catalog.baseDurationMinutes,
        categoryId: catalog.categoryId,
        category: catalog.category,
        canonicalServiceId: catalog.canonicalServiceId,
        canonicalService: catalog.canonicalService,
        mappingStatus: catalog.mappingStatus,
        status: catalog.status,
        createdAt: catalog.createdAt,
        updatedAt: catalog.updatedAt,
        branchAvailability: availability,
        branchCoverage: {
          total: availability.length,
          active: count('ACTIVE'),
          paused: count('PAUSED'),
          notApplied: count('NOT_APPLIED'),
        },
      };
    });
  }

  async createCatalog(data: {
    branchId: string;
    branchIds?: string[];
    categoryId?: string;
    name: string;
    price: number;
    durationMinutes: number;
    description?: string;
    canonicalServiceId?: string;
    keywords?: string[];
  }) {
    const requestedBranchIds = [...new Set([data.branchId, ...(data.branchIds ?? [])])];
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: requestedBranchIds }, deletedAt: null },
      select: { id: true, businessId: true },
    });
    const primary = branches.find((branch) => branch.id === data.branchId);
    if (!primary || branches.length !== requestedBranchIds.length) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }
    if (branches.some((branch) => branch.businessId !== primary.businessId)) {
      throw new ConflictException('Không thể áp dụng dịch vụ sang doanh nghiệp khác');
    }
    let categoryId = data.categoryId;
    if (categoryId) {
      await this.assertCategoryScope(categoryId, primary.businessId);
    } else {
      const compatibilityCategory = await this.prisma.serviceCategory.upsert({
        where: { businessId_slug: { businessId: primary.businessId, slug: 'dich-vu' } },
        update: { deletedAt: null },
        create: { businessId: primary.businessId, name: 'Dịch vụ', slug: 'dich-vu' },
        select: { id: true },
      });
      categoryId = compatibilityCategory.id;
    }
    if (data.canonicalServiceId) await this.assertCanonicalExists(data.canonicalServiceId);

    return this.prisma.$transaction(async (transaction) => {
      const catalog = await transaction.businessService.create({
        data: {
          businessId: primary.businessId,
          categoryId,
          canonicalServiceId: data.canonicalServiceId ?? null,
          mappingStatus: data.canonicalServiceId ? 'MAPPED' : 'UNMAPPED',
          keywords: this.normalizeKeywords(data.keywords),
          name: data.name,
          description: data.description ?? null,
          basePrice: data.price,
          baseDurationMinutes: data.durationMinutes,
        },
      });
      await transaction.branchServiceOffering.createMany({
        data: branches.map((branch) => ({
          businessServiceId: catalog.id,
          branchId: branch.id,
          categoryId,
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          durationMinutes: data.durationMinutes,
          status: 'ACTIVE',
          bookable: true,
        })),
      });
      return catalog;
    });
  }

  async updateCatalog(
    id: string,
    data: {
      categoryId?: string;
      name?: string;
      price?: number;
      durationMinutes?: number;
      description?: string;
      status?: CatalogStatus;
      canonicalServiceId?: string;
      mappingStatus?: MappingStatus;
      keywords?: string[];
    },
  ) {
    const catalog = await this.prisma.businessService.findUniqueOrThrow({ where: { id } });
    if (data.categoryId) await this.assertCategoryScope(data.categoryId, catalog.businessId);

    const nextMappingStatus = data.mappingStatus ?? (data.canonicalServiceId ? 'MAPPED' : undefined);
    const nextCanonicalId = data.mappingStatus === 'UNMAPPED'
      ? null
      : data.canonicalServiceId === undefined
        ? catalog.canonicalServiceId
        : data.canonicalServiceId;
    if (nextMappingStatus === 'MAPPED' && !nextCanonicalId) {
      throw new BadRequestException('Dịch vụ MAPPED phải chọn loại dịch vụ BeautyBook');
    }
    if (nextCanonicalId && nextCanonicalId !== catalog.canonicalServiceId) {
      await this.assertCanonicalExists(nextCanonicalId);
    }

    return this.prisma.$transaction(async (transaction) => {
      if (data.price !== undefined) {
        await transaction.branchServiceOffering.updateMany({
          where: { businessServiceId: id, price: catalog.basePrice, deletedAt: null },
          data: { price: data.price },
        });
      }
      if (data.durationMinutes !== undefined) {
        await transaction.branchServiceOffering.updateMany({
          where: {
            businessServiceId: id,
            durationMinutes: catalog.baseDurationMinutes,
            deletedAt: null,
          },
          data: { durationMinutes: data.durationMinutes },
        });
      }
      const updated = await transaction.businessService.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          canonicalServiceId: nextCanonicalId,
          mappingStatus: nextMappingStatus,
          keywords: data.keywords ? this.normalizeKeywords(data.keywords) : undefined,
          name: data.name,
          description: data.description,
          basePrice: data.price,
          baseDurationMinutes: data.durationMinutes,
          status: data.status,
        },
      });
      await transaction.branchServiceOffering.updateMany({
        where: { businessServiceId: id, deletedAt: null },
        data: {
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          ...(data.status === 'INACTIVE' ? { status: 'INACTIVE', bookable: false } : {}),
        },
      });
      return updated;
    });
  }

  async archiveCatalog(id: string) {
    const futureBookings = await this.prisma.bookingService.count({
      where: {
        businessServiceId: id,
        booking: {
          deletedAt: null,
          appointmentDate: { gte: appointmentDateFromInstant(new Date()) },
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
        },
      },
    });
    if (futureBookings > 0) {
      throw new ConflictException(
        `Không thể lưu trữ dịch vụ vì còn ${futureBookings} lịch tương lai; hãy tạm ngưng nhận lịch mới và xử lý các lịch hiện có trước`,
      );
    }
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const catalog = await transaction.businessService.update({
        where: { id },
        data: { deletedAt: now, status: 'INACTIVE' },
      });
      await transaction.branchServiceOffering.updateMany({
        where: { businessServiceId: id, deletedAt: null },
        data: { status: 'INACTIVE', bookable: false },
      });
      return catalog;
    });
  }

  async setBranchAvailability(
    catalogId: string,
    branchId: string,
    action: 'apply' | 'pause' | 'reactivate',
  ) {
    const [catalog, branch] = await Promise.all([
      this.prisma.businessService.findUnique({ where: { id: catalogId } }),
      this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } }),
    ]);
    if (!catalog || catalog.deletedAt) throw new NotFoundException('Dịch vụ không tồn tại');
    if (!branch || branch.businessId !== catalog.businessId) {
      throw new NotFoundException('Chi nhánh không thuộc doanh nghiệp');
    }
    const existing = await this.prisma.branchServiceOffering.findUnique({
      where: { branchId_businessServiceId: { branchId, businessServiceId: catalogId } },
    });
    if (action === 'apply') {
      if (existing) {
        return this.prisma.branchServiceOffering.update({
          where: { id: existing.id },
          data: { deletedAt: null, status: 'ACTIVE', bookable: true },
        });
      }
      return this.prisma.branchServiceOffering.create({
        data: {
          businessServiceId: catalog.id,
          branchId,
          categoryId: catalog.categoryId,
          name: catalog.name,
          description: catalog.description,
          price: catalog.basePrice,
          durationMinutes: catalog.baseDurationMinutes,
          status: 'ACTIVE',
          bookable: true,
        },
      });
    }
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Dịch vụ chưa áp dụng tại chi nhánh');
    }
    return this.prisma.branchServiceOffering.update({
      where: { id: existing.id },
      data: {
        status: action === 'pause' ? 'INACTIVE' : 'ACTIVE',
        bookable: action !== 'pause',
      },
    });
  }

  async updateOfferingStatus(
    id: string,
    data: { status?: 'ACTIVE' | 'INACTIVE'; bookable?: boolean },
  ) {
    if (data.status === undefined && data.bookable === undefined) {
      throw new BadRequestException('Cần trạng thái hoặc bookable');
    }
    return this.prisma.branchServiceOffering.update({ where: { id }, data });
  }

  async updateOfferingPricing(id: string, data: { price?: number; durationMinutes?: number }) {
    if (data.price === undefined && data.durationMinutes === undefined) {
      throw new BadRequestException('Cần giá hoặc thời lượng');
    }
    return this.prisma.branchServiceOffering.update({ where: { id }, data });
  }

  async update(id: string, data: { price?: number; durationMinutes?: number; status?: CatalogStatus; bookable?: boolean }) {
    if (
      data.price === undefined &&
      data.durationMinutes === undefined &&
      data.status === undefined &&
      data.bookable === undefined
    ) {
      throw new BadRequestException('Không có nội dung cần cập nhật');
    }
    return this.prisma.branchServiceOffering.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    const futureBookings = await this.prisma.bookingService.count({
      where: {
        serviceId: id,
        booking: {
          deletedAt: null,
          appointmentDate: { gte: appointmentDateFromInstant(new Date()) },
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
        },
      },
    });
    if (futureBookings > 0) {
      throw new ConflictException(
        `Không thể lưu trữ offering vì còn ${futureBookings} lịch tương lai; hãy tạm ngưng trước`,
      );
    }
    return this.prisma.branchServiceOffering.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', bookable: false },
    });
  }

  async findAllForMarketing() {
    return this.prisma.branchServiceOffering.findMany({
      where: { deletedAt: null, status: 'ACTIVE', bookable: true },
      include: {
        businessService: { include: { canonicalService: true } },
        branch: { include: { business: { select: { id: true, name: true } } } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private normalizeKeywords(values?: string[]) {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 50);
  }

  private async assertCategoryScope(categoryId: string, businessId: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { businessId: true, deletedAt: true },
    });
    if (!category || category.deletedAt || category.businessId !== businessId) {
      throw new BadRequestException('Danh mục không thuộc doanh nghiệp');
    }
  }

  private async assertCanonicalExists(id: string, requireActive = true) {
    const canonical = await this.prisma.canonicalService.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!canonical || (requireActive && canonical.status !== 'ACTIVE')) {
      throw new BadRequestException('Loại dịch vụ BeautyBook không còn khả dụng');
    }
    return canonical;
  }
}
