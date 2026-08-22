import { calculateFinancialTotals } from './financial-metrics.service';

describe('financial metrics', () => {
  test('partial refund preserves gross and subtracts refund from net revenue', () => {
    expect(
      calculateFinancialTotals([
        { amount: 1_000_000, refundRequests: [{ amount: 200_000 }] },
      ]),
    ).toEqual({
      grossRevenue: 1_000_000,
      refundAmount: 200_000,
      netRevenue: 800_000,
      paymentCount: 1,
    });
  });
});
