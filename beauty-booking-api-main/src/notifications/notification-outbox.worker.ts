import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

@Injectable()
export class NotificationOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.drain().catch((error: unknown) => {
      this.logger.error('Notification outbox drain failed', error instanceof Error ? error.stack : String(error));
    });
    this.timer = setInterval(() => void this.drain().catch((error: unknown) => {
      this.logger.error('Notification outbox drain failed', error instanceof Error ? error.stack : String(error));
    }), 15_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(limit = 50) {
    if (this.draining) return { processed: 0 };
    this.draining = true;
    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - 5 * 60_000);
      await this.prisma.notificationOutbox.updateMany({
        where: { status: 'PROCESSING', updatedAt: { lte: staleBefore } },
        data: { status: 'FAILED', availableAt: now, lastError: 'Worker interrupted before delivery completed' },
      });
      const rows = await this.prisma.notificationOutbox.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          availableAt: { lte: now },
          attempts: { lt: 10 },
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.min(100, Math.max(1, limit)),
      });
      let processed = 0;
      for (const row of rows) {
        const claimed = await this.prisma.notificationOutbox.updateMany({
          where: { id: row.id, status: { in: ['PENDING', 'FAILED'] }, availableAt: { lte: new Date() } },
          data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
        });
        if (claimed.count !== 1) continue;
        try {
          await withSerializableTransaction(this.prisma, async (tx) => {
            const current = await tx.notificationOutbox.findUnique({ where: { id: row.id } });
            if (!current || current.status !== 'PROCESSING') return;
            const notification = await tx.notification.create({
              data: {
                userId: current.userId,
                type: current.type,
                severity: current.severity,
                title: current.title,
                body: current.body,
                targetType: current.targetType,
                targetId: current.targetId,
                actionUrl: current.actionUrl,
                metadata: current.metadata ?? undefined,
                relatedBookingId: current.relatedBookingId,
              },
            });
            await tx.notificationOutbox.update({
              where: { id: current.id },
              data: { status: 'SENT', sentAt: new Date(), notificationId: notification.id, lastError: null },
            });
          }, { conflictMessage: 'Notification outbox changed concurrently' });
          processed += 1;
        } catch (error) {
          const retryDelay = Math.min(30 * 60_000, 2 ** Math.min(row.attempts + 1, 10) * 1_000);
          await this.prisma.notificationOutbox.updateMany({
            where: { id: row.id, status: 'PROCESSING' },
            data: {
              status: 'FAILED',
              availableAt: new Date(Date.now() + retryDelay),
              lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            },
          });
          this.logger.error(`Notification outbox ${row.id} failed`, error instanceof Error ? error.stack : String(error));
        }
      }
      return { processed };
    } finally {
      this.draining = false;
    }
  }
}
