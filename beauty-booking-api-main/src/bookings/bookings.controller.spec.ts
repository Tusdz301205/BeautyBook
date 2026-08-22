import { BadRequestException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';

describe('BookingsController authenticated customer checkout', () => {
  const buildController = (profile: { id: string } | null = { id: 'customer-1' }) => {
    const bookingsService = {
      create: jest.fn().mockResolvedValue({ id: 'booking-1' }),
    };
    const prisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
    };
    const controller = new BookingsController(
      bookingsService as never,
      {} as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { controller, bookingsService, prisma };
  };

  it('reuses the booking service for an authenticated customer', async () => {
    const { controller, bookingsService, prisma } = buildController();
    const body = {
      branchId: 'branch-1',
      serviceIds: ['service-1'],
      comboId: undefined,
      appointmentDate: '2026-07-22T09:00:00.000Z',
      note: 'Cần phòng yên tĩnh',
      staffId: 'staff-1',
      guestName: 'Nguyễn An',
      guestPhone: '+84901234567',
    };

    await expect(controller.createGuest(body, {
      id: 'user-1',
      email: 'customer@example.com',
      roles: ['CUSTOMER'],
      permissions: ['booking:create:self'],
    } as any)).resolves.toMatchObject({ id: 'booking-1' });

    expect(prisma.customerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    });
    expect(bookingsService.create).toHaveBeenCalledWith({
      branchId: 'branch-1',
      serviceIds: ['service-1'],
      comboId: undefined,
      appointmentDate: '2026-07-22T09:00:00.000Z',
      note: 'Cần phòng yên tĩnh',
      staffId: 'staff-1',
      customerId: 'customer-1',
      createdBy: 'user-1',
      source: 'ONLINE_WEB',
    });
  });

  it('rejects an authenticated account without a customer profile', async () => {
    const { controller, bookingsService } = buildController(null);

    await expect(
      controller.createGuest({
        branchId: 'branch-1',
        serviceIds: ['service-1'],
        appointmentDate: '2026-07-22T09:00:00.000Z',
        guestName: 'Nguyễn An',
        guestPhone: '+84901234567',
      }, {
        id: 'user-1',
        email: 'customer@example.com',
        roles: ['CUSTOMER'],
        permissions: ['booking:create:self'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingsService.create).not.toHaveBeenCalled();
  });
});
