import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { ImpactController } from './impact.controller';
import { ImpactService } from './impact.service';
import { ImpactDeadlineWorker } from './impact-deadline.worker';

@Module({
  imports: [BookingsModule, PaymentsModule],
  controllers: [ImpactController],
  providers: [ImpactService, ImpactDeadlineWorker],
  exports: [ImpactService],
})
export class OperationsModule {}
