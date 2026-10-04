import { apiRequest, withQuery } from './client';
import type { ApiStaff } from '../types/api';

export const staffApi = {
  publicByServices: (branchId: string, serviceIds: string[] = []) =>
    apiRequest<ApiStaff[]>(withQuery('/staff/public', {
      branchId,
      serviceIds: serviceIds.join(','),
    })),
};
