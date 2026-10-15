import { ForbiddenException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const user: AuthUser = { id: 'qa-author', email: 'qa@example.test', roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], sessionType: 'customer' };

describe('customer review pending appeal projection', () => {
  test.each([0, 1])('pending count %i returns a safe flag without internal relation fields', async pending => {
    const row = { id: 'own-booking', status: 'COMPLETED', branch: { timezone: 'Asia/Ho_Chi_Minh' }, bookingServices: [],
      review: { id: 'review', status: 'HIDDEN', overallRating: 4, comment: 'QA review', _count: { refs_ReviewAppeal_reviewId: pending } } };
    const findMany = jest.fn().mockResolvedValue([row]);
    const prisma = { customerProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'own-customer' }) }, booking: { findMany, fields: { appointmentStartTime: { name: 'appointmentStartTime' } } } };
    const controller = new BookingsController({} as never, {} as never, prisma as never, {} as never, {} as never, {} as never, {} as never);
    const result = await controller.myAppointments(user, 'completed');
    expect(result.data[0].review).toMatchObject({ id: 'review', hasPendingAppeal: pending > 0 });
    expect(JSON.stringify(result.data[0].review)).not.toContain('_count');
    expect(JSON.stringify(result.data[0].review)).not.toContain('refs_ReviewAppeal');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: 'own-customer', deletedAt: null }),
      include: expect.objectContaining({ review: expect.objectContaining({ select: expect.objectContaining({
        _count: { select: { refs_ReviewAppeal_reviewId: { where: { status: 'PENDING' } } } },
      }) }) }) }));
  });

  test('a missing customer profile cannot query any review or another customer bookings', async () => {
    const findMany = jest.fn();
    const prisma = { customerProfile: { findFirst: jest.fn().mockResolvedValue(null) }, booking: { findMany, fields: { appointmentStartTime: { name: 'appointmentStartTime' } } } };
    const controller = new BookingsController({} as never, {} as never, prisma as never, {} as never, {} as never, {} as never, {} as never);
    await expect(controller.myAppointments(user, 'completed')).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
