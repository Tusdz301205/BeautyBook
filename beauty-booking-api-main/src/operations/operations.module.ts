import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { ImpactController } from './impact.controller';
import { ImpactService } from './impact.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistExpiryWorker } from './waitlist-expiry.worker';
import { ImpactDeadlineWorker } from './impact-deadline.worker';

@Module({
  imports: [BookingsModule, PaymentsModule],
  controllers: [ImpactController, WaitlistController],
  providers: [ImpactService, WaitlistService, WaitlistExpiryWorker, ImpactDeadlineWorker],
  exports: [ImpactService, WaitlistService],
})
export class OperationsModule {}
