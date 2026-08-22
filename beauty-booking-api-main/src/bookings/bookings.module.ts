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

@Module({
  imports: [SchedulerModule, PaymentsModule],
  controllers: [BookingsController, HealthRecordsController],
  providers: [
    BookingsService,
    BookingsAccessService,
    HealthRecordsService,
    ChangeRequestsService,
    VouchersService,
    PendingBookingsCron,
  ],
  exports: [
    BookingsService,
    BookingsAccessService,
    HealthRecordsService,
    ChangeRequestsService,
    VouchersService,
  ],
})
export class BookingsModule {}
