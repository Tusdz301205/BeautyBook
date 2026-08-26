import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { HealthRecordsController } from './health-records.controller';
import { BookingsService } from './bookings.service';
import { BookingsAccessService } from './bookings-access.service';
import { HealthRecordsService } from './health-records.service';
import { ChangeRequestsService } from './change-requests.service';
import { VouchersService } from './vouchers.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { PaymentsModule } from '../payments/payments.module';
import { PendingBookingsCron } from './pending-bookings.cron';
import { PromotionsModule } from '../promotions/promotions.module';
import { BookingItemsService } from './booking-items.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [SchedulerModule, PaymentsModule, PromotionsModule, LoyaltyModule],
  controllers: [BookingsController, HealthRecordsController],
  providers: [
    BookingsService,
    BookingsAccessService,
    HealthRecordsService,
    ChangeRequestsService,
    VouchersService,
    PendingBookingsCron,
    BookingItemsService,
  ],
  exports: [
    BookingsService,
    BookingsAccessService,
    HealthRecordsService,
    ChangeRequestsService,
    VouchersService,
    BookingItemsService,
  ],
})
export class BookingsModule {}
