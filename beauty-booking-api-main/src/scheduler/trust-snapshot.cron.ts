import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrustSnapshotService } from '../admin/trust-snapshot.service';

/**
 * Tính trust snapshots cho tất cả salon hoạt động 1 lần/ngày lúc 02:00 (server time).
 * Admin dashboard sẽ đọc từ cache này.
 */
@Injectable()
export class TrustSnapshotCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrustSnapshotCron.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trustSnapshotService: TrustSnapshotService,
  ) {}

  onModuleInit() {
    // Mỗi 60 phút kiểm tra xem có phải 02:00 không
    this.timer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() < 5) {
        this.tick();
      }
    }, 5 * 60 * 1000); // 5 phút
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    this.logger.log('Rebuild trust snapshots...');
    const businesses = await this.prisma.business.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const b of businesses) {
      try {
        await this.trustSnapshotService.upsertSnapshot(b.id);
      } catch (err) {
        this.logger.error(`Snapshot failed for ${b.id}: ${err}`);
      }
    }
    this.logger.log(`Updated ${businesses.length} snapshots.`);
  }
}
