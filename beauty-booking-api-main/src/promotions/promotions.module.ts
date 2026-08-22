import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { VouchersController } from './vouchers.controller';
import { VouchersAdminService } from './vouchers-admin.service';

@Module({
  controllers: [PromotionsController, VouchersController],
  providers: [PromotionsService, VouchersAdminService],
  exports: [PromotionsService, VouchersAdminService],
})
export class PromotionsModule {}
