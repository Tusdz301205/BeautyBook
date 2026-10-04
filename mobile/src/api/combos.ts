import { apiRequest, withQuery } from './client';
import type { ApiCombo } from '../types/api';

export const combosApi = {
  listPublic: (branchId?: string) =>
    apiRequest<ApiCombo[]>(withQuery('/combos/public', { branchId })),
};

