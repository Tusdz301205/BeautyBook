import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from './promotions.service';
import { VouchersAdminService } from './vouchers-admin.service';

const OWNER: AuthUser = {
  id: 'owner-1', email: 'owner@example.com', roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz-1', branchId: null }],
  sessionType: 'salon',
};

const PLATFORM_ADMIN: AuthUser = {
  id: 'platform-1', email: 'platform@example.com', roles: ['PLATFORM_ADMIN'],
  scopes: [{ code: 'PLATFORM_ADMIN', businessId: null, branchId: null }],
  sessionType: 'admin',
};

describe('campaign tenant ownership', () => {
  test('owner cannot update another tenant promotion', async () => {
    const prisma = {
      promotion: { findUnique: jest.fn().mockResolvedValue({
        businessId: 'biz-2', createdByPlatform: false, businessLinks: [{ businessId: 'biz-2' }],
      }) },
    } as unknown as PrismaService;
    await expect(
      new PromotionsService(prisma).update('promotion-2', { name: 'x' }, OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('owner cannot revoke another tenant voucher', async () => {
    const prisma = {
      voucher: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz-2', createdByPlatform: false }) },
    } as unknown as PrismaService;
    await expect(
      new VouchersAdminService(prisma).softDelete('voucher-2', OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('owner cannot edit platform voucher', async () => {
    const prisma = {
      voucher: { findUnique: jest.fn().mockResolvedValue({ businessId: null, createdByPlatform: true }) },
    } as unknown as PrismaService;
    await expect(
      new VouchersAdminService(prisma).update('voucher-platform', { name: 'x' }, OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('platform cannot update a tenant promotion even with platform permission', async () => {
    const prisma = {
      promotion: { findUnique: jest.fn().mockResolvedValue({
        businessId: 'biz-1', createdByPlatform: false,
        businessLinks: [{ businessId: 'biz-1' }], branchLinks: [], serviceLinks: [],
      }) },
    } as unknown as PrismaService;
    await expect(
      new PromotionsService(prisma).update('promotion-1', { name: 'x' }, PLATFORM_ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('platform cannot create a promotion linked to tenant resources', async () => {
    const prisma = {} as unknown as PrismaService;
    await expect(
      new PromotionsService(prisma).create({
        name: 'x', discountType: 'PERCENTAGE', discountValue: 10,
        startDate: '2026-08-08T00:00:00.000Z', endDate: '2026-08-09T00:00:00.000Z',
        businessIds: ['biz-1'],
      }, null, true, PLATFORM_ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('platform cannot update or grant a tenant voucher', async () => {
    const prisma = {
      voucher: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz-1', createdByPlatform: false }) },
    } as unknown as PrismaService;
    const service = new VouchersAdminService(prisma);
    await expect(service.update('voucher-1', { name: 'x' }, PLATFORM_ADMIN))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.grantToCustomer('voucher-1', '00000000-0000-4000-8000-000000000001', PLATFORM_ADMIN))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
