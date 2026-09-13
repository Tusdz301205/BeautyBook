import { BadRequestException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService validation', () => {
  const service = new PlatformSettingsService({} as any);

  test.each([
    ['maxAdvanceBookingDays', 0],
    ['minBookingLeadTimeHours', 169],
    ['maxRescheduleCountPerBooking', 11],
    ['reviewMinLength', 501],
    ['autoHideReviewReportThreshold', 0],
  ])('rejects invalid %s', (key, value) => {
    expect(() => service.validate({ [key]: value })).toThrow(BadRequestException);
  });

  it('normalizes supported legacy aliases', () => {
    expect(service.validate({ allowRescheduling: false })).toEqual({ allowRescheduleRequests: false });
  });
});
