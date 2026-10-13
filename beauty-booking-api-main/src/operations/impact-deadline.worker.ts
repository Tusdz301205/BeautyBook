import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { IMPACT_DEADLINE_TITLE, impactDeadlineBody } from '../common/utils/impact-notification-labels';

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
      return await withSerializableTransaction(this.prisma, async (tx) => {
        const cases = await tx.operationalImpactCase.findMany({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'] },
            deadlineAt: { lte: new Date() },
          },
          orderBy: { deadlineAt: 'asc' },
          take: Math.min(200, Math.max(1, limit)),
        });
        if (!cases.length) return { queued: 0 };
        const data: Prisma.NotificationOutboxCreateManyInput[] = [];
        for (const impact of cases) {
          // Case ownerId records the actor at opening; ownership transfers do
          // not rewrite it. Resolve the current business owner's account instead.
          const business = await tx.business.findUnique({
            where: { id: impact.businessId },
            select: { deletedAt: true, owner: { select: { userId: true } } },
          });
          if (!business) continue;
          const userId = business.owner.userId;
          const grant = await tx.userRole.findFirst({
            where: {
              userId,
              role: { code: 'BUSINESS_OWNER' },
              user: { isActive: true, deletedAt: null },
              AND: [
                { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                // Match impact access in multi-tenancy.ts, including verified
                // actual ownership for an unscoped onboarding owner grant.
                { OR: [
                  { businessId: impact.businessId },
                  ...(!business.deletedAt ? [{ businessId: null, branchId: null }] : []),
                ] },
              ],
            },
            select: { userId: true },
          });
          if (!grant) continue;
          const legacyKey = `impact-overdue:${impact.id}:${impact.deadlineAt.toISOString()}`;
          // Preserve existing warnings without letting a former recipient's
          // legacy key suppress a warning for the new rightful owner.
          const legacyWarning = await tx.notificationOutbox.findFirst({
            where: { userId, dedupeKey: legacyKey },
            select: { id: true },
          });
          if (legacyWarning) continue;
          data.push({
            userId,
            type: 'SYSTEM' as const,
            severity: 'CRITICAL' as const,
            title: IMPACT_DEADLINE_TITLE,
            body: impactDeadlineBody(impact.subjectType, impact.action, impact.reason),
            targetType: 'OPERATIONAL_IMPACT',
            targetId: impact.id,
            actionUrl: `/salon/operations?impactCase=${encodeURIComponent(impact.id)}`,
            metadata: { deadlineAt: impact.deadlineAt.toISOString(), status: impact.status },
            dedupeKey: `${legacyKey}:${userId}`,
          });
        }
        if (!data.length) return { queued: 0 };
        const result = await tx.notificationOutbox.createMany({
          data,
          skipDuplicates: true,
        });
        return { queued: result.count };
      }, { conflictMessage: 'Impact deadline recipient changed concurrently' });
    } catch (error) {
      this.logger.error('Không thể tạo cảnh báo impact case quá hạn', error instanceof Error ? error.stack : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }
}
