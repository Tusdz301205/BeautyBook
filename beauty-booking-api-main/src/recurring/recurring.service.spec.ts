import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RecurringService } from './recurring.service';

const CUSTOMER: AuthUser = {
  id: 'customer-user',
  email: 'customer@example.com',
  roles: ['CUSTOMER'],
  scopes: [{ code: 'CUSTOMER', businessId: null, branchId: null }],
  sessionType: 'customer',
};

const input: any = {
  branchId: 'branch-1',
  serviceIds: ['service-1'],
  staffMode: 'ANY_AVAILABLE',
  frequency: 'WEEKLY',
  startDate: '2099-07-20',
  preferredTime: '09:00',
  occurrenceCount: 2,
  skipConflicts: false,
};

function fixture() {
  const planUpdate = jest.fn().mockResolvedValue({ id: 'plan-1' });
  const prisma: any = {
    customerProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    },
    recurringBookingPlan: {
      create: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      update: planUpdate,
      findUnique: jest.fn().mockResolvedValue({
        id: 'plan-1',
        status: 'ACTIVE',
        bookings: [],
      }),
    },
  };
  const bookings = {
    create: jest.fn(),
    compensateCreatedBookings: jest.fn().mockResolvedValue(1),
  };
  const service = new RecurringService(prisma, bookings as never);
  jest.spyOn(service, 'preview').mockResolvedValue({
    serviceIds: ['service-1'],
    comboId: null,
    durationMinutes: 60,
    occurrences: [
      {
        appointmentDate: '2099-07-20T02:00:00.000Z',
        available: true,
        staffId: 'staff-1',
      },
      {
        appointmentDate: '2099-07-27T02:00:00.000Z',
        available: true,
        staffId: 'staff-1',
      },
    ],
    availableCount: 2,
    conflictCount: 0,
  });
  return { service, bookings, prisma, planUpdate };
}

describe('RecurringService creation saga', () => {
  test('keeps an explicit CREATING state until every occurrence succeeds', async () => {
    const { service, bookings, prisma, planUpdate } = fixture();
    bookings.create
      .mockResolvedValueOnce({ id: 'booking-1' })
      .mockResolvedValueOnce({ id: 'booking-2' });

    await expect(service.create(input, CUSTOMER)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
    expect(prisma.recurringBookingPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'CREATING',
        createdOccurrenceCount: 0,
      }),
    });
    expect(planUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: {
        status: 'ACTIVE',
        createdOccurrenceCount: 2,
        failureReason: null,
      },
    });
  });

  test('compensates successful reservations instead of hard-deleting them', async () => {
    const { service, bookings, planUpdate } = fixture();
    bookings.create
      .mockResolvedValueOnce({ id: 'booking-1' })
      .mockRejectedValueOnce(new ConflictException('slot conflict'));

    await expect(service.create(input, CUSTOMER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(bookings.compensateCreatedBookings).toHaveBeenCalledWith(
      ['booking-1'],
      'Hoàn tác do không thể tạo trọn vẹn chuỗi lịch',
    );
    expect(planUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: {
        status: 'FAILED',
        createdOccurrenceCount: 1,
        failureReason:
          'Tạo chuỗi thất bại; các kỳ đã tạo được hoàn tác bằng trạng thái CANCELLED',
      },
    });
  });
});
