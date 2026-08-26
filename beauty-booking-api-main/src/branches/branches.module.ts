import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchStateService } from './branch-state.service';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, BranchStateService],
  exports: [BranchesService, BranchStateService],
})
export class BranchesModule {}
