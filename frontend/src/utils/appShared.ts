import { API_URL, ApiError } from '../api';
import type { Project, ProjectPayload, Run, UserProfile } from '../types';

export type Theme = 'light' | 'dark';
export type UiMessage = { text: string; tone: 'success' | 'error' | 'info' } | null;

const PROJECT_COLOR_VARIABLES = [
  '--theme-project-color-1',
  '--theme-project-color-2',
  '--theme-project-color-3',
  '--theme-project-color-4',
  '--theme-project-color-5',
  '--theme-project-color-6',
  '--theme-project-color-7',
] as const;

export function readThemeColor(variable: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

export function getProjectColors(): string[] {
  return PROJECT_COLOR_VARIABLES.map(readThemeColor).filter(Boolean);
}

export function getDefaultProjectColor(): string {
  return readThemeColor('--theme-project-color-1') || readThemeColor('--theme-primary');
}

const API_ERROR_MESSAGES: Record<string, string> = {
  ARTIFACT_TOO_LARGE: 'حجم فایل بیشتر از محدودیت فضای ذخیره‌سازی است.',
  STORAGE_QUOTA_EXCEEDED: 'سهمیه فضای ذخیره‌سازی پروژه یا کاربر تکمیل شده است.',
  STORAGE_UNAVAILABLE: 'فضای ذخیره‌سازی در دسترس نیست. دوباره تلاش کنید.',
  DATASET_READ_FAILED: 'فایل CSV قابل خواندن نیست.',
  UNSUPPORTED_FILE_TYPE: 'نوع فایل پشتیبانی نمی‌شود.',
  PROJECT_NOT_FOUND: 'پروژه پیدا نشد.',
  DATASET_NOT_FOUND: 'دیتاست پیدا نشد.',
  WORKFLOW_NOT_FOUND: 'جریان کاری پیدا نشد.',
  WORKFLOW_VALIDATION_FAILED: 'ساختار جریان کاری معتبر نیست.',
  PERMISSION_DENIED: 'اجازه انجام این عملیات را ندارید.',
  VALIDATION_ERROR: 'اطلاعات واردشده معتبر نیست.'
};

export function messageFromError(error: unknown, fallback: string): UiMessage {
  if (error instanceof ApiError) {
    return { text: API_ERROR_MESSAGES[error.code] || error.message || fallback, tone: 'error' };
  }
  return { text: error instanceof Error ? error.message : fallback, tone: 'error' };
}

export function mediaSrc(value?: string | null) {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL.replace(/\/$/, '')}${value.startsWith('/') ? value : `/${value}`}`;
}

export const defaultProjectPayload = (user?: UserProfile | null): ProjectPayload => ({
  name: '',
  description: '',
  start_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  project_manager: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '',
  state: 'open',
  priority: 'medium',
  color: getDefaultProjectColor()
});

export const payloadFromProject = (project: Project): ProjectPayload => ({
  name: project.name,
  description: project.description || '',
  start_date: project.start_date || '',
  due_date: project.due_date || '',
  project_manager: project.project_manager || '',
  state: project.state,
  priority: project.priority || 'medium',
  color: project.color || getDefaultProjectColor()
});

export function formatDate(value?: string | null) {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString('fa-IR'); } catch { return value; }
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('fa-IR'); } catch { return value; }
}


export function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function runDuration(run: Run) {
  if (!run.started_at || !run.finished_at) return '—';
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return `${Math.max(1, Math.round(ms / 1000)).toLocaleString('fa-IR')} ثانیه`;
}
