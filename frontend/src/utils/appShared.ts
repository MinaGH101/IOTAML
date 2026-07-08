import { API_URL } from '../api';
import type { Project, ProjectPayload, Run, UserProfile } from '../types';

export type Theme = 'light' | 'dark';
export type UiMessage = { text: string; tone: 'success' | 'error' | 'info' } | null;

export const PROJECT_COLORS = ['#31cde3', '#7257f2', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6'];
export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

export function messageFromError(error: unknown, fallback: string): UiMessage {
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
  color: DEFAULT_PROJECT_COLOR
});

export const payloadFromProject = (project: Project): ProjectPayload => ({
  name: project.name,
  description: project.description || '',
  start_date: project.start_date || '',
  due_date: project.due_date || '',
  project_manager: project.project_manager || '',
  state: project.state,
  priority: project.priority || 'medium',
  color: project.color || DEFAULT_PROJECT_COLOR
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
