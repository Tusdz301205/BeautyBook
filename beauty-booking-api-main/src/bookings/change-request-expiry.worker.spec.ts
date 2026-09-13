import { Logger } from '@nestjs/common';
import { ChangeRequestExpiryWorker } from './change-request-expiry.worker';
import { ChangeRequestsService } from './change-requests.service';

describe('ChangeRequestExpiryWorker', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Logger.prototype, 'log').mockImplementation(); });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test('expires only overdue pending requests without any user interaction', async () => {
    const now = new Date('2026-09-08T10:00:00Z');
    jest.setSystemTime(now);
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const requests = new ChangeRequestsService(
      { appointmentChangeRequest: { updateMany } } as never, {} as never, {} as never,
    );
    const worker = new ChangeRequestExpiryWorker(requests);
    await worker.tick();
    expect(updateMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
  });

  test('runs at startup and every minute, and stops on shutdown', async () => {
    const expirePending = jest.fn().mockResolvedValue(0);
    const worker = new ChangeRequestExpiryWorker({ expirePending } as never);
    worker.onModuleInit();
    worker.onModuleInit();
    await Promise.resolve();
    expect(expirePending).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(expirePending).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(expirePending).toHaveBeenCalledTimes(2);
  });

  test('does not overlap slow ticks and retries after database failure', async () => {
    let reject!: (error: Error) => void;
    const expirePending = jest.fn()
      .mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValue(0);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const worker = new ChangeRequestExpiryWorker({ expirePending } as never);
    const firstTick = worker.tick();
    await worker.tick();
    expect(expirePending).toHaveBeenCalledTimes(1);
    reject(new Error('temporary database failure'));
    await firstTick;
    expect(errorLog).toHaveBeenCalled();
    await worker.tick();
    expect(expirePending).toHaveBeenCalledTimes(2);
  });
});
