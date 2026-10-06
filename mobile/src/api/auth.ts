import { apiRequest } from './client';
import type { ApiAuthResponse } from '../types/api';

export const authApi = {
  login: (email: string, password: string, context: { workspace?: 'CUSTOMER' | 'SALON' | 'PLATFORM'; businessId?: string; branchId?: string } = {}) =>
    apiRequest<ApiAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, workspace: 'CUSTOMER', ...context, refreshTokenTransport: 'BODY' }),
    }, false),
  register: (fullName: string, email: string, password: string) =>
    apiRequest<ApiAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, accountType: 'CUSTOMER', refreshTokenTransport: 'BODY' }),
    }, false),
  restore: (refreshToken?: string) =>
    apiRequest<ApiAuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, refreshTokenTransport: 'BODY' }),
    }, false),
  forgotPassword: (email: string) =>
    apiRequest<{ ok: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, client: 'MOBILE' }),
    }, false),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<{ ok: boolean; requiresLogin?: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }, false),
  verifyEmail: (token: string) =>
    apiRequest<{ ok: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }, false),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ ok: boolean; requiresLogin?: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }, false),
};
