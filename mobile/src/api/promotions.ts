import { apiRequest } from './client';
import type { ApiPromotion } from '../types/api';

export const promotionsApi = {
  byBranch: (branchId: string) => apiRequest<ApiPromotion[]>(`/promotions/branch/${encodeURIComponent(branchId)}`),
};
