import { BookingsService } from './bookings.service';

describe('Pending hold expiry never overwrites verified execution', () => {
  it('filters running/completed evidence both when discovering and when claiming, including a correction race', async () => {
    const tx = { booking: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, bookingStatusHistory: { create: jest.fn() }, bookingService: { updateMany: jest.fn() } };
    const prisma = { booking: { findMany: jest.fn().mockResolvedValue([{ id: 'new-qa', voucherId: null, bookingServices: [] }]) },
      $transaction: jest.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)) };
    const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    expect(await service.expirePendingHolds('branch')).toBe(0);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      branchId: 'branch', bookingServices: { none: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
    }) }));
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 'new-qa', status: 'PENDING', bookingServices: { none: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
    }) }));
    expect(tx.bookingStatusHistory.create).not.toHaveBeenCalled();expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
  });
});
