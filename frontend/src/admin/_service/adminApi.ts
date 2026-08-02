import type { AdminUser, AdminUserPayload } from '../../shared/_types';
import type { Project } from '../../shared/_types';
import { jsonHeaders, request } from '../../shared/_service/httpClient';

export type AdminUserProject = Pick<Project, 'id' | 'name' | 'owner_username' | 'updated_at'> & { access_type: 'owner' | 'edit' | 'view' };
export type AdminUserDetail = { user: AdminUser; projects: AdminUserProject[] };

export const adminApi = {
  users: (query = '') => request<AdminUser[]>(`/api/admin/users${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  user: (id: number) => request<AdminUserDetail>(`/api/admin/users/${id}`),
  createUser: (payload: AdminUserPayload & { password: string }) => request<AdminUser>('/api/admin/users', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: Partial<AdminUserPayload>) => request<AdminUser>(`/api/admin/users/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteUser: (id: number) => request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
};
