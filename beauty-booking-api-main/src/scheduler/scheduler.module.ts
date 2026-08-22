import { Module } from '@nestjs/common';
import { SchedulerGateway } from './scheduler.gateway';
import { TrustSnapshotCron } from './trust-snapshot.cron';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PolicyNotificationCron } from './policy-notification.cron';

@Module({
  imports: [AdminModule, AuthModule],
  providers: [SchedulerGateway, TrustSnapshotCron, PolicyNotificationCron],
  exports: [SchedulerGateway],
})
export class SchedulerModule {}
