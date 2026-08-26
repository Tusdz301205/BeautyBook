import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TrustSnapshotService } from './trust-snapshot.service';
import { PaymentsModule } from '../payments/payments.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [PaymentsModule, BranchesModule],
  controllers: [AdminController],
  providers: [TrustSnapshotService],
  exports: [TrustSnapshotService],
})
export class AdminModule {}
