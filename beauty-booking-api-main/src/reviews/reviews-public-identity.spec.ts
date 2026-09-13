import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ReviewsService } from './reviews.service';

describe('Public review identity', () => {
  const settings = {} as PlatformSettingsService;
  const customer = {
    id: 'private-customer-id',
    userId: 'private-user-id',
    user: {
      id: 'private-user-id',
      fullName: 'Private Customer Name',
      email: 'private-customer@example.com',
      avatarMedia: { url: '/media/customer-avatar.jpg', visibility: 'PUBLIC' },
    },
  };

  function setup(isAnonymous: boolean, visibility = 'PUBLIC') {
    const review = {
      id: 'review-1',
      customerId: customer.id,
      bookingId: 'private-booking-id',
      isAnonymous,
      customer: {
        ...customer,
        user: { ...customer.user, avatarMedia: { ...customer.user.avatarMedia, visibility } },
      },
      overallRating: 5,
      comment: 'Dịch vụ tốt',
      status: 'APPROVED',
      createdAt: new Date('2026-08-01T10:00:00Z'),
      serviceRatings: [],
      booking: { branch: { name: 'Salon' }, appointmentDate: new Date('2026-08-01') },
      businessReply: null,
    };
    const rating = {
      id: 'rating-1',
      reviewId: review.id,
      bookingServiceId: 'private-booking-service-id',
      rating: 5,
      comment: 'Dịch vụ tốt',
      createdAt: review.createdAt,
      review,
      bookingService: { service: { name: 'Cắt tóc' } },
      staff: { id: 'staff-1', fullName: 'Staff Name' },
    };
    const prisma = {
      review: {
        findMany: jest.fn().mockResolvedValue([review]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _avg: { overallRating: 5 }, _count: 1 }),
      },
      reviewServiceRating: {
        findMany: jest.fn().mockResolvedValue([rating]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: 1 }),
      },
      reviewAppeal: { findMany: jest.fn().mockResolvedValue([]) },
      reviewModerationEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, service: new ReviewsService(prisma as unknown as PrismaService, settings) };
  }

  it.each(['business', 'staff', 'service'] as const)(
    'does not disclose an anonymous customer identity through the %s feed',
    async (feed) => {
      const { prisma, service } = setup(true);
      const result = feed === 'business'
        ? await service.findByBusiness('business-1')
        : feed === 'staff'
          ? await service.findByStaff('staff-1')
          : await service.findByService('service-1');
      const rows = 'data' in result ? result.data : result.ratings;

      expect(rows[0].customerName).toBe('Ẩn danh');
      for (const identity of [
        customer.id, customer.userId, customer.user.fullName, customer.user.email,
        customer.user.avatarMedia.url, 'private-booking-id', 'private-booking-service-id',
      ]) {
        expect(JSON.stringify(result)).not.toContain(identity);
      }
      if (feed === 'staff') {
        expect(prisma.reviewServiceRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
          include: expect.objectContaining({
            review: expect.objectContaining({ select: expect.objectContaining({ isAnonymous: true }) }),
          }),
        }));
      } else if (feed === 'service') {
        expect(prisma.reviewServiceRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
          select: expect.objectContaining({
            review: expect.objectContaining({ select: expect.objectContaining({ isAnonymous: true }) }),
          }),
        }));
      }
    },
  );

  it('retains the chosen public display name across every public feed', async () => {
    const { service } = setup(false);
    const business = await service.findByBusiness('business-1');
    const staff = await service.findByStaff('staff-1');
    const selectedService = await service.findByService('service-1');

    for (const item of [business.data[0], staff.ratings[0], selectedService.ratings[0]]) {
      expect(item.customerName).toBe(customer.user.fullName);
      expect(item).not.toHaveProperty('customerId');
      expect(item).not.toHaveProperty('customer');
    }
    expect(business.data[0].customerAvatar).toBe(customer.user.avatarMedia.url);
  });

  it('does not publish a private avatar even when the reviewer is not anonymous', async () => {
    const { prisma, service } = setup(false, 'PRIVATE');
    const result = await service.findByBusiness('business-1');

    expect(result.data[0].customerName).toBe(customer.user.fullName);
    expect(result.data[0].customerAvatar).toBeNull();
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        customer: { select: { user: { select: {
          fullName: true, avatarMedia: { select: { url: true, visibility: true } },
        } } } },
      }),
    }));
  });

  it('preserves identity for the separately authorized management view', async () => {
    const { service } = setup(true);
    const admin: AuthUser = {
      id: 'admin-1', email: 'admin@example.com', roles: ['PLATFORM_ADMIN'],
      scopes: [{ code: 'PLATFORM_ADMIN' }], sessionType: 'admin',
      permissions: ['review:moderate:platform'],
    };

    const result = await service.findForManagement(admin);

    expect(result[0].customer.user.fullName).toBe(customer.user.fullName);
    expect(result[0].customer.user.email).toBe(customer.user.email);
  });
});
