import { BookingsService } from './bookings.service';

function build(prisma: Record<string, unknown>) {
  return new BookingsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('BookingsService fail-closed tenant filters', () => {
  it('keeps an explicitly empty branch scope on statistics queries', async () => {
    const count = jest.fn().mockResolvedValue(0);
    const service = build({ booking: { count } });

    await expect(service.getStatsForBranches([])).resolves.toEqual({
      total: 0,
      pending: 0,
      confirmed: 0,
      checkedIn: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    });
    for (const call of count.mock.calls) {
      expect(call[0].where.branchId).toEqual({ in: [] });
    }
  });

  it('applies an empty branch scope to category drill-down', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = build({ booking: { findMany } });

    await service.getByCategory('Chăm sóc da', []);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: { in: [] } }),
    }));
  });

  it('applies the allowed branches to customer drill-down', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = build({
      customerProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'customer-1',
          user: { id: 'user-1', fullName: 'Customer', phone: null },
        }),
      },
      booking: { findMany },
    });

    await service.getByCustomer('user-1', ['branch-1']);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: { in: ['branch-1'] } }),
    }));
  });
});
