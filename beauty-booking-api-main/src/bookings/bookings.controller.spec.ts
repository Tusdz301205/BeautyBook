import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';

describe('BookingsController authenticated customer checkout', () => {
  const buildController = (profile: { id: string } | null = { id: 'customer-1' }) => {
    const bookingsService = {
      create: jest.fn().mockResolvedValue({ id: 'booking-1' }),
    };
    const prisma = {
      branchBookingPolicy: { findUnique: jest.fn().mockResolvedValue({ allowWalkIn: true, allowCounterBooking: true }) },
      user: { create: jest.fn() },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
    };
    const controller = new BookingsController(
      bookingsService as never,
      { assertCustomerCreate: jest.fn().mockResolvedValue('business-1') } as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { controller, bookingsService, prisma };
  };

  const counterUser = { id: 'receptionist-1', roles: ['RECEPTIONIST'] } as any;
  const counterRequest = {
    branchId: 'branch-1', serviceIds: ['service-1'],
    appointmentDate: '2099-07-22T09:00:00.000Z', guestName: 'Khách tại quầy', guestPhone: '0901234567',
  };

  it.each(['ONLINE_WEB', 'ONLINE_APP', 'ADMIN_CREATED'] as const)('rejects forged staff booking source %s before creating a guest', async (source) => {
    const { controller, bookingsService, prisma } = buildController();
    await expect(controller.create({ ...counterRequest, source }, counterUser)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(bookingsService.create).not.toHaveBeenCalled();
  });

  it.each(['WALK_IN', 'PHONE', 'STAFF_CREATED'] as const)('rejects disabled channel %s before creating a guest', async (source) => {
    const { controller, bookingsService, prisma } = buildController();
    prisma.branchBookingPolicy.findUnique.mockResolvedValue({ allowWalkIn: false, allowCounterBooking: false });
    await expect(controller.create({ ...counterRequest, source }, counterUser)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(bookingsService.create).not.toHaveBeenCalled();
  });

  it('customer booking uses the authenticated profile and online source regardless of client fields', async () => {
    const { controller, bookingsService } = buildController();
    await controller.create({ ...counterRequest, source: 'STAFF_CREATED', customerId: 'someone-else' }, {
      id: 'customer-user', roles: ['CUSTOMER'],
    } as any);
    expect(bookingsService.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer-1', source: 'ONLINE_WEB' }));
  });

  it('keeps cancelled item status and historical service snapshot in the customer response', async () => {
    const { controller, bookingsService } = buildController();
    bookingsService.create.mockResolvedValue({ id: 'booking-1', branchId: 'branch-1', bookingServices: [{
      id: 'item-1', serviceId: 'service-1', status: 'CANCELLED', serviceNameSnapshot: 'Tên khi đặt', durationMinutes: 60,
      priceAtBooking: 100000, service: { id: 'service-1', name: 'Tên đã đổi' },
    }] } as any);
    const result = await controller.createGuest(counterRequest, { id: 'customer-user', roles: ['CUSTOMER'] } as any);
    expect(result.branchId).toBe('branch-1');
    expect(result.bookingServices[0]).toMatchObject({ status: 'CANCELLED', serviceNameSnapshot: 'Tên khi đặt', durationMinutes: 60 });
  });

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
