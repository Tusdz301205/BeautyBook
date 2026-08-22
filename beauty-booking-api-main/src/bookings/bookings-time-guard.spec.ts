import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn().mockResolvedValue(undefined),
  notifyBookingCustomer: jest.fn().mockResolvedValue(undefined),
  notifySalonMembers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../common/utils/audit', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

const dateValue = (isoDay: string) => new Date(`${isoDay}T00:00:00.000Z`);
const timeValue = (hour: number) => new Date(Date.UTC(1970, 0, 1, hour));

function serviceFor(existing: Record<string, unknown>) {
  const updatedBooking = {
    id: 'booking-1', bookingCode: 'BB-TEST', status: 'COMPLETED',
    appointmentDate: existing.appointmentDate,
    totalAmount: existing.totalAmount,
    customer: { user: null }, branch: { name: 'Branch', business: { name: 'Business' } },
    bookingServices: [],
  };
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const historyCreate = jest.fn().mockResolvedValue({ id: 'history-1' });
  const prisma: any = {
    booking: {
      findUnique: jest.fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(updatedBooking),
      updateMany,
    },
    bookingStatusHistory: { create: historyCreate },
    customerVoucher: { updateMany: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation(prisma),
  );
  const mail = { sendBookingConfirmation: jest.fn(), sendBookingCancellation: jest.fn() };
  const gateway = { notifyBookingUpdated: jest.fn() };
  return {
    service: new BookingsService(prisma as never, mail as never, gateway as never),
    updateMany,
    customerVoucherUpdateMany: prisma.customerVoucher.updateMany,
    prisma,
  };
}

describe('BookingsService time transition guard', () => {
  test('direct service call cannot complete a future booking', async () => {
    const { service, updateMany } = serviceFor({
      id: 'booking-1', status: 'IN_PROGRESS',
      appointmentDate: dateValue('2099-07-20'),
      appointmentStartTime: timeValue(9), appointmentEndTime: timeValue(10),
      totalAmount: 465000, voucherId: null, bookingServices: [],
      branch: { businessId: 'business-1' },
    });
    await expect(
      service.updateStatus('booking-1', 'COMPLETED', 'staff-1', undefined, 'SALON', ['STAFF']),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test('past booking completes without overwriting the discounted finalAmount snapshot', async () => {
    const { service, updateMany } = serviceFor({
      id: 'booking-1', status: 'IN_PROGRESS',
      appointmentDate: dateValue('2020-07-20'),
      appointmentStartTime: timeValue(9), appointmentEndTime: timeValue(10),
      totalAmount: 465000, finalAmount: 420000, branch: { businessId: 'business-1' },
      voucherId: null, bookingServices: [],
    });
    await expect(
      service.updateStatus('booking-1', 'COMPLETED', 'staff-1', undefined, 'SALON', ['STAFF']),
    ).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }));
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty('finalAmount');
  });

  test('rejects a stale transition when another request already changed the status', async () => {
    const { service, updateMany } = serviceFor({
      id: 'booking-1', status: 'IN_PROGRESS',
      appointmentDate: dateValue('2020-07-20'),
      appointmentStartTime: timeValue(9), appointmentEndTime: timeValue(10),
      totalAmount: 465000, voucherId: null, bookingServices: [],
      branch: { businessId: 'business-1' },
    });
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.updateStatus('booking-1', 'COMPLETED', 'staff-1', undefined, 'SALON', ['STAFF']),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('confirmation commits a reserved voucher as used in the same transaction', async () => {
    const { service, customerVoucherUpdateMany } = serviceFor({
      id: 'booking-1', status: 'PENDING',
      appointmentDate: dateValue('2099-07-20'),
      appointmentStartTime: timeValue(9), appointmentEndTime: timeValue(10),
      totalAmount: 465000, voucherId: 'voucher-1', bookingServices: [],
      branch: { businessId: 'business-1' },
    });

    await service.updateStatus(
      'booking-1',
      'CONFIRMED',
      'receptionist-1',
      undefined,
      'SALON',
      ['RECEPTIONIST'],
    );

    expect(customerVoucherUpdateMany).toHaveBeenCalledWith({
      where: {
        usedBookingId: 'booking-1',
        voucherId: 'voucher-1',
        status: 'RESERVED',
      },
      data: { status: 'USED', usedAt: expect.any(Date) },
    });
  });

  test('two competing transitions from one state commit exactly once', async () => {
    const existing = {
      id: 'booking-1', status: 'IN_PROGRESS',
      appointmentDate: dateValue('2020-07-20'),
      appointmentStartTime: timeValue(9), appointmentEndTime: timeValue(10),
      totalAmount: 465000, voucherId: null, bookingServices: [],
      branch: { businessId: 'business-1' },
    };
    const { service, updateMany, prisma } = serviceFor(existing);
    const updated = {
      id: 'booking-1', bookingCode: 'BB-TEST', status: 'COMPLETED',
      appointmentDate: existing.appointmentDate,
      totalAmount: existing.totalAmount,
      customer: { user: null },
      branch: { name: 'Branch', business: { name: 'Business' } },
      bookingServices: [],
    };
    prisma.booking.findUnique
      .mockReset()
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValue(updated);
    updateMany
      .mockReset()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const outcomes = await Promise.allSettled([
      service.updateStatus(
        'booking-1', 'COMPLETED', 'staff-1', undefined, 'SALON', ['STAFF'],
      ),
      service.updateStatus(
        'booking-1', 'COMPLETED', 'staff-1', undefined, 'SALON', ['STAFF'],
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
  });
});
