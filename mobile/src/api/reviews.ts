import { apiRequest, withQuery } from './client';
import type { ApiCreateReviewInput, ApiReview, ApiReviewResponse } from '../types/api';

export const reviewsApi = {
  byBusiness: (businessId: string, page = 1, limit = 50) =>
    apiRequest<ApiReviewResponse>(withQuery(`/reviews/business/${businessId}`, { page, limit })),
  create: (input: ApiCreateReviewInput) =>
    apiRequest<ApiReview>('/reviews', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
