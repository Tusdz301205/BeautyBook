import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TrustSnapshotService } from './trust-snapshot.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [AdminController],
  providers: [TrustSnapshotService],
  exports: [TrustSnapshotService],
})
export class AdminModule {}
