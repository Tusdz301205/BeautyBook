import { FinancialMetricsService } from './financial-metrics.service';

describe('FinancialMetricsService branch timezone reporting', () => {
  it('attributes collection and refund to the branch-local month at a UTC boundary', async () => {
    const prisma: any = {
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch-1', timezone: 'Asia/Ho_Chi_Minh' }]) },
      paymentTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'tx-1', branchId: 'branch-1', amount: 100_000, status: 'VERIFIED', verifiedAt: new Date('2025-12-31T18:00:00.000Z') },
        ]),
      },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      refundRequest: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'refund-1', amount: 20_000, processedAt: new Date('2026-01-31T18:00:00.000Z'), payment: { booking: { branchId: 'branch-1' } } },
        ]),
      },
    };

    const result = await new FinancialMetricsService(prisma).monthly(2026, {});

    expect(result[0]).toMatchObject({ grossRevenue: 100_000, refundAmount: 0, netRevenue: 100_000 });
    expect(result[1]).toMatchObject({ grossRevenue: 0, refundAmount: 20_000, netRevenue: -20_000 });
  });
});
