import type { ApiCreateReviewInput } from '../types/api';

export interface ReviewServiceLine {
  id: string;
  serviceName: string;
  staffId?: string;
  staffName?: string;
  status?: string;
}

export type ServiceReviewDrafts = Record<string, { rating: number; comment: string }>;

// Check-in history can still have SCHEDULED lines: only explicit non-delivery
// statuses are excluded, rather than requiring legacy service completion.
export function reviewableServices(items: readonly ReviewServiceLine[]): ReviewServiceLine[] {
  return items.filter(item => item.status !== 'SKIPPED' && item.status !== 'CANCELLED');
}

export function createServiceReviewDrafts(items: readonly ReviewServiceLine[]): ServiceReviewDrafts {
  return Object.fromEntries(reviewableServices(items).map(item => [item.id, { rating: 0, comment: '' }]));
}

const validRating = (rating: number) => Number.isInteger(rating) && rating >= 1 && rating <= 5;

/** Validate every selected score and bind each draft to the current booked line. */
export function buildReviewInput(
  bookingId: string,
  overallRating: number,
  comment: string,
  items: readonly ReviewServiceLine[],
  drafts: ServiceReviewDrafts = {},
  minLength = 0,
): ApiCreateReviewInput | null {
  if (!validRating(overallRating) || comment.trim().length < minLength) return null;
  const lines = reviewableServices(items);
  if (lines.some(item => !validRating(drafts[item.id]?.rating))) return null;
  return {
    bookingId,
    overallRating,
    comment: comment.trim() || undefined,
    serviceRatings: lines.map(item => ({
      bookingServiceId: item.id,
      ...(item.staffId ? { staffId: item.staffId } : {}),
      rating: drafts[item.id].rating,
      comment: drafts[item.id].comment.trim() || undefined,
    })),
  };
}
