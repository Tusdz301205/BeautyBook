import { apiRequest } from './client';

export interface SavedService {
  id: string;
  branchServiceOfferingId: string;
  available: boolean;
  offering: {
    id: string;
    name: string;
    price: number | string;
    branchId: string;
    branch: { id: string; name: string; addressLine?: string | null };
  } | null;
}

export const savedServicesApi = {
  list: () => apiRequest<SavedService[]>('/customer/saved-services'),
  save: (serviceId: string) => apiRequest<unknown>(`/customer/saved-services/${encodeURIComponent(serviceId)}`, { method: 'POST' }),
  remove: (serviceId: string) => apiRequest<unknown>(`/customer/saved-services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' }),
};
