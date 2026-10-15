import { NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

describe('public branch promotions', () => {
  const branch = { businessId: 'business-a', services: [{ id: 'service-a' }], combos: [{ id: 'combo-a' }] };
  function fixture(result: typeof branch | null = branch) {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue(result) },
      promotion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, service: new PromotionsService(prisma as never) };
  }

  test('does not query promotions for a hidden/unavailable branch', async () => {
    const { service, prisma } = fixture(null);
    await expect(service.getPublicForBranch('hidden')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.promotion.findMany).not.toHaveBeenCalled();
    expect(prisma.branch.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'hidden', deletedAt: null, status: 'ACTIVE', reviewStatus: 'APPROVED', operationalStatus: 'ACTIVE',
      business: { deletedAt: null, bookingRestrictedAt: null },
    });
  });

  test('requires campaign ownership, branch, service AND combo scope with active dates', async () => {
    const { service, prisma } = fixture();
    await service.getPublicForBranch('branch-a');
    const { where } = prisma.promotion.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ status: 'ACTIVE', deletedAt: null, startDate: { lte: expect.any(Date) }, endDate: { gte: expect.any(Date) } });
    expect(where.AND).toEqual([
      { OR: [{ createdByPlatform: true }, { businessId: 'business-a' }, { businessLinks: { some: { businessId: 'business-a' } } }] },
      { OR: [{ branchLinks: { none: {} } }, { branchLinks: { some: { branchId: 'branch-a' } } }] },
      { OR: [{ serviceLinks: { none: {} } }, { serviceLinks: { some: { serviceId: { in: ['service-a'] } } } }] },
      { OR: [{ comboLinks: { none: {} } }, { comboLinks: { some: { comboId: { in: ['combo-a'] } } } }] },
    ]);
  });

  test('projects public terms and local target IDs, excluding management identity fields', async () => {
    const { service, prisma } = fixture();
    prisma.promotion.findMany.mockResolvedValue([{ id: 'promo-a', name: 'Ưu đãi', discountValue: '15.00',
      audience: 'NEW_CUSTOMER', serviceLinks: [{ serviceId: 'service-a' }], comboLinks: [] }] as never);
    expect(await service.getPublicForBranch('branch-a')).toEqual([{ id: 'promo-a', name: 'Ưu đãi', discountValue: 15,
      audience: 'NEW_CUSTOMER', serviceIds: ['service-a'], comboIds: [] }]);
    const { select } = prisma.promotion.findMany.mock.calls[0][0];
    expect(select).not.toHaveProperty('businessOwner');
    expect(select).not.toHaveProperty('businessLinks');
    expect(select).not.toHaveProperty('createdByPlatform');
    expect(select.serviceLinks).toEqual({ where: { serviceId: { in: ['service-a'] } }, select: { serviceId: true } });
  });
});
