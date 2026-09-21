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
    ['freeCancellationHours', 2],
    ['freeCancellationHours', 24],
  ])('rejects invalid %s', (key, value) => {
    expect(() => service.validate({ [key]: value })).toThrow(BadRequestException);
  });

  it('normalizes supported legacy aliases', () => {
    expect(service.validate({ allowRescheduling: false })).toEqual({ allowRescheduleRequests: false });
  });

  it('does not allow the legacy alias to weaken the cancellation cutoff', () => {
    expect(() => service.validate({ maxCancellationHours: 0 })).toThrow(BadRequestException);
    expect(service.validate({ freeCancellationHours: 4 })).toEqual({ freeCancellationHours: 4 });
  });

  it('returns 4 hours even when the stored configuration predates the rule', async () => {
    const configured = new PlatformSettingsService({
      platformSetting: { findUnique: jest.fn().mockResolvedValue({ value: { freeCancellationHours: 2 } }) },
    } as any);
    expect((await configured.getEffective()).freeCancellationHours).toBe(4);
    expect((await configured.getView()).effective.freeCancellationHours).toBe(4);
    expect((await configured.getView()).configured.freeCancellationHours).toBe(2);
  });
});
