import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { validatePdfContent } from './pdf-content';
import { blankPdf } from './pdf-test-fixtures';

jest.mock('node:worker_threads', () => ({ Worker: jest.fn() }));

describe('bounded PDF parser lifecycle', () => {
  let worker: EventEmitter & { terminate: jest.Mock };
  beforeEach(() => {
    jest.useFakeTimers();
    worker = Object.assign(new EventEmitter(), { terminate: jest.fn().mockResolvedValue(0) });
    (Worker as unknown as jest.Mock).mockReturnValue(worker);
  });
  afterEach(() => jest.useRealTimers());
  it('reports synchronous worker startup failure as unavailable', async () => {
    (Worker as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('synthetic worker startup failure');
    });
    await expect(validatePdfContent(blankPdf())).rejects.toMatchObject({ status: 503 });
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('terminates a stalled parser at its operational deadline', async () => {
    const pending = validatePdfContent(blankPdf());
    const assertion = expect(pending).rejects.toThrow('thời gian cho phép');
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['error', 'exit'])('cleans up a worker %s without claiming corrupt input', async event => {
    const pending = validatePdfContent(blankPdf());
    const assertion = expect(pending).rejects.toMatchObject({ status: 503 });
    worker.emit(event, event === 'error' ? new Error('synthetic parser failure') : 1);
    await assertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
