import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Injectable()
export class PendingBookingsCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingBookingsCron.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly bookingsService: BookingsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    try {
      const count = await this.bookingsService.expirePendingHolds();
      if (count > 0) this.logger.log(`Expired ${count} pending booking hold(s)`);
    } catch (error) {
      this.logger.error(`Pending booking expiration failed: ${String(error)}`);
    }
  }
}
