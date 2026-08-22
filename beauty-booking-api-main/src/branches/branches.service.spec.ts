import type { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from './branches.service';
import { validate } from 'class-validator';
import { UpdateBranchDto } from './dto/branch.dto';
import { ConflictException } from '@nestjs/common';

const settings = {
  getEffective: jest.fn().mockResolvedValue({ maxBranchesPerBusiness: 20 }),
};

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
        business: { id: 'business-1', name: 'Business', status: 'ACTIVE' },
        district: { name: 'District', province: { name: 'Province' } },
        districtId: 'district-1',
        services: [],
        _count: { services: 4, bookings: 25 },
      },
    ]);
    const prisma = {
      branch: { findMany },
      $queryRaw: jest.fn().mockResolvedValue([{ branchId: 'branch-1', rating: '4.56' }]),
    } as unknown as PrismaService;

    const result = await new BranchesService(prisma, settings as any).findAll({ page: 2, limit: 20 });

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
    expect(result[0]).toMatchObject({ rating: 4.6, services: 4, bookings: 25 });
  });

  test('caps public page size at 100', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      branch: { findMany },
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    await new BranchesService(prisma, settings as any).findAll({ page: 1, limit: 500 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});

describe('BranchesService branch lifecycle', () => {
  test('routes a different legal entity to new-business registration without creating a branch', async () => {
    const prisma = { branch: { create: jest.fn() } };
    const result = await new BranchesService(prisma as any, settings as any).create({
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

    const result = await new BranchesService(prisma as any, settings as any).create({
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
          staff: [],
          combos: [],
        }),
      },
    };
    const service = new BranchesService(prisma as any, settings as any);

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
    const service = new BranchesService(prisma as any, settings as any);

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
          staff: [{ id: 'staff-1', _count: { workingHours: 0, scheduleVersions: 1 } }],
          combos: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const result = await new BranchesService(prisma as any, settings as any).publish('branch-1', 'owner-1');
    expect(result).toMatchObject({ operationalStatus: 'ACTIVE' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE', operationalStatus: 'ACTIVE' }),
    }));
  });
});
