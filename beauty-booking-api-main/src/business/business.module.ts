import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { SalonMembersService } from './salon-members.service';
import { CancellationPoliciesService } from './cancellation-policies.service';
import { BusinessOnboardingService } from './business-onboarding.service';

@Module({
  controllers: [BusinessController],
  providers: [SalonMembersService, CancellationPoliciesService, BusinessOnboardingService],
  exports: [SalonMembersService, CancellationPoliciesService, BusinessOnboardingService],
})
export class BusinessModule {}
