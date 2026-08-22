import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({ imports: [BookingsModule], controllers: [RecurringController], providers: [RecurringService] })
export class RecurringModule {}
