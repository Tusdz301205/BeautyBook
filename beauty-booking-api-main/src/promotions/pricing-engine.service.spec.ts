import type { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from './pricing-engine.service';

describe('PricingEngineService quote', () => {
  it.each(['NEW_CUSTOMER', 'RETURNING_CUSTOMER'])('actual prior check-in determines %s promotion eligibility without fake completion', async audience => {
    const findCustomer = jest.fn(async ({ select }) => ({ user: { dateOfBirth: null },
      bookings: (select.bookings.where.OR[0].status.in ?? []).includes('CHECKED_IN') ? [{ id: 'prior-visit' }] : [] }));
    const prisma = { branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business' }) },
      promotion: { findMany: jest.fn().mockResolvedValue([{ id: 'promo', name: 'Offer', version: 1, audience, discountType: 'FIXED_AMOUNT', discountValue: 10,
        totalQuantity: 100, maxUsagePerCustomer: 2, stackingAllowed: false, startDate: new Date('2026-08-01'), endDate: new Date('2026-09-01'), branchLinks: [], comboLinks: [], serviceLinks: [] }]) },
      customerProfile: { findUnique: findCustomer }, customerBusinessSegment: { findMany: jest.fn().mockResolvedValue([]) }, promotionRedemption: { count: jest.fn().mockResolvedValue(0) } };
    const quote = await new PricingEngineService(prisma as never).quote({ customerId: 'customer', branchId: 'branch', serviceIds: ['service'], subtotal: 100, at: new Date('2026-08-22T00:00:00Z') });
    expect(Boolean(quote.promotion)).toBe(audience === 'RETURNING_CUSTOMER');
    expect(quote.finalAmount).toBe(audience === 'RETURNING_CUSTOMER' ? 90 : 100);
  });
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

describe('server allocated walk-in identity before atomic insert', () => {
  function fixture() {
    const db = { branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz' }) }, promotion: { findMany: jest.fn().mockResolvedValue([]) }, customerProfile: { findUnique: jest.fn().mockResolvedValue(null) }, customerBusinessSegment: { findMany: jest.fn().mockResolvedValue([]) } };
    return { db, service: new PricingEngineService(db as never) };
  }
  const input = { customerId: 'allocated', branchId: 'branch', serviceIds: ['service'], subtotal: 100 };
  it('ordinary missing customer still rejects rather than getting fake successful pricing', async () => {
    await expect(fixture().service.quote(input)).rejects.toThrow('Khách hàng không tồn tại');
  });
  it('only exact server-allocated ID can receive unknown-DOB/empty-history pricing before its transaction', async () => {
    await expect(fixture().service.quote(input, { allocatedWalkInCustomerId: input.customerId })).resolves.toMatchObject({ subtotal: 100, finalAmount: 100 });
    await expect(fixture().service.quote(input, { allocatedWalkInCustomerId: 'foreign' })).rejects.toThrow('không khớp');
  });
  it('an existing profile remains authoritative even when an allocation context is supplied', async () => {
    const { db, service } = fixture(); db.customerProfile.findUnique.mockResolvedValue({ user: { dateOfBirth: null }, bookings: [{ id: 'old-booking' }] } as never);
    await expect(service.quote(input, { allocatedWalkInCustomerId: input.customerId })).resolves.toMatchObject({ finalAmount: 100 });
    expect(db.customerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: input.customerId } }));
  });
});
