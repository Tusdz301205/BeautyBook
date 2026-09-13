import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

export const NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 10;
const DEAD_LETTER_REPORT_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class NotificationOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private draining = false;
  private nextDeadLetterReportAt = 0;

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

  private async reportDeadLetters(now: Date) {
    if (now.getTime() < this.nextDeadLetterReportAt) return;
    // FAILED plus the attempt ceiling is the terminal dead-letter state. Keep
    // this compatible with databases that only have the existing status enum.
    const where = { status: 'FAILED' as const, attempts: { gte: NOTIFICATION_OUTBOX_MAX_ATTEMPTS } };
    const count = await this.prisma.notificationOutbox.count({ where });
    if (count > 0) {
      const sample = await this.prisma.notificationOutbox.findMany({
        where,
        select: { id: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 10,
      });
      // Do not put notification payloads, recipient details, or database error
      // messages in logs. Operators can inspect the retained records securely.
      this.logger.error(`NOTIFICATION_OUTBOX_DEAD_LETTER_BACKLOG count=${count} sampleIds=${sample.map((row) => row.id).join(',')}`);
    }
    this.nextDeadLetterReportAt = now.getTime() + DEAD_LETTER_REPORT_INTERVAL_MS;
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
      // Also surface previously exhausted rows left PENDING by older tooling.
      // Preserve their payload and last error; do not grant another attempt.
      await this.prisma.notificationOutbox.updateMany({
        where: { status: 'PENDING', attempts: { gte: NOTIFICATION_OUTBOX_MAX_ATTEMPTS } },
        data: { status: 'FAILED' },
      });
      await this.reportDeadLetters(now);
      const rows = await this.prisma.notificationOutbox.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          availableAt: { lte: now },
          attempts: { lt: NOTIFICATION_OUTBOX_MAX_ATTEMPTS },
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.min(100, Math.max(1, limit)),
      });
      let processed = 0;
      for (const row of rows) {
        if (row.attempts >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS) continue;
        const attempt = row.attempts + 1;
        const claimed = await this.prisma.notificationOutbox.updateMany({
          where: {
            id: row.id,
            status: { in: ['PENDING', 'FAILED'] },
            availableAt: { lte: new Date() },
            attempts: { equals: row.attempts, lt: NOTIFICATION_OUTBOX_MAX_ATTEMPTS },
          },
          data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
        });
        if (claimed.count !== 1) continue;
        try {
          const delivered = await withSerializableTransaction(this.prisma, async (tx) => {
            const current = await tx.notificationOutbox.findUnique({ where: { id: row.id } });
            // The incremented attempt is a fencing token. A stale worker must
            // not project or complete a row reclaimed by a newer worker.
            if (!current || current.status !== 'PROCESSING' || current.attempts !== attempt) return false;
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
              where: { id: current.id, status: 'PROCESSING', attempts: attempt },
              data: { status: 'SENT', sentAt: new Date(), notificationId: notification.id, lastError: null },
            });
            return true;
          }, { conflictMessage: 'Notification outbox changed concurrently' });
          if (delivered) processed += 1;
        } catch (error) {
          const exhausted = attempt >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS;
          const retryDelay = Math.min(30 * 60_000, 2 ** attempt * 1_000);
          const failed = await this.prisma.notificationOutbox.updateMany({
            where: { id: row.id, status: 'PROCESSING', attempts: attempt },
            data: {
              status: 'FAILED',
              availableAt: new Date(Date.now() + (exhausted ? 0 : retryDelay)),
              lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            },
          });
          if (failed.count !== 1) {
            this.logger.warn(`NOTIFICATION_OUTBOX_CLAIM_LOST id=${row.id} attempt=${attempt}`);
          } else if (exhausted) {
            this.logger.error(`NOTIFICATION_OUTBOX_DEAD_LETTER id=${row.id} attempts=${attempt}`);
          } else {
            this.logger.warn(`NOTIFICATION_OUTBOX_RETRY id=${row.id} attempt=${attempt} retryDelayMs=${retryDelay}`);
          }
        }
      }
      return { processed };
    } finally {
      this.draining = false;
    }
  }
}
