import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withSerializableTransaction } from './serializable-transaction';

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('Database operation failed', { code, clientVersion: 'test', meta });

describe('Serializable transaction retry classification', () => {
  test.each([
    known('P2034'),
    known('P2010', { code: '40001' }),
    known('P2010', { driverAdapterError: { cause: { kind: 'TransactionWriteConflict', originalCode: '40001' } } }),
    known('P2010', { driverAdapterError: { cause: { originalCode: '40P01' } } }),
  ])('retries known serialization/deadlock conflicts (%j)', async (error) => {
    const prisma: any = { $transaction: jest.fn().mockRejectedValueOnce(error).mockResolvedValue('committed') };
    await expect(withSerializableTransaction(prisma, jest.fn())).resolves.toBe('committed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
  test('exhausted raw-query serialization conflict becomes HTTP 409', async () => {
    const prisma: any = { $transaction: jest.fn().mockRejectedValue(known('P2010', { code: '40001' })) };
    await expect(withSerializableTransaction(prisma, jest.fn(), { maxRetries: 1 })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
  test.each([
    { cause: { originalCode: '23P01' } },
    {
      meta: {
        driverAdapterError: {
          cause: { constraint: 'booking_services_staff_slot_no_overlap' },
        },
      },
    },
  ])('maps structured PostgreSQL exclusion conflicts to HTTP 409 (%j)', async (error) => {
    const prisma: any = { $transaction: jest.fn().mockRejectedValue(error) };
    await expect(withSerializableTransaction(prisma, jest.fn())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  test.each([known('P2010', { code: '42601' }), known('P2010'), new Error('40001 serialization failure'), known('P2003')])
  ('does not retry unrelated errors', async (error) => {
    const prisma: any = { $transaction: jest.fn().mockRejectedValue(error) };
    await expect(withSerializableTransaction(prisma, jest.fn())).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
