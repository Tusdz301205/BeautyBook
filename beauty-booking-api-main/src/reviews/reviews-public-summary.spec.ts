import type { PrismaService } from '../prisma/prisma.service';
import type { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ReviewsService } from './reviews.service';

describe('Public service rating summary', () => {
  const settings = {} as PlatformSettingsService;

  it('includes older ratings in the summary while returning only the latest 50 reviews', async () => {
    const latestRatings = Array.from({ length: 50 }, () => ({
      rating: 5,
      comment: 'Dịch vụ tốt',
      createdAt: new Date('2026-08-01'),
      staff: { id: 'staff-1', fullName: 'Staff' },
      review: { isAnonymous: true, customer: { user: { fullName: 'Customer' } } },
    }));
    // The 50 older eligible ratings are one-star, so the full average is 3.
    const prisma = {
      reviewServiceRating: {
        findMany: jest.fn().mockResolvedValue(latestRatings),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3 }, _count: 100 }),
      },
    };
    const result = await new ReviewsService(prisma as unknown as PrismaService, settings)
      .findByService('service-1');

    expect(result.ratings).toHaveLength(50);
    expect(result).toMatchObject({ averageRating: 3, totalRatings: 100 });
    expect(prisma.reviewServiceRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' }, take: 50,
    }));
    expect(prisma.reviewServiceRating.aggregate).toHaveBeenCalledWith({
      where: {
        bookingService: { serviceId: 'service-1' },
        review: { status: 'APPROVED', deletedAt: null },
      },
      _avg: { rating: true },
      _count: true,
    });
  });

  it('excludes hidden, reported, pending and deleted reviews from both the feed and its summary', async () => {
    const prisma = {
      reviewServiceRating: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: 0 }),
      },
    };
    const result = await new ReviewsService(prisma as unknown as PrismaService, settings)
      .findByService('service-2');

    const listQuery = prisma.reviewServiceRating.findMany.mock.calls[0][0];
    const summaryQuery = prisma.reviewServiceRating.aggregate.mock.calls[0][0];
    expect(listQuery.where).toEqual({
      bookingService: { serviceId: 'service-2' },
      review: { status: 'APPROVED', deletedAt: null },
    });
    expect(summaryQuery.where).toEqual(listQuery.where);
    expect(summaryQuery).not.toHaveProperty('take');
    expect(result).toEqual({ averageRating: 0, totalRatings: 0, ratings: [] });
  });
});
