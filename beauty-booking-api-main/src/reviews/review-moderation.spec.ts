import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

const review = {
  id: 'review-1', status: 'APPROVED', customer: { userId: 'customer-user' },
  booking: { branch: { businessId: 'business-1' } },
};

describe('Review moderation lifecycle', () => {
  const settings = { getEffective: jest.fn() } as any;

  it('quarantines severe/PII reports so public APPROVED queries cannot include them', async () => {
    const prisma: any = {
      review: { findUnique: jest.fn().mockResolvedValue(review), update: jest.fn().mockResolvedValue({ ...review, status: 'HIDDEN' }) },
      reviewReport: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), count: jest.fn().mockResolvedValue(1) },
      reviewModerationEvent: { create: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner-user' }]) },
      notification: { createMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
    const result = await new ReviewsService(prisma as PrismaService, settings).report('review-1', 'reporter-1', {
      reason: 'Có số điện thoại cá nhân', category: 'PII', severity: 'MEDIUM',
    });
    expect(result).toEqual({ reportCount: 1, status: 'HIDDEN', quarantined: true });
    expect(prisma.review.update).toHaveBeenCalledWith({ where: { id: 'review-1' }, data: { status: 'HIDDEN' } });
    expect(prisma.reviewModerationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'QUARANTINE', reportCategory: 'PII' }) });
  });

  it('blocks duplicate reports from the same actor', async () => {
    const prisma = {
      review: { findUnique: jest.fn().mockResolvedValue(review) },
      reviewReport: { findUnique: jest.fn().mockResolvedValue({ id: 'report-existing' }) },
    } as unknown as PrismaService;
    await expect(new ReviewsService(prisma, settings).report('review-1', 'reporter-1', { reason: 'Lặp lại' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates one pending appeal with immutable moderation history', async () => {
    const prisma: any = {
      review: { findUnique: jest.fn().mockResolvedValue({ ...review, status: 'HIDDEN' }) },
      userRole: { findFirst: jest.fn().mockResolvedValue(null) },
      reviewAppeal: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'appeal-1', status: 'PENDING' }) },
      reviewModerationEvent: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
    await new ReviewsService(prisma as PrismaService, settings).appeal('review-1', 'customer-user', 'Nội dung không vi phạm');
    expect(prisma.reviewAppeal.create).toHaveBeenCalled();
    expect(prisma.reviewModerationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'APPEAL_SUBMITTED' }) });
  });
});
