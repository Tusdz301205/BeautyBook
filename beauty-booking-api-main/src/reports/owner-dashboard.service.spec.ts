import { ReportsService } from './reports.service';

describe('ReportsService owner dashboard', () => {
  test('applies the same branch and date scope to KPI and chart source queries', async () => {
    const branchFindMany = jest.fn().mockResolvedValue([]);
    const bookingFindMany = jest.fn().mockResolvedValue([]);
    const paymentFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      branch: { findMany: branchFindMany },
      booking: { findMany: bookingFindMany },
      payment: { findMany: paymentFindMany },
      staffAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceExceptionRequest: { count: jest.fn().mockResolvedValue(0) },
      review: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ReportsService(prisma as any, {} as any);

    const result = await service.getOwnerDashboard({
      scope: { businessIds: ['business-1'], branchIds: ['branch-1'] },
      branchId: 'branch-1',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-07T00:00:00.000Z'),
    });

    expect(result.scope).toEqual({ branchId: 'branch-1', branchCount: 0 });
    expect(result.charts.revenueSeries).toHaveLength(7);
    expect(result.charts.bookingStatus).toEqual(expect.arrayContaining([
      { status: 'NO_SHOW', count: 0 },
    ]));
    expect(branchFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'branch-1',
      }),
    }));
    expect(bookingFindMany.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        appointmentDate: {
          gte: new Date('2026-07-01T00:00:00.000Z'),
          lte: new Date('2026-07-07T23:59:59.999Z'),
        },
        branch: expect.objectContaining({ id: 'branch-1' }),
      }),
    }));
    expect(paymentFindMany.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        booking: {
          branch: expect.objectContaining({ id: 'branch-1' }),
        },
      }),
    }));
  });
});
