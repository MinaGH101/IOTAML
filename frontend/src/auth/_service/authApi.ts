import type { LoginResponse, UserProfile } from '../../shared/_types';
import { jsonHeaders, request } from '../../shared/_service/httpClient';

export const authApi = {
  login: (payload: { username: string; password: string }) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  me: () => request<UserProfile>('/api/auth/me'),
  updateProfile: (payload: Partial<UserProfile>) =>
    request<UserProfile>('/api/auth/profile', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  uploadProfileImage: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UserProfile>('/api/auth/profile-image', { method: 'POST', body });
  },
};
