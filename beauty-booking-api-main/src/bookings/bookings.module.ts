import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsAccessService } from './bookings-access.service';
import { ChangeRequestsService } from './change-requests.service';
import { VouchersService } from './vouchers.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { PaymentsModule } from '../payments/payments.module';
import { PendingBookingsCron } from './pending-bookings.cron';
import { PromotionsModule } from '../promotions/promotions.module';
import { BookingItemsService } from './booking-items.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ChangeRequestExpiryWorker } from './change-request-expiry.worker';

@Module({
  imports: [SchedulerModule, PaymentsModule, PromotionsModule, LoyaltyModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingsAccessService,
    ChangeRequestsService,
    VouchersService,
    PendingBookingsCron,
    ChangeRequestExpiryWorker,
    BookingItemsService,
  ],
  exports: [
    BookingsService,
    BookingsAccessService,
    ChangeRequestsService,
    VouchersService,
    BookingItemsService,
  ],
})
export class BookingsModule {}
