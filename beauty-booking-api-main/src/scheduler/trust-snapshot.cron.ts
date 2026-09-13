import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrustSnapshotService } from '../admin/trust-snapshot.service';

/**
 * Refresh each active business after 02:00 (server time). Persisted computedAt
 * drives catch-up after restarts and retries only snapshots that are still old.
 */
@Injectable()
export class TrustSnapshotCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrustSnapshotCron.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trustSnapshotService: TrustSnapshotService,
  ) {}

  onModuleInit() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 5 * 60 * 1000);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick() {
    if (this.running) return;
    const now = new Date();
    const scheduledAt = new Date(now);
    scheduledAt.setHours(2, 0, 0, 0);
    if (now < scheduledAt) return;

    this.running = true;
    try {
      const businesses = await this.prisma.business.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          OR: [
            { trustSnapshot: { is: null } },
            { trustSnapshot: { is: { computedAt: { lt: scheduledAt } } } },
          ],
        },
        select: { id: true },
      });
      let updated = 0;
      for (const business of businesses) {
        try {
          await this.trustSnapshotService.upsertSnapshot(business.id);
          updated += 1;
        } catch (error) {
          this.logger.error(`Snapshot failed for ${business.id}: ${String(error)}`);
        }
      }
      if (businesses.length > 0) this.logger.log(`Updated ${updated}/${businesses.length} due trust snapshots.`);
    } catch (error) {
      this.logger.error(`Trust snapshot scan failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
