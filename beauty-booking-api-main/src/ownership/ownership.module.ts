import { Module } from '@nestjs/common';
import { PrivacyModule } from '../privacy/privacy.module';
import { OwnershipController } from './ownership.controller';
import { OwnershipService } from './ownership.service';
import { OwnershipExecutionWorker } from './ownership-execution.worker';

@Module({
  imports: [PrivacyModule],
  controllers: [OwnershipController],
  providers: [OwnershipService, OwnershipExecutionWorker],
  exports: [OwnershipService],
})
export class OwnershipModule {}
