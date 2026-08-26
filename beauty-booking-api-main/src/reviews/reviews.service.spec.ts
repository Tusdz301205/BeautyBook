import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

const MANAGER: AuthUser = {
  id: 'manager-1', email: 'manager@example.com', roles: ['BRANCH_MANAGER'],
  scopes: [{ code: 'BRANCH_MANAGER', businessId: 'business-1', branchId: 'branch-1' }],
  sessionType: 'salon',
  permissions: ['review:moderate:branch'],
};

describe('ReviewsService tenant and booking integrity', () => {
  const settings = { getEffective: jest.fn().mockResolvedValue({ reviewMinLength: 0, allowAnonymousReview: false, autoHideReviewReportThreshold: 3 }) } as any;
  it('blocks a manager from moderating another branch review', async () => {
    const update = jest.fn();
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-2', booking: { branch: { id: 'branch-2', businessId: 'business-1' } },
        }),
        update,
      },
    } as unknown as PrismaService;
    await expect(new ReviewsService(prisma, settings).moderate('review-2', 'HIDDEN', 'POLICY', 'Ngoài phạm vi', MANAGER))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects service ratings copied from another booking', async () => {
    const create = jest.fn();
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', review: null,
        bookingServices: [{ id: 'booking-service-1', staffId: 'staff-1' }],
      }) },
      review: { create },
    } as unknown as PrismaService;
    await expect(new ReviewsService(prisma, settings).create({
      bookingId: 'booking-1', customerId: 'customer-1', overallRating: 5,
      serviceRatings: [{ bookingServiceId: 'booking-service-other', rating: 5 }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('publishes a valid completed-booking review immediately', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'review-1', status: 'APPROVED' });
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', review: null,
        bookingServices: [],
      }) },
      review: { create },
    } as unknown as PrismaService;

    await new ReviewsService(prisma, settings).create({
      bookingId: 'booking-1', customerId: 'customer-1', overallRating: 5,
      comment: 'Dịch vụ tốt',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED' }),
    }));
  });
});
