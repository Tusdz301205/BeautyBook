import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';

@Injectable()
export class ChangeRequestExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChangeRequestExpiryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly requests: ChangeRequestsService) {}

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
      // Conditional updateMany is also safe when multiple API instances tick.
      const count = await this.requests.expirePending();
      if (count > 0) this.logger.log(`Expired ${count} appointment change request(s)`);
    } catch (error) {
      this.logger.error(`Change-request expiration failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
