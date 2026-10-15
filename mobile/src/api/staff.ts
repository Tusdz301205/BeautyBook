import { apiRequest, withQuery } from './client';
import type { ApiStaff, ApiStaffDetail } from '../types/api';

export const staffApi = {
  detail: (id: string) => apiRequest<ApiStaffDetail>(`/staff/public/${encodeURIComponent(id)}`),
  publicByServices: (branchId: string, serviceIds: string[] = []) =>
    apiRequest<ApiStaff[]>(withQuery('/staff/public', {
      branchId,
      serviceIds: serviceIds.join(','),
    })),
};
