import { BookingsService } from './bookings.service';

jest.mock('../common/utils/notify', () => ({
  notifyBookingBothParties: jest.fn().mockResolvedValue(undefined),
  notifyBookingCustomer: jest.fn().mockResolvedValue(undefined),
  notifySalonMembers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../common/utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

function fixture(claimCount = 1) {
  const prisma: any = {
    booking: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'booking-1',
          voucherId: 'voucher-1',
          bookingServices: [{ comboId: 'combo-1' }],
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: claimCount }),
    },
    bookingStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
    customerVoucher: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    voucher: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    combo: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  prisma.$transaction = jest.fn(
    async (operation: (tx: unknown) => Promise<unknown>) => operation(prisma),
  );

  return {
    service: new BookingsService(prisma, {} as never, {} as never, {} as never),
    prisma,
  };
}

describe('BookingsService voucher/combo reservation lifecycle', () => {
  test('expired pending hold releases voucher and combo capacity atomically', async () => {
    const { service, prisma } = fixture();

    await expect(service.expirePendingHolds('branch-1')).resolves.toBe(1);

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: 'PENDING',
        pendingExpiresAt: { lte: expect.any(Date) },
      },
      data: { status: 'EXPIRED', pendingExpiresAt: null },
    });
    expect(prisma.customerVoucher.updateMany).toHaveBeenCalledWith({
      where: {
        usedBookingId: 'booking-1',
        voucherId: 'voucher-1',
        status: { in: ['RESERVED', 'USED'] },
      },
      data: {
        status: 'ACTIVE',
        reservedAt: null,
        usedAt: null,
        usedBookingId: null,
      },
    });
    expect(prisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'voucher-1', usedQuantity: { gt: 0 } },
      data: { usedQuantity: { decrement: 1 } },
    });
    expect(prisma.combo.updateMany).toHaveBeenCalledWith({
      where: { id: 'combo-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  test('does not release capacity when another worker already claimed the hold', async () => {
    const { service, prisma } = fixture(0);

    await expect(service.expirePendingHolds()).resolves.toBe(0);

    expect(prisma.bookingStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.customerVoucher.updateMany).not.toHaveBeenCalled();
    expect(prisma.combo.updateMany).not.toHaveBeenCalled();
  });
});
