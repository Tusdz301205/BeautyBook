import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { ImpactController } from './impact.controller';
import { ImpactService } from './impact.service';
import { ImpactDeadlineWorker } from './impact-deadline.worker';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [BookingsModule, PaymentsModule, SchedulerModule],
  controllers: [ImpactController],
  providers: [ImpactService, ImpactDeadlineWorker],
  exports: [ImpactService],
})
export class OperationsModule {}
