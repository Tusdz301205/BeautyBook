import { apiRequest } from './client';
import type { ApiBooking } from '../types/api';

export type RecurringFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type RecurringStaffMode = 'SAME_STAFF' | 'ANY_AVAILABLE';

export interface RecurringPreviewInput {
  branchId: string;
  serviceIds?: string[];
  comboId?: string;
  staffId?: string;
  staffMode: RecurringStaffMode;
  frequency: RecurringFrequency;
  startDate: string;
  preferredTime: string;
  occurrenceCount: number;
}

export interface CreateRecurringInput extends RecurringPreviewInput {
  skipConflicts: boolean;
  note?: string;
  violationAcknowledged: boolean;
}

export interface RecurringPreview {
  occurrences: Array<{ appointmentDate: string; available: boolean; staffId: string | null; reason?: string }>;
  availableCount: number;
  conflictCount: number;
}

export interface CreatedRecurringPlan {
  id: string;
  createdOccurrenceCount: number;
  bookings: ApiBooking[];
}

export const recurringApi = {
  preview: (input: RecurringPreviewInput) => apiRequest<RecurringPreview>('/recurring/preview', {
    method: 'POST', body: JSON.stringify(input),
  }),
  create: (input: CreateRecurringInput, idempotencyKey: string) => apiRequest<CreatedRecurringPlan>('/recurring', {
    method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input),
  }),
};
