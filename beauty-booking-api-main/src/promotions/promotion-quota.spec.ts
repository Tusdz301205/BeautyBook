import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from './promotions.service';

const OWNER: AuthUser = {
  id: 'owner-1', email: 'owner@example.com', roles: ['BUSINESS_OWNER'], sessionType: 'salon',
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business-1', branchId: null }],
  permissions: ['promotion:manage:tenant'],
};

function quotaPrisma(activeCount: number, customerCounts: number[]) {
  const promotion = {
    businessId: 'business-1', createdByPlatform: false,
    businessLinks: [], branchLinks: [], serviceLinks: [],
    startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2026-09-01T00:00:00Z'), discountType: 'PERCENTAGE',
  };
  const prisma: any = {
    promotion: { findUnique: jest.fn().mockResolvedValue(promotion), update: jest.fn().mockResolvedValue({ id: 'promotion-1' }) },
    promotionRedemption: {
      count: jest.fn().mockResolvedValue(activeCount),
      groupBy: jest.fn().mockResolvedValue(customerCounts.map((count, index) => ({ customerId: `customer-${index}`, _count: { _all: count } }))),
    },
    branch: { count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)) },
    branchServiceOffering: { count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)) },
    combo: { count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)) },
    promotionBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
    promotionService: { deleteMany: jest.fn(), createMany: jest.fn() },
    promotionCombo: { deleteMany: jest.fn(), createMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  return prisma;
}

describe('Promotion quota update safety', () => {
  it('does not lower total quota below reserved/applied redemptions', async () => {
    const prisma = quotaPrisma(3, [2, 1]);
    await expect(new PromotionsService(prisma as PrismaService).update('promotion-1', { totalQuantity: 2 }, OWNER))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.promotion.update).not.toHaveBeenCalled();
  });

  it('does not lower per-customer quota below actual usage', async () => {
    const prisma = quotaPrisma(4, [3, 1]);
    await expect(new PromotionsService(prisma as PrismaService).update('promotion-1', { maxUsagePerCustomer: 2 }, OWNER))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.promotion.update).not.toHaveBeenCalled();
  });

  it('increments the rule version when a safe quota change is accepted', async () => {
    const prisma = quotaPrisma(2, [1, 1]);
    await new PromotionsService(prisma as PrismaService).update('promotion-1', { totalQuantity: 10, maxUsagePerCustomer: 2 }, OWNER);
    expect(prisma.promotion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalQuantity: 10, maxUsagePerCustomer: 2, version: { increment: 1 } }),
    }));
  });

  it('replaces tenant scopes atomically while versioning the rule', async () => {
    const prisma = quotaPrisma(0, []);
    await new PromotionsService(prisma as PrismaService).update('promotion-1', {
      branchIds: ['branch-1'], serviceIds: ['service-1'], comboIds: ['combo-1'],
    }, OWNER);
    expect(prisma.promotionBranch.deleteMany).toHaveBeenCalledWith({ where: { promotionId: 'promotion-1' } });
    expect(prisma.promotionBranch.createMany).toHaveBeenCalledWith({ data: [{ promotionId: 'promotion-1', branchId: 'branch-1' }] });
    expect(prisma.promotionService.createMany).toHaveBeenCalledWith({ data: [{ promotionId: 'promotion-1', serviceId: 'service-1' }] });
    expect(prisma.promotionCombo.createMany).toHaveBeenCalledWith({ data: [{ promotionId: 'promotion-1', comboId: 'combo-1' }] });
  });
});
