import { apiRequest } from './client';

export interface ApiUserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth?: string | null;
  avatarMedia?: { id: string; url: string; originalName?: string | null } | null;
  isEmailVerified?: boolean;
}

export interface UpdateUserProfileInput {
  fullName?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  address?: string;
}

export const usersApi = {
  profile: () => apiRequest<ApiUserProfile>('/users/me/profile'),
  updateProfile: (input: UpdateUserProfileInput) =>
    apiRequest<ApiUserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};
