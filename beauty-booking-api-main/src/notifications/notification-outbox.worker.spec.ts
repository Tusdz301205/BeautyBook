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
        findUnique: jest.fn().mockResolvedValue({ ...row, status: 'PROCESSING' }),
        update: jest.fn().mockResolvedValue({}),
      },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const prisma = {
      notificationOutbox: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([row]),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const worker = new NotificationOutboxWorker(prisma);

    await expect(worker.drain()).resolves.toEqual({ processed: 1 });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notificationOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({ status: 'SENT', notificationId: 'notification-1' }),
    }));
  });

  it('does not project a row another worker already claimed', async () => {
    const prisma = {
      notificationOutbox: {
        updateMany: jest.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'outbox-1', attempts: 0 }]),
      },
    } as unknown as PrismaService;
    const worker = new NotificationOutboxWorker(prisma);

    await expect(worker.drain()).resolves.toEqual({ processed: 0 });
  });
});
