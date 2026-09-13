import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';

export const RECURRING_CREATION_TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class RecurringPlanRecoveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurringPlanRecoveryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const cutoff = new Date(Date.now() - RECURRING_CREATION_TIMEOUT_MS);
      const stale = await this.prisma.recurringBookingPlan.findMany({
        where: { status: 'CREATING', deletedAt: null, updatedAt: { lte: cutoff } },
        select: { id: true }, orderBy: { updatedAt: 'asc' }, take: 100,
      });
      for (const plan of stale) {
        try {
          const recovered = await withSerializableTransaction(this.prisma, async (tx) => {
            // Same row lock as occurrence creation. A fresh heartbeat, activation
            // or another worker winning the race makes this a harmless no-op.
            const claim = await tx.recurringBookingPlan.updateMany({
              where: { id: plan.id, status: 'CREATING', deletedAt: null, updatedAt: { lte: cutoff } },
              data: { status: 'FAILED' },
            });
            if (claim.count !== 1) return false;
            const current = await tx.recurringBookingPlan.findUniqueOrThrow({
              where: { id: plan.id }, select: { occurrenceCount: true, customer: { select: { userId: true } } },
            });
            const count = await tx.booking.count({ where: { recurringPlanId: plan.id, deletedAt: null } });
            const reason = `Quá trình tạo chuỗi bị gián đoạn. Đã tạo ${count}/${current.occurrenceCount} kỳ. Các kỳ đã tạo được giữ nguyên trạng thái; hãy kiểm tra từng lịch trước khi đặt thêm.`;
            await tx.recurringBookingPlan.update({
              where: { id: plan.id }, data: { createdOccurrenceCount: count, failureReason: reason },
            });
            // Durable notification and recovery commit together. No mail/HTTP
            // side effects here; the existing notification worker delivers it.
            await tx.notificationOutbox.createMany({
              data: [{
                userId: current.customer.userId, type: 'SYSTEM', severity: 'WARNING',
                title: 'Chuỗi lịch chưa được tạo hoàn tất', body: reason,
                targetType: 'RECURRING_PLAN', targetId: plan.id,
                actionUrl: '/customer/appointments', dedupeKey: `recurring-recovery:${plan.id}`,
              }], skipDuplicates: true,
            });
            return true;
          });
          if (recovered) this.logger.warn(`RECURRING_PLAN_RECOVERED id=${plan.id}`);
        } catch {
          // Continue the batch and retry next tick. Never log customer data.
          this.logger.error(`RECURRING_PLAN_RECOVERY_FAILED id=${plan.id}`);
        }
      }
    } catch {
      this.logger.error('RECURRING_PLAN_RECOVERY_SCAN_FAILED');
    } finally {
      this.running = false;
    }
  }
}
