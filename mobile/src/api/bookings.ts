import { apiRequest, withQuery } from './client';
import type { ApiAvailableSlotsResponse, ApiBooking, ApiPricePreview } from '../types/api';

export interface CreateBookingInput {
  branchId: string;
  serviceIds?: string[];
  comboId?: string;
  variantSelections?: Record<string, string>;
  appointmentDate: string;
  staffId?: string;
  note?: string;
  voucherCode?: string;
  violationAcknowledged?: boolean;
}

export interface SelfBookingPolicy {
  selfBookingAllowed: boolean;
  acknowledgmentRequired: boolean;
  score: number;
  businessName: string;
}

export const bookingsApi = {
  selfBookingPolicy: (branchId: string) => apiRequest<SelfBookingPolicy>(withQuery('/bookings/self-booking-policy', { branchId })),
  availableSlots: (input: { branchId: string; serviceIds: string[]; date: string; staffId?: string; variantSelections?: Record<string, string> }) =>
    apiRequest<ApiAvailableSlotsResponse>(withQuery('/bookings/available-slots', {
      branchId: input.branchId,
      serviceIds: input.serviceIds.join(','),
      date: input.date,
      staffId: input.staffId,
      variantSelections: input.variantSelections && Object.keys(input.variantSelections).length
        ? JSON.stringify(input.variantSelections)
        : undefined,
    })),
  previewPrice: (input: {
    branchId: string;
    serviceIds: string[];
    comboId?: string;
    appointmentDate: string;
    variantSelections?: Record<string, string>;
    voucherCode?: string;
  }) => apiRequest<ApiPricePreview>('/bookings/preview-price', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  create: (input: CreateBookingInput, idempotencyKey: string) =>
    apiRequest<ApiBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...input, source: 'ONLINE_APP' }),
    }),
  mine: async () => {
    const tabs = await Promise.all(['upcoming', 'completed', 'cancelled'].map((tab) =>
      apiRequest<{ data: ApiBooking[] }>(withQuery('/bookings/my-appointments', { tab })),
    ));
    return tabs.flatMap((response) => response.data);
  },
  cancel: (id: string, reason?: string) =>
    apiRequest<ApiBooking>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'CANCELLED',
        note: reason?.trim() || 'Khách hủy lịch trên ứng dụng',
      }),
    }),
  requestCancellation: (id: string, reason?: string) =>
    apiRequest(`/bookings/${id}/change-requests`, {
      method: 'POST',
      body: JSON.stringify({
        requestType: 'CANCEL',
        reason: reason?.trim() || 'Khách gửi yêu cầu hủy sát giờ trên ứng dụng',
      }),
    }),
  requestReschedule: (id: string, input: { proposedStartTime: string; proposedEndTime: string; proposedStaffId?: string; reason: string }) =>
    apiRequest(`/bookings/${id}/change-requests`, {
      method: 'POST',
      body: JSON.stringify({ requestType: 'RESCHEDULE', ...input }),
    }),
};
