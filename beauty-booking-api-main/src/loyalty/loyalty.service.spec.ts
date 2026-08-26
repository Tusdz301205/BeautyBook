import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService balance safety', () => {
  it('caps redeemed points to the payable amount', async () => {
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-1' }) },
      loyaltyAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'account-1', balance: 100 }),
      },
      loyaltyRule: { findFirst: jest.fn().mockResolvedValue({ id: 'rule-1', version: 3, redemptionValuePerPoint: 1_000 }) },
    } as unknown as PrismaService;
    const result = await new LoyaltyService(prisma).previewRedemption('customer-1', 'branch-1', 100, 30_000);
    expect(result.points).toBe(30);
    expect(result.discount).toBe(30_000);
  });

  it('prevents a concurrent redemption from making balance negative', async () => {
    const tx: any = {
      loyaltyAccount: {
        upsert: jest.fn().mockResolvedValue({ id: 'account-1', balance: 20 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      loyaltyTransaction: { create: jest.fn() },
    };
    await expect(new LoyaltyService({} as PrismaService).redeemInTransaction(tx, {
      businessId: 'business-1', customerId: 'customer-1', bookingId: 'booking-1', points: 30,
      discount: 30_000, actorId: 'customer-user', rule: { id: 'rule-1', version: 1, redemptionValuePerPoint: 1_000 },
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });
});
