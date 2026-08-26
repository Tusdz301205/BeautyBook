import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OwnershipService } from './ownership.service';

@Injectable()
export class OwnershipExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OwnershipExecutionWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly ownership: OwnershipService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.ownership.executeDueTransfers().catch((error: unknown) => {
        this.logger.error('Không thể thực thi chuyển quyền sở hữu đến hạn', error instanceof Error ? error.stack : String(error));
      });
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
