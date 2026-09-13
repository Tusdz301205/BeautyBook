import type { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

function service(prisma: PrismaService) {
  return new BookingsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never);
}

describe('operational scheduler scope', () => {
  test('staff-only scheduler constrains staff and bookings and removes contact data', async () => {
    const staffFindMany = jest.fn().mockResolvedValue([{ id: 'staff-1' }]);
    const bookingFindMany = jest.fn().mockResolvedValue([
      {
        id: 'booking-1',
        customer: {
          id: 'customer-1',
          user: { id: 'user-1', fullName: 'Customer', email: 'private@example.test', phone: '0900' },
        },
        bookingServices: [],
      },
    ]);
    const prisma = {
      staffProfile: { findMany: staffFindMany },
      booking: { findMany: bookingFindMany },
    } as unknown as PrismaService;

    const result = await service(prisma).getSchedulerData(
      'branch-1',
      '2026-07-15T00:00:00.000Z',
      '2026-07-21T23:59:59.999Z',
      { staffId: 'staff-1', redactCustomerContact: true },
    );

    expect(staffFindMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ branchId: 'branch-1', id: 'staff-1' }),
    );
    expect(bookingFindMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        branchId: 'branch-1',
        bookingServices: { some: { staffId: 'staff-1' } },
      }),
    );
    expect(result.bookings[0].customer?.user).toEqual(
      expect.objectContaining({ email: null, phone: null }),
    );
  });

  test('an explicitly empty branch scope returns no booking rows', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { booking: { findMany, count } } as unknown as PrismaService;

    await service(prisma).findAll({ allowedBranchIds: [] });
    expect(findMany.mock.calls[0][0].where.branchId).toEqual({ in: [] });
    expect(count.mock.calls[0][0].where.branchId).toEqual({ in: [] });
  });
});
