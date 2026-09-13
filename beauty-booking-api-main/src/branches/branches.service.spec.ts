import type { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from './branches.service';
import { validate } from 'class-validator';
import {
  PublicBranchReviewsQueryDto,
  PublicBranchServicesQueryDto,
  SaveBranchOnboardingDto,
  UpdateBranchDto,
} from './dto/branch.dto';
import { ConflictException } from '@nestjs/common';

const settings = {
  getEffective: jest.fn().mockResolvedValue({ maxBranchesPerBusiness: 20 }),
};
const branchState = {} as any;

describe('BranchesService marketplace listing', () => {
  test.each([0, 4, 1441])('rejects invalid pendingHoldMinutes value %s', async (value) => {
    const dto = new UpdateBranchDto();
    dto.pendingHoldMinutes = value;
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'pendingHoldMinutes')).toBe(true);
  });

  test('paginates cards and aggregates ratings without hydrating bookings', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'branch-1',
        businessId: 'business-1',
        name: 'Branch One',
        addressLine: 'Address',
        status: 'ACTIVE',
        business: { id: 'business-1', name: 'Business', status: 'ACTIVE', description: 'Description' },
        district: { name: 'District', province: { name: 'Province' } },
        districtId: 'district-1',
        services: [],
        images: [],
        workingHours: [],
        _count: { services: 4, bookings: 25, staff: 3 },
      },
    ]);
    const prisma = {
      branch: { findMany },
      $queryRaw: jest.fn().mockResolvedValue([{ branchId: 'branch-1', rating: '4.56' }]),
    } as unknown as PrismaService;

    const result = await new BranchesService(prisma, settings as any, branchState).findAll({ page: 2, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        include: expect.objectContaining({
          _count: expect.any(Object),
        }),
      }),
    );
    const args = findMany.mock.calls[0][0];
    expect(args.include.bookings).toBeUndefined();
    expect(result[0]).toMatchObject({
      rating: 4.6,
      services: 4,
      bookings: 25,
      coverImage: null,
      workingHours: null,
      description: 'Description',
      totalStaff: 3,
      topServices: [],
    });
  });

  test('caps public page size at 100', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      branch: { findMany },
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    await new BranchesService(prisma, settings as any, branchState).findAll({ page: 1, limit: 500 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  test('validates public service and review pagination queries', async () => {
    const serviceQuery = Object.assign(new PublicBranchServicesQueryDto(), { page: 0, limit: 101 });
    const reviewQuery = Object.assign(new PublicBranchReviewsQueryDto(), { sort: 'popular' });

    expect((await validate(serviceQuery)).map((error) => error.property)).toEqual(expect.arrayContaining(['page', 'limit']));
    expect((await validate(reviewQuery)).map((error) => error.property)).toContain('sort');
  });

  test('rejects the removed fourteenth onboarding step', async () => {
    const dto = Object.assign(new SaveBranchOnboardingDto(), { currentStep: 14 });
    expect((await validate(dto)).map((error) => error.property)).toContain('currentStep');
  });

  test('groups active public services by category and paginates them', async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      branchServiceOffering: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'service-1',
            name: 'Chăm sóc da',
            description: 'Dịch vụ chuyên sâu',
            price: 500000,
            durationMinutes: 60,
            status: 'ACTIVE',
            category: { id: 'category-1', name: 'Da' },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const result = await new BranchesService(prisma as any, settings as any, branchState).findPublicServices('branch-1', {
      search: 'da',
      page: 1,
      limit: 10,
    });

    expect(prisma.branchServiceOffering.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: 'branch-1', status: 'ACTIVE', deletedAt: null }),
      skip: 0,
      take: 10,
    }));
    expect(result).toEqual({
      data: [{
        categoryId: 'category-1',
        categoryName: 'Da',
        services: [expect.objectContaining({ id: 'service-1', price: 500000, duration: 60 })],
      }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  test('returns approved reviews and masks anonymous customer names', async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      review: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'review-1',
            overallRating: 5,
            comment: 'Tốt',
            isAnonymous: true,
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            customer: { user: { fullName: 'Không được lộ', avatarMedia: { url: 'avatar.jpg' } } },
            serviceRatings: [],
            businessReply: null,
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _avg: { overallRating: 5 } }),
      },
    };

    const result = await new BranchesService(prisma as any, settings as any, branchState).findPublicReviews('branch-1', {
      sort: 'highest',
      page: 1,
      limit: 20,
    });

    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ overallRating: 'desc' }, { createdAt: 'desc' }],
    }));
    expect(result.data[0]).toMatchObject({ customerName: 'Ẩn danh', customerAvatar: null, rating: 5 });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.summary).toEqual({ averageRating: 5, totalReviews: 1 });
  });
});

describe('BranchesService branch lifecycle', () => {
  test('routes a different legal entity to new-business registration without creating a branch', async () => {
    const prisma = { branch: { create: jest.fn() } };
    const result = await new BranchesService(prisma as any, settings as any, branchState).create({
      businessId: 'business-1',
      sameLegalEntity: false,
    });

    expect(result).toMatchObject({
      created: false,
      requiresNewBusiness: true,
      redirectTo: '/register/business',
    });
    expect(prisma.branch.create).not.toHaveBeenCalled();
  });

  test('creates an isolated draft and never activates it during creation', async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      id: 'branch-1',
      businessId: data.businessId,
      reviewStatus: data.reviewStatus,
      operationalStatus: data.operationalStatus,
    }));
    const tx = {
      branch: { create },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      business: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'business-1',
          name: 'Beauty Business',
          status: 'ACTIVE',
          bookingRestrictedAt: null,
          bookingRestrictionReason: null,
        }),
      },
      branch: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const result = await new BranchesService(prisma as any, settings as any, branchState).create({
      businessId: 'business-1',
      sameLegalEntity: true,
      name: 'Chi nhánh mới',
      serviceMode: 'AT_LOCATION',
    }, 'owner-1');

    expect(result).toMatchObject({
      created: true,
      branch: {
        reviewStatus: 'DRAFT',
        operationalStatus: 'INACTIVE',
      },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'PENDING',
        reviewStatus: 'DRAFT',
        operationalStatus: 'INACTIVE',
      }),
    }));
  });

  test('keeps an approved branch inactive when the operational checklist is incomplete', async () => {
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'INACTIVE',
          reviewStatus: 'APPROVED',
          operationalStatus: 'INACTIVE',
          serviceMode: 'AT_LOCATION',
          serviceAreas: null,
          addressLine: '1 Nguyễn Huệ',
          districtId: 'district-1',
          phone: '0900000000',
          email: null,
          pendingHoldMinutes: 15,
          bookingPolicy: { confirmedAt: new Date() },
          business: { status: 'ACTIVE', bookingRestrictedAt: null, bookingRestrictionReason: null },
          _count: { services: 0, staff: 0, workingHours: 7 },
          combos: [],
        }),
      },
    };
    const service = new BranchesService(prisma as any, settings as any, branchState);

    await expect(service.publish('branch-1', 'owner-1')).rejects.toBeInstanceOf(ConflictException);
  });

  test('does not approve a branch before its parent business is approved', async () => {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'branch-1',
          reviewStatus: 'PENDING_REVIEW',
          business: { status: 'PENDING_REVIEW' },
          reviewRequests: [],
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new BranchesService(prisma as any, settings as any, branchState);

    await expect(service.review('branch-1', 'APPROVE', undefined, 'admin-1'))
      .rejects.toThrow('Doanh nghiệp chủ quản phải được duyệt');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('publishes only an approved and operationally ready branch', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'branch-1',
      reviewStatus: 'APPROVED',
      operationalStatus: 'ACTIVE',
    });
    const tx = {
      branch: { update },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'INACTIVE',
          reviewStatus: 'APPROVED',
          operationalStatus: 'READY_TO_PUBLISH',
          serviceMode: 'AT_LOCATION',
          serviceAreas: null,
          addressLine: '1 Nguyễn Huệ',
          districtId: 'district-1',
          phone: '0900000000',
          email: null,
          pendingHoldMinutes: 15,
          bookingPolicy: { confirmedAt: new Date() },
          business: { status: 'ACTIVE', bookingRestrictedAt: null, bookingRestrictionReason: null },
          _count: { services: 2, staff: 1, workingHours: 7 },
          combos: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const branchState = { transition: jest.fn().mockResolvedValue({
      transitioned: true,
      branch: { id: 'branch-1', status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE' },
    }) };
    const result = await new BranchesService(prisma as any, settings as any, branchState as any).publish('branch-1', 'owner-1');
    expect(result).toMatchObject({ operationalStatus: 'ACTIVE' });
    expect(branchState.transition).toHaveBeenCalledWith('branch-1', 'PUBLISH', 'owner-1', expect.any(String));
  });
});
