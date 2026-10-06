import type { PrismaService } from '../prisma/prisma.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';

describe('NotificationOutboxWorker', () => {
  it('claims and projects one outbox row exactly once', async () => {
    const row = {
      id: 'outbox-1', userId: 'user-1', type: 'SYSTEM', severity: 'INFO',
      title: 'Booking changed', body: 'Updated', targetType: 'BOOKING', targetId: 'booking-1',
      actionUrl: '/customer/appointments/booking-1', metadata: {}, relatedBookingId: 'booking-1',
      status: 'PENDING', attempts: 0, availableAt: new Date(0), createdAt: new Date(0),
    };
    const tx = {
      notificationOutbox: {
        findUnique: jest.fn().mockResolvedValue({ ...row, status: 'PROCESSING', attempts: 1 }),
        update: jest.fn<Promise<unknown>, [Record<string, unknown>]>().mockResolvedValue({}),
      },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const prisma = {
      notificationOutbox: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([row]),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
    } as unknown as PrismaService;
    const worker = new NotificationOutboxWorker(prisma);

    await expect(worker.drain()).resolves.toEqual({ processed: 1 });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notificationOutbox.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'outbox-1', status: 'PROCESSING', attempts: 1 },
      data: { status: 'SENT', notificationId: 'notification-1' },
    });
  });

  it('does not project a row another worker already claimed', async () => {
    const prisma = {
      notificationOutbox: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'outbox-1', attempts: 0 }]),
      },
    } as unknown as PrismaService;
    const worker = new NotificationOutboxWorker(prisma);

    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
  });

  it('retains delivery intent on failure and projects one notification on a later retry', async () => {
    const row = {
      id: 'retry-outbox', userId: 'owner', type: 'BOOKING_CONFIRMED', severity: 'INFO',
      title: 'Lịch hẹn mới cần xác nhận', body: 'Có lịch hẹn mới BB-QA',
      targetType: 'BOOKING', targetId: 'booking', relatedBookingId: 'booking',
      actionUrl: '/salon/appointments?bookingId=booking', metadata: {},
      attempts: 0, status: 'PENDING', availableAt: new Date(0), createdAt: new Date(0),
    };
    let delivered = false;
    const notificationCreate = jest.fn((input: { data: Partial<typeof row> }) => { expect(input.data.targetId).toBe('booking'); delivered = true; return Promise.resolve({ id: 'notification' }); })
      .mockRejectedValueOnce(new Error('Temporary delivery failure'));
    const tx = {
      notificationOutbox: {
        findUnique: jest.fn(() => Promise.resolve({ ...row })),
        update: jest.fn(({ data }: { data: Partial<typeof row> }) => { Object.assign(row, data); return Promise.resolve(); }),
      },
      notification: { create: notificationCreate },
    };
    const updateMany = jest.fn(({ where, data }: { where: { id?: string }; data: Partial<typeof row> }) => {
      if (where.id !== row.id) return Promise.resolve({ count: 0 });
      if (data.status === 'PROCESSING') { row.status = 'PROCESSING'; row.attempts++; }
      else Object.assign(row, data);
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      notificationOutbox: { count: jest.fn().mockResolvedValue(0), updateMany,
        findMany: jest.fn(() => Promise.resolve(row.status === 'SENT' ? [] : [{ ...row }])) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const worker = new NotificationOutboxWorker(prisma);
    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);
    expect(delivered).toBe(false);
    expect(row.targetId).toBe('booking');
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    row.availableAt = new Date(0);
    await expect(worker.drain()).resolves.toEqual({ processed: 1 });
    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
    expect(row.status).toBe('SENT');
    expect(row.attempts).toBe(2);
    expect(notificationCreate).toHaveBeenCalledTimes(2);
    const projected = notificationCreate.mock.calls[1][0].data;
    expect(projected.userId).toBe('owner');
    expect(projected.title).toBe('Lịch hẹn mới cần xác nhận');
    expect(projected.targetId).toBe('booking');
    expect(projected.actionUrl).toBe('/salon/appointments?bookingId=booking');
  });
});
