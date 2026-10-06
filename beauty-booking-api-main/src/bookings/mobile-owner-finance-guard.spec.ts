import { assertMobileOwnerWithoutFinance } from './mobile-owner-finance-guard';

describe('Owner mobile finance constraint', () => {
  it('allows ordinary bookings without related money/benefit records', async () => {
    const tx = { booking: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(assertMobileOwnerWithoutFinance(tx as any, 'booking')).resolves.toBeUndefined();
    const query = tx.booking.findFirst.mock.calls[0][0];
    expect(query.where.id).toBe('booking');
    expect(query.where.OR).toEqual(expect.arrayContaining([
      { payments: { some: {} } }, { paymentTransactions: { some: {} } }, { paymentIntents: { some: {} } },
      { packageEntitlements: { some: {} } }, { refs_VoucherRedemption_bookingId: { some: {} } },
      { refs_LoyaltyTransaction_bookingId: { some: {} } },
    ]));
    expect(query.select).toEqual({ id: true });
  });
  it('blocks financial review cases without returning amounts or refund data', async () => {
    const tx = { booking: { findFirst: jest.fn().mockResolvedValue({ id: 'booking' }) } };
    await expect(assertMobileOwnerWithoutFinance(tx as any, 'booking')).rejects.toMatchObject({ status: 409,
      response: { code: 'MOBILE_FINANCE_REVIEW_REQUIRED' } });
  });
});
