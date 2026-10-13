import { BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('review report supported classifications and text boundaries', () => {
  test.each([
    { reason: 'QA', category: 'UNSUPPORTED' },
    { reason: 'QA', severity: 'UNSUPPORTED' },
    { reason: 'a'.repeat(1001) },
  ])('rejects invalid report before any database access', async input => {
    const findUnique = jest.fn();
    const service = new ReviewsService({ review: { findUnique } } as never, {} as never);
    await expect(service.report('review', 'actor', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('appeal follows the same 1000 character limit as the customer form before opening a transaction', async () => {
    const transaction = jest.fn();
    const service = new ReviewsService({ $transaction: transaction } as never, {} as never);
    await expect(service.appeal('review', { id: 'author' } as never, 'a'.repeat(1001))).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
