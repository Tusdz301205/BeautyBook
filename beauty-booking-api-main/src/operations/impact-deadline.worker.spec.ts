import type { PrismaService } from '../prisma/prisma.service';
import { ImpactDeadlineWorker } from './impact-deadline.worker';

describe('ImpactDeadlineWorker', () => {
  it('queues one deduplicated critical warning per overdue case deadline and current recipient', async () => {
    const deadlineAt = new Date('2026-08-20T00:00:00.000Z');
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const models = {
      operationalImpactCase: { findMany: jest.fn().mockResolvedValue([{
        id: 'impact-1', businessId: 'business-1', ownerId: 'owner-1', subjectType: 'STAFF', action: 'OFFBOARD',
        reason: 'Nhân viên nghỉ việc', status: 'IN_PROGRESS', deadlineAt,
      }]) },
      business: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null, owner: { userId: 'owner-1' } }) },
      userRole: { findFirst: jest.fn().mockResolvedValue({ userId: 'owner-1' }) },
      notificationOutbox: { createMany, findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      ...models,
      $transaction: jest.fn(async (operation: (tx: typeof models) => Promise<unknown>) => operation(models)),
    } as unknown as PrismaService;

    await expect(new ImpactDeadlineWorker(prisma).enqueueOverdueWarnings()).resolves.toEqual({ queued: 1 });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        userId: 'owner-1', severity: 'CRITICAL',
        dedupeKey: `impact-overdue:impact-1:${deadlineAt.toISOString()}:owner-1`,
      })],
    }));
  });
});
