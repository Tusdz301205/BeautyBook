import { Logger } from '@nestjs/common';
import { TrustSnapshotService } from '../admin/trust-snapshot.service';
import { TrustSnapshotCron } from './trust-snapshot.cron';

function fixture() {
  const snapshots = new Map<string, Date | null>([
    ['missing', null], ['outdated', new Date(2026, 8, 7, 2)],
    ['fresh', new Date(2026, 8, 8, 2)],
  ]);
  const findMany = jest.fn(async ({ where }) => {
    const cutoff = where.OR[1].trustSnapshot.is.computedAt.lt;
    return [...snapshots].filter(([, computedAt]) => !computedAt || computedAt < cutoff)
      .map(([id]) => ({ id }));
  });
  const upsertSnapshot = jest.fn(async (id: string) => { snapshots.set(id, new Date()); });
  const prisma = { business: { findMany } };
  const service = { upsertSnapshot };
  return { prisma, service, findMany, upsertSnapshot, snapshots };
}

describe('TrustSnapshotCron catch-up', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.setSystemTime(new Date(2026, 8, 8, 2, 6));
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test('a tick outside the old five-minute window catches up missing/old snapshots only', async () => {
    const f = fixture();
    await new TrustSnapshotCron(f.prisma as never, f.service as never).tick();
    expect(f.upsertSnapshot.mock.calls.map(([id]) => id)).toEqual(['missing', 'outdated']);
    expect(f.findMany.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE', deletedAt: null });
  });

  test('a restarted worker does not repeat fresh snapshots, but runs again the next day', async () => {
    const f = fixture();
    await new TrustSnapshotCron(f.prisma as never, f.service as never).tick();
    const restarted = new TrustSnapshotCron(f.prisma as never, f.service as never);
    await restarted.tick();
    expect(f.upsertSnapshot).toHaveBeenCalledTimes(2);
    jest.setSystemTime(new Date(2026, 8, 9, 2, 9));
    await restarted.tick();
    expect(f.upsertSnapshot).toHaveBeenCalledTimes(5);
  });

  test('waits until 02:00 and catches up at startup after 02:00', async () => {
    const f = fixture();
    const worker = new TrustSnapshotCron(f.prisma as never, f.service as never);
    jest.setSystemTime(new Date(2026, 8, 8, 1, 59));
    await worker.tick();
    expect(f.findMany).not.toHaveBeenCalled();
    jest.setSystemTime(new Date(2026, 8, 8, 7, 42));
    worker.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(f.upsertSnapshot).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(f.findMany).toHaveBeenCalledTimes(1);
  });

  test('failed businesses remain due and are retried without repeating successful ones', async () => {
    const f = fixture();
    f.upsertSnapshot.mockRejectedValueOnce(new Error('temporary failure'));
    const worker = new TrustSnapshotCron(f.prisma as never, f.service as never);
    await worker.tick();
    await worker.tick();
    expect(f.upsertSnapshot.mock.calls.map(([id]) => id)).toEqual(['missing', 'outdated', 'missing']);
  });

  test('scan failures are caught and do not disable later ticks', async () => {
    const f = fixture();
    f.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    const worker = new TrustSnapshotCron(f.prisma as never, f.service as never);
    await expect(worker.tick()).resolves.toBeUndefined();
    await worker.tick();
    expect(f.upsertSnapshot).toHaveBeenCalledTimes(2);
  });

  test('slow scans cannot overlap in one worker', async () => {
    const f = fixture();
    let resolve!: (rows: { id: string }[]) => void;
    f.findMany.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const worker = new TrustSnapshotCron(f.prisma as never, f.service as never);
    const first = worker.tick();
    await worker.tick();
    expect(f.findMany).toHaveBeenCalledTimes(1);
    resolve([]);
    await first;
  });

  test('snapshot service advances computedAt for both create and update', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const service = new TrustSnapshotService({ salonTrustSnapshot: { upsert } } as never, {} as never, {} as never);
    jest.spyOn(service, 'computeForBusiness').mockResolvedValue({
      totalBookings: 1, cancellationRate: 0, noShowRate: 0, avgRejectTimeMinutes: 0,
      lateCancelBySalonRate: 0, trustScore: 100, alertLevel: 'OK',
    });
    await service.upsertSnapshot('business-1');
    expect(upsert.mock.calls[0][0].create.computedAt).toEqual(new Date());
    expect(upsert.mock.calls[0][0].update.computedAt).toEqual(new Date());
  });
});
