import { apiRequest } from './client';

export interface PublicPlatformPolicy {
  maxAdvanceBookingDays: number;
  minBookingLeadTimeHours: number;
  freeCancellationHours: number;
  allowRescheduleRequests: boolean;
  maxRescheduleCountPerBooking: number;
  reviewMinLength: number;
  allowAnonymousReview: boolean;
}

export const platformSettingsApi = {
  publicPolicy: () => apiRequest<PublicPlatformPolicy>('/platform-settings/public'),
};
