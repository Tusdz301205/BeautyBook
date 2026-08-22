import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('public')
  @Public()
  async publicPolicy() {
    const value = await this.settings.getEffective();
    return {
      maxAdvanceBookingDays: value.maxAdvanceBookingDays,
      minBookingLeadTimeHours: value.minBookingLeadTimeHours,
      freeCancellationHours: value.freeCancellationHours,
      allowRescheduleRequests: value.allowRescheduleRequests,
      maxRescheduleCountPerBooking: value.maxRescheduleCountPerBooking,
      reviewMinLength: value.reviewMinLength,
      allowAnonymousReview: value.allowAnonymousReview,
    };
  }
}
