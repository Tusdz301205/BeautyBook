import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService tenant and booking integrity', () => {
  const customer: AuthUser = { id: 'user-1', email: 'test@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };
  const settings = { getEffective: jest.fn().mockResolvedValue({ reviewMinLength: 0, allowAnonymousReview: false, autoHideReviewReportThreshold: 3 }) } as any;
  it.each(['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'BRANCH_MANAGER'])(
    'denies platform review moderation to %s even in its own branch',
    async (roleCode) => {
      const user: AuthUser = {
        id: 'salon-user-1', email: 'salon@example.test', roles: [roleCode],
        scopes: [{ code: roleCode, businessId: 'business-1', branchId: 'branch-1' }],
        sessionType: 'salon',
        permissions: ['review:moderate:branch'],
      };
      const update = jest.fn();
      const prisma = {
        review: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'review-2', booking: { branch: { id: 'branch-1', businessId: 'business-1' } },
          }),
          update,
        },
      } as unknown as PrismaService;
      await expect(new ReviewsService(prisma, settings).moderate('review-2', 'HIDDEN', 'POLICY', 'Không có quyền nền tảng', user))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('rejects service ratings copied from another booking', async () => {
    const create = jest.fn();
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', customerId: 'customer-1', customer: { userId: customer.id }, status: 'COMPLETED', review: null,
        bookingServices: [{ id: 'booking-service-1', staffId: 'staff-1' }],
      }) },
      review: { create },
    } as unknown as PrismaService;
    await expect(new ReviewsService(prisma, settings).create({
      bookingId: 'booking-1', customerId: 'customer-1', overallRating: 5,
      serviceRatings: [{ bookingServiceId: 'booking-service-other', rating: 5 }],
    }, customer)).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('publishes a valid completed-booking review immediately', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'review-1', status: 'APPROVED' });
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', customerId: 'customer-1', customer: { userId: customer.id }, status: 'COMPLETED', review: null,
        bookingServices: [],
      }) },
      review: { create },
    } as unknown as PrismaService;

    await new ReviewsService(prisma, settings).create({
      bookingId: 'booking-1', customerId: 'customer-1', overallRating: 5,
      comment: 'Dịch vụ tốt',
    }, customer);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED' }),
    }));
  });
});
