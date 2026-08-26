import type { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from './pricing-engine.service';

describe('PricingEngineService quote', () => {
  it('applies a service-scoped promotion only to the eligible line value', async () => {
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }) },
      promotion: { findMany: jest.fn().mockResolvedValue([{
        id: 'promotion-1', name: 'Giảm dịch vụ A', version: 2, discountType: 'PERCENTAGE', discountValue: 50,
        audience: 'ALL', totalQuantity: 100, maxUsagePerCustomer: 2, stackingAllowed: false,
        startDate: new Date('2026-08-01'), endDate: new Date('2026-09-01'),
        branchLinks: [], comboLinks: [], serviceLinks: [{ serviceId: 'service-a' }],
      }]) },
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ user: { dateOfBirth: null }, bookings: [] }) },
      customerBusinessSegment: { findMany: jest.fn().mockResolvedValue([]) },
      promotionRedemption: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const result = await new PricingEngineService(prisma).quote({
      customerId: 'customer-1', branchId: 'branch-1', serviceIds: ['service-a', 'service-b'], subtotal: 300_000,
      lineItems: [{ serviceId: 'service-a', amount: 100_000 }, { serviceId: 'service-b', amount: 200_000 }],
      at: new Date('2026-08-22T00:00:00Z'),
    });
    expect(result.promotion?.amount).toBe(50_000);
    expect(result.finalAmount).toBe(250_000);
    expect(result.promotion?.snapshot).toEqual(expect.objectContaining({ eligibleSubtotal: 100_000, version: 2 }));
  });

  it('explains why an exhausted promotion was not applied', async () => {
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }) },
      promotion: { findMany: jest.fn().mockResolvedValue([{
        id: 'promotion-1', name: 'Số lượng có hạn', version: 1, discountType: 'FIXED_AMOUNT', discountValue: 20_000,
        audience: 'ALL', totalQuantity: 1, maxUsagePerCustomer: 1, stackingAllowed: false,
        startDate: new Date('2026-08-01'), endDate: new Date('2026-09-01'), branchLinks: [], comboLinks: [], serviceLinks: [],
      }]) },
      customerProfile: { findUnique: jest.fn().mockResolvedValue({ user: { dateOfBirth: null }, bookings: [] }) },
      customerBusinessSegment: { findMany: jest.fn().mockResolvedValue([]) },
      promotionRedemption: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const result = await new PricingEngineService(prisma).quote({
      customerId: 'customer-1', branchId: 'branch-1', serviceIds: ['service-a'], subtotal: 100_000,
      lineItems: [{ serviceId: 'service-a', amount: 100_000 }], at: new Date('2026-08-22T00:00:00Z'),
    });
    expect(result.promotion).toBeNull();
    expect(result.explanations).toContain('Số lượng có hạn: đã hết lượt');
  });
});
