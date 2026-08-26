import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImpactDeadlineWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImpactDeadlineWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.enqueueOverdueWarnings().catch(() => undefined);
    this.timer = setInterval(() => void this.enqueueOverdueWarnings().catch(() => undefined), 5 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueueOverdueWarnings(limit = 100) {
    if (this.running) return { queued: 0 };
    this.running = true;
    try {
      const cases = await this.prisma.operationalImpactCase.findMany({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'] },
          deadlineAt: { lte: new Date() },
        },
        orderBy: { deadlineAt: 'asc' },
        take: Math.min(200, Math.max(1, limit)),
      });
      if (!cases.length) return { queued: 0 };
      const result = await this.prisma.notificationOutbox.createMany({
        data: cases.map((impact) => ({
          userId: impact.ownerId,
          type: 'SYSTEM' as const,
          severity: 'CRITICAL' as const,
          title: 'Hồ sơ lịch bị ảnh hưởng đã quá hạn',
          body: `${impact.subjectType} · ${impact.action}: ${impact.reason}`,
          targetType: 'OPERATIONAL_IMPACT',
          targetId: impact.id,
          actionUrl: `/salon/operations?impactCase=${encodeURIComponent(impact.id)}`,
          metadata: { deadlineAt: impact.deadlineAt.toISOString(), status: impact.status },
          dedupeKey: `impact-overdue:${impact.id}:${impact.deadlineAt.toISOString()}`,
        })),
        skipDuplicates: true,
      });
      return { queued: result.count };
    } catch (error) {
      this.logger.error('Không thể tạo cảnh báo impact case quá hạn', error instanceof Error ? error.stack : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }
}
