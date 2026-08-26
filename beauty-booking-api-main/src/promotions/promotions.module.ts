import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { VouchersController } from './vouchers.controller';
import { VouchersAdminService } from './vouchers-admin.service';
import { PricingEngineService } from './pricing-engine.service';

@Module({
  controllers: [PromotionsController, VouchersController],
  providers: [PromotionsService, VouchersAdminService, PricingEngineService],
  exports: [PromotionsService, VouchersAdminService, PricingEngineService],
})
export class PromotionsModule {}
