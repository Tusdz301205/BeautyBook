import { apiRequest, withQuery } from './client';
import type { ApiBranchDetail, ApiBranchSummary } from '../types/api';

export interface BranchFilters {
  search?: string;
  categoryId?: string;
  districtId?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export const branchesApi = {
  list: (filters: BranchFilters = {}) =>
    apiRequest<ApiBranchSummary[]>(withQuery('/branches', filters)),
  detail: (id: string) => apiRequest<ApiBranchDetail | null>(`/branches/${id}`),
  districts: () => apiRequest<Array<{ id: string; name: string; province: { id: string; name: string } }>>('/branches/locations/districts'),
};

