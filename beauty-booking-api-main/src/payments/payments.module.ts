import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FinancialMetricsService } from './financial-metrics.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [LoyaltyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FinancialMetricsService, PaymentProviderRegistry],
  exports: [PaymentsService, FinancialMetricsService],
})
export class PaymentsModule {}
