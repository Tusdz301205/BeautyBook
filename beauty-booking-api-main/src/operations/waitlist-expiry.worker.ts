import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Injectable()
export class WaitlistExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WaitlistExpiryWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly waitlist: WaitlistService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.waitlist.expireOffers().catch((error: unknown) => {
        this.logger.error('Không thể chuyển offer waitlist hết hạn', error instanceof Error ? error.stack : String(error));
      });
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
