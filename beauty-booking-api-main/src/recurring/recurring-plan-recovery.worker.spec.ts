import { Logger } from '@nestjs/common';
import { RecurringPlanRecoveryWorker, RECURRING_CREATION_TIMEOUT_MS } from './recurring-plan-recovery.worker';

function fixture() {
  const tx = {
    recurringBookingPlan: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ occurrenceCount: 12, customer: { userId: 'user-1' } }),
      update: jest.fn(),
    },
    booking: { count: jest.fn().mockResolvedValue(6) },
    notificationOutbox: { createMany: jest.fn() },
  };
  const prisma = {
    recurringBookingPlan: { findMany: jest.fn().mockResolvedValue([{ id: 'plan-1' }]) },
    $transaction: jest.fn(async (operation) => operation(tx)),
  };
  return { worker: new RecurringPlanRecoveryWorker(prisma as never), prisma, tx };
}

describe('Recurring plan crash recovery', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('fails only stale creation, counts committed bookings and queues one durable notice in the transaction', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T10:00:00Z'));
    const { worker, prisma, tx } = fixture();
    await worker.tick();
    const cutoff = new Date(Date.now() - RECURRING_CREATION_TIMEOUT_MS);
    expect(prisma.recurringBookingPlan.findMany).toHaveBeenCalledWith({
      where: { status: 'CREATING', deletedAt: null, updatedAt: { lte: cutoff } },
      select: { id: true }, orderBy: { updatedAt: 'asc' }, take: 100,
    });
    expect(tx.recurringBookingPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'plan-1', status: 'CREATING', deletedAt: null, updatedAt: { lte: cutoff } }, data: { status: 'FAILED' },
    });
    expect(tx.recurringBookingPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' }, data: { createdOccurrenceCount: 6, failureReason: expect.stringContaining('6/12') },
    });
    expect(tx.notificationOutbox.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'user-1', dedupeKey: 'recurring-recovery:plan-1', actionUrl: '/customer/appointments' })], skipDuplicates: true,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });

  it('does nothing after a fresh heartbeat or a competing recovery wins', async () => {
    const { worker, tx } = fixture();
    tx.recurringBookingPlan.updateMany.mockResolvedValue({ count: 0 });
    await worker.tick();
    expect(tx.booking.count).not.toHaveBeenCalled();
    expect(tx.notificationOutbox.createMany).not.toHaveBeenCalled();
  });

  it('propagates notice failure out of the transaction so state and notice roll back together', async () => {
    const { worker, tx, prisma } = fixture();
    tx.notificationOutbox.createMany.mockRejectedValueOnce(new Error('outbox unavailable'));
    await worker.tick();
    await expect(prisma.$transaction.mock.results[0].value).rejects.toThrow('outbox unavailable');
    await worker.tick();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('continues with other plans after one recovery fails', async () => {
    const { worker, tx, prisma } = fixture();
    prisma.recurringBookingPlan.findMany.mockResolvedValue([{ id: 'plan-1' }, { id: 'plan-2' }]);
    tx.recurringBookingPlan.updateMany.mockRejectedValueOnce(new Error('database unavailable'));
    await worker.tick();
    expect(tx.notificationOutbox.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notificationOutbox.createMany.mock.calls[0][0].data[0].dedupeKey).toBe('recurring-recovery:plan-2');
  });

  it('releases its running guard after a scan failure', async () => {
    const { worker, prisma } = fixture();
    prisma.recurringBookingPlan.findMany.mockRejectedValueOnce(new Error('scan failed'));
    await worker.tick();
    await worker.tick();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not overlap local ticks', async () => {
    const { worker, prisma } = fixture();
    let release!: (value: Array<{ id: string }>) => void;
    prisma.recurringBookingPlan.findMany.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const first = worker.tick();
    await worker.tick();
    expect(prisma.recurringBookingPlan.findMany).toHaveBeenCalledTimes(1);
    release([]);
    await first;
  });

  it('runs on startup, once a minute and stops on shutdown', async () => {
    jest.useFakeTimers();
    const { worker } = fixture();
    const tick = jest.spyOn(worker, 'tick').mockResolvedValue(undefined);
    worker.onModuleInit();
    worker.onModuleInit();
    expect(tick).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
