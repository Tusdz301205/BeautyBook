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
  const planUpdate = jest.fn().mockResolvedValue({ count: 1 });
  const prisma: any = {
    customerProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    },
    recurringBookingPlan: {
      create: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      updateMany: planUpdate,
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', customerId: 'customer-1', status: 'ACTIVE' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'plan-1',
        status: 'ACTIVE',
        bookings: [],
      }),
    },
  };
  prisma.booking = { findMany: jest.fn().mockResolvedValue([{ id: 'booking-1' }]) };
  prisma.$transaction = jest.fn((operation) => operation(prisma));
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
      where: { id: 'plan-1', status: 'CREATING', deletedAt: null },
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
      where: { id: 'plan-1', status: 'FAILED', failureReason: 'Tạo chuỗi thất bại; đang kiểm tra hoàn tác các kỳ đã tạo' },
      data: {
        status: 'FAILED',
        createdOccurrenceCount: 1,
        failureReason:
          'Tạo chuỗi thất bại; các kỳ đã tạo được hoàn tác bằng trạng thái CANCELLED',
      },
    });
  });

  test('does not compensate or overwrite a plan already recovered by another worker', async () => {
    const { service, bookings, planUpdate } = fixture();
    bookings.create.mockResolvedValueOnce({ id: 'booking-1' }).mockRejectedValueOnce(new ConflictException('recovered'));
    planUpdate.mockResolvedValue({ count: 0 });
    await expect(service.create(input, CUSTOMER)).rejects.toThrow('recovered');
    expect(bookings.compensateCreatedBookings).not.toHaveBeenCalled();
    expect(planUpdate).toHaveBeenCalledTimes(1);
  });

  test('cannot overwrite recovery with late activation after all occurrences return', async () => {
    const { service, bookings, planUpdate } = fixture();
    bookings.create.mockResolvedValue({ id: 'booking-1' });
    planUpdate.mockResolvedValue({ count: 0 });
    await expect(service.create(input, CUSTOMER)).rejects.toBeInstanceOf(ConflictException);
    expect(bookings.compensateCreatedBookings).not.toHaveBeenCalled();
  });

  test('compensates a committed booking even when its response failed before returning its id', async () => {
    const { service, bookings, prisma } = fixture();
    bookings.create.mockRejectedValueOnce(new Error('post-commit read failed'));
    prisma.booking.findMany.mockResolvedValue([{ id: 'committed-but-not-returned' }]);
    await expect(service.create(input, CUSTOMER)).rejects.toThrow('post-commit read failed');
    expect(bookings.compensateCreatedBookings).toHaveBeenCalledWith(['committed-but-not-returned'], expect.any(String));
  });

  test.each(['CREATING', 'FAILED', 'CANCELLED', 'COMPLETED'])('cannot resume a %s plan', async (status) => {
    const { service, prisma, planUpdate } = fixture();
    prisma.recurringBookingPlan.findFirst.mockResolvedValue({ id: 'plan-1', status });
    await expect(service.changeStatus('plan-1', 'ACTIVE', CUSTOMER)).rejects.toThrow('không thể thay đổi');
    expect(planUpdate).not.toHaveBeenCalled();
  });

  test('a stale pause request cannot reactivate a concurrently cancelled plan', async () => {
    const { service, planUpdate } = fixture();
    planUpdate.mockResolvedValue({ count: 0 });
    await expect(service.changeStatus('plan-1', 'PAUSED', CUSTOMER)).rejects.toBeInstanceOf(ConflictException);
    expect(planUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1', customerId: 'customer-1', status: 'ACTIVE', deletedAt: null }, data: { status: 'PAUSED' },
    });
  });
});
