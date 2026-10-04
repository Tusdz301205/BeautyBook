import { apiRequest } from './client';

export const privacyApi = {
  requestAccountDeletion: (reason?: string) =>
    apiRequest('/privacy/data-requests', {
      method: 'POST',
      body: JSON.stringify({
        type: 'DELETE_ACCOUNT',
        reason: reason?.trim() || undefined,
      }),
    }),
};
