import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringPlanRecoveryWorker } from './recurring-plan-recovery.worker';

@Module({ imports: [BookingsModule], controllers: [RecurringController], providers: [RecurringService, RecurringPlanRecoveryWorker] })
export class RecurringModule {}
