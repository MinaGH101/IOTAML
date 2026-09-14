import type { ProjectPriority } from '../../../shared/types';

export const PRIORITY_OPTIONS: Array<{ value: ProjectPriority; label: string }> = [
  { value: 'low', label: 'کم' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'زیاد' },
];

export const roleLabel = (role: string) => ({ admin: 'مدیر سیستم', manager: 'مدیر', expert: 'کارشناس', guest: 'مهمان' }[role] || role);
export type AssignmentMode = 'view' | 'edit';
