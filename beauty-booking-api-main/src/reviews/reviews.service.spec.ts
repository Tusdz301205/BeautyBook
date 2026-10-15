import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService tenant and booking integrity', () => {
  const customer: AuthUser = { id: 'user-1', email: 'test@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };
  const settings = { getEffective: jest.fn().mockResolvedValue({ reviewMinLength: 0, allowAnonymousReview: false, autoHideReviewReportThreshold: 3 }) } as any;
  it.each([
    ['CHECKED_IN', '2026-10-13T03:00:00Z', true],
    ['CHECKED_IN', '2026-10-13T02:59:59.999Z', false],
    ['CONFIRMED', '2026-10-13T03:00:00Z', false],
    ['NO_SHOW', '2026-10-13T03:00:00Z', false],
    ['IN_PROGRESS', '2026-10-13T03:00:00Z', false],
  ])('review eligibility of %s at %s is %s without changing booking/payment facts', async (status, instant, allowed) => {
    jest.useFakeTimers().setSystemTime(new Date(instant as string));
    try {
      const row = { id: 'booking-1', customerId: 'customer-1', customer: { userId: customer.id }, status, review: null,
        appointmentDate: new Date('2026-10-13'), appointmentStartTime: new Date('1970-01-01T09:30:00Z'), appointmentEndTime: new Date('1970-01-01T10:00:00Z'), bookingServices: [] };
      const create = jest.fn().mockResolvedValue({ id: 'r' });
      const tx = { booking: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn() }, review: { create }, $queryRaw: jest.fn() };
      const prisma = { $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>, options?: unknown) => fn(tx)) };
      const promise = new ReviewsService(prisma as never, settings).create({ bookingId: 'booking-1', customerId: 'customer-1', overallRating: 5 }, customer);
      if (allowed) await expect(promise).resolves.toEqual({ id: 'r' });
      else await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      expect(create).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(tx.booking.update).not.toHaveBeenCalled();
      expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
      expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'Serializable' });
    } finally { jest.useRealTimers(); }
  });
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
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
