import { apiRequest, withQuery } from './client';
import type { ApiCategory, ApiSearchResponse, ApiService } from '../types/api';

export interface ServiceSearchFilters {
  query?: string;
  location?: string;
  canonicalServiceId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  date?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const servicesApi = {
  list: (branchId?: string) => apiRequest<ApiService[]>(withQuery('/services', { branchId, limit: 100 })),
  detail: (id: string) => apiRequest<ApiService | null>(`/services/${id}`),
  categories: () => apiRequest<ApiCategory[]>('/services/categories'),
  search: (filters: ServiceSearchFilters = {}) =>
    apiRequest<ApiSearchResponse>(withQuery('/services/search', filters)),
};

