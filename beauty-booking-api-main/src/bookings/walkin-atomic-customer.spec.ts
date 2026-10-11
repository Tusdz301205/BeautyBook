import { BadRequestException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';
const branchId = '11111111-1111-4111-8111-111111111111';
const user = { id: 'owner', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz' }], sessionType: 'salon' } as AuthUser;
describe('walk-in guest allocation shares the booking transaction', () => {
  it('a service/availability rejection never persists a guest before the booking service transaction', async () => {
    const prisma = { branchBookingPolicy: { findUnique: jest.fn().mockResolvedValue({ allowWalkIn: true, allowCounterBooking: true }) }, user: { create: jest.fn().mockResolvedValue({ customerProfile: { id: 'guest-profile' } }) } };
    const create = jest.fn().mockRejectedValue(new BadRequestException('Giờ đặt nằm ngoài giờ mở cửa của chi nhánh'));
    // Scope authorization is already covered by access suites; this test focuses
    // on orchestration and the pre-transaction persistence regression.
    const controller = Object.assign(Object.create(BookingsController.prototype), { prisma, bookingsAccess: { assertCustomerCreate: jest.fn().mockResolvedValue('biz') }, bookingsService: { create }, assertCounterLeadScope: jest.fn() }) as BookingsController;
    await expect(controller.create({ branchId, guestName: 'QA guest', source: 'WALK_IN', serviceIds: [branchId], appointmentDate: '2026-10-08T16:00:00Z' }, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: user.id }), { authorizedCounter: true }, expect.objectContaining({ fullName: 'QA guest', customerId: expect.any(String), userId: expect.any(String) }));
  });
});
