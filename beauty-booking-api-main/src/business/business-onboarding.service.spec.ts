import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessOnboardingService } from './business-onboarding.service';

describe('BusinessOnboardingService state machine', () => {
  const settings = { getEffective: jest.fn() } as any;
  test('review requires a pending-review business', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'DRAFT' }) },
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'APPROVE', undefined, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('request-info requires a reason', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'PENDING_REVIEW' }) },
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'REQUEST_INFO', undefined, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('approve moves pending review to approved', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'biz-1', status: 'APPROVED' });
    const businessReviewEventCreate = jest.fn().mockResolvedValue({ id: 'event-1' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', status: 'PENDING_REVIEW', documents: [] }),
        update,
      },
      businessReviewEvent: { create: businessReviewEventCreate },
      auditLog: { create: auditCreate },
      $transaction: jest.fn(async (callback) => callback({
        business: { update },
        businessReviewEvent: { create: businessReviewEventCreate },
        businessDocument: { update: jest.fn() },
        documentReviewEvent: { create: jest.fn() },
      })),
    } as unknown as PrismaService;
    await expect(
      new BusinessOnboardingService(prisma, settings).review('biz-1', 'APPROVE', undefined, 'admin-1'),
    ).resolves.toMatchObject({ status: 'APPROVED' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED' }),
    }));
  });
});
