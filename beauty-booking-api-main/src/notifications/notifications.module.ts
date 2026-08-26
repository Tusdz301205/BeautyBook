import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
