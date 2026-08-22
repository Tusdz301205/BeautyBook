import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffInvitationsService } from './staff-invitations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffService, StaffInvitationsService],
  exports: [StaffService, StaffInvitationsService],
})
export class StaffModule {}
