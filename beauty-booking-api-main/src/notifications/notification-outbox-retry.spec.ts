import { Logger } from '@nestjs/common';
import { NotificationOutboxWorker } from './notification-outbox.worker';

function fixture(overrides: Record<string, unknown> = {}) {
  const row: any = {
    id: 'outbox-1', userId: 'private-user', title: 'private title', body: 'private body',
    type: 'SYSTEM', severity: 'INFO', status: 'PENDING', attempts: 0,
    availableAt: new Date(0), updatedAt: new Date(0), createdAt: new Date(0),
    ...overrides,
  };
  const matches = (where: any) => Object.entries(where).every(([key, expected]: [string, any]) => {
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if (expected.in && !expected.in.includes(row[key])) return false;
      if (expected.equals !== undefined && row[key] !== expected.equals) return false;
      if (expected.lt !== undefined && !(row[key] < expected.lt)) return false;
      if (expected.lte !== undefined && !(row[key] <= expected.lte)) return false;
      if (expected.gte !== undefined && !(row[key] >= expected.gte)) return false;
      return true;
    }
    return row[key] === expected;
  });
  const updateMany = jest.fn(async ({ where, data }) => {
    if (!matches(where)) return { count: 0 };
    for (const [key, value] of Object.entries(data) as [string, any][]) {
      row[key] = value?.increment !== undefined ? row[key] + value.increment : value;
    }
    row.updatedAt = new Date();
    return { count: 1 };
  });
  const prisma: any = {
    notificationOutbox: {
      updateMany,
      count: jest.fn(async ({ where }) => matches(where) ? 1 : 0),
      findMany: jest.fn(async ({ where, select }) => matches(where) ? [select ? { id: row.id } : { ...row }] : []),
      findUnique: jest.fn(async () => ({ ...row })),
      update: jest.fn(async ({ where, data }) => {
        if (!matches(where)) throw new Error('Lost claim');
        Object.assign(row, data);
        return { ...row };
      }),
    },
    notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
  };
  prisma.$transaction = jest.fn(async (operation) => operation(prisma));
  return { prisma, row, worker: new NotificationOutboxWorker(prisma) };
}

describe('Notification outbox retry exhaustion and fencing', () => {
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T10:00:00Z'));
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test('tenth failure becomes terminal and is not retried', async () => {
    const { prisma, row, worker } = fixture({ attempts: 9 });
    prisma.notification.create.mockRejectedValue(new Error('temporary failure with private body'));
    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
    expect(row).toMatchObject({ status: 'FAILED', attempts: 10 });
    expect(errorLog).toHaveBeenCalledWith('NOTIFICATION_OUTBOX_DEAD_LETTER id=outbox-1 attempts=10');
    await worker.drain();
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/private body|private-user|private title/);
  });

  test('ninth failure uses backoff rather than premature dead-lettering', async () => {
    const { prisma, row, worker } = fixture({ attempts: 8 });
    prisma.notification.create.mockRejectedValue(new Error('temporary failure'));
    await worker.drain();
    expect(row).toMatchObject({ status: 'FAILED', attempts: 9 });
    expect(row.availableAt.getTime()).toBe(Date.now() + 512_000);
    expect(warnLog).toHaveBeenCalledWith(expect.stringContaining('NOTIFICATION_OUTBOX_RETRY'));
    expect(errorLog).not.toHaveBeenCalled();
    await worker.drain();
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  test('the final permitted attempt may still succeed', async () => {
    const { row, worker } = fixture({ attempts: 9 });
    await expect(worker.drain()).resolves.toEqual({ processed: 1 });
    expect(row).toMatchObject({ status: 'SENT', attempts: 10, notificationId: 'notification-1' });
    expect(errorLog).not.toHaveBeenCalled();
  });

  test.each(['FAILED', 'PENDING', 'PROCESSING'])(
    'discovers historical exhausted %s rows without sending or deleting them', async (status) => {
      const { prisma, row, worker } = fixture({ status, attempts: 10, lastError: 'retained failure' });
      await worker.drain();
      expect(row.status).toBe('FAILED');
      expect(row.attempts).toBe(10);
      expect(row.body).toBe('private body');
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(errorLog).toHaveBeenCalledWith('NOTIFICATION_OUTBOX_DEAD_LETTER_BACKLOG count=1 sampleIds=outbox-1');
      await worker.drain();
      expect(errorLog).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(5 * 60_000);
      await worker.drain();
      expect(errorLog).toHaveBeenCalledTimes(2);
    },
  );

  test('does not steal a live tenth-attempt claim', async () => {
    const { prisma, row, worker } = fixture({ status: 'PROCESSING', attempts: 10, updatedAt: new Date() });
    await worker.drain();
    expect(row.status).toBe('PROCESSING');
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('an old attempt cannot project a row reclaimed under a newer attempt', async () => {
    const { prisma, worker } = fixture();
    prisma.notificationOutbox.findUnique.mockResolvedValue({ id: 'outbox-1', status: 'PROCESSING', attempts: 2 });
    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notificationOutbox.update).not.toHaveBeenCalled();
  });

  test('a failed stale attempt cannot overwrite the new worker claim', async () => {
    const { prisma, row, worker } = fixture();
    prisma.notification.create.mockImplementation(async () => {
      row.attempts = 2;
      throw new Error('old attempt failed');
    });
    await worker.drain();
    expect(row).toMatchObject({ status: 'PROCESSING', attempts: 2 });
    expect(warnLog).toHaveBeenCalledWith('NOTIFICATION_OUTBOX_CLAIM_LOST id=outbox-1 attempt=1');
    expect(errorLog).not.toHaveBeenCalled();
  });
});
