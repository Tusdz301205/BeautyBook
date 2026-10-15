import { apiRequest, withQuery } from './client';
import type { ApiCreateReviewInput, ApiPublicRatings, ApiReview, ApiReviewResponse } from '../types/api';

export const reviewsApi = {
  byService: (id: string) => apiRequest<ApiPublicRatings>(`/reviews/service/${encodeURIComponent(id)}`),
  byStaff: (id: string) => apiRequest<ApiPublicRatings>(`/reviews/public/staff/${encodeURIComponent(id)}`),
  byBusiness: (businessId: string, page = 1, limit = 50) =>
    apiRequest<ApiReviewResponse>(withQuery(`/reviews/business/${businessId}`, { page, limit })),
  create: (input: ApiCreateReviewInput) =>
    apiRequest<ApiReview>('/reviews', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
