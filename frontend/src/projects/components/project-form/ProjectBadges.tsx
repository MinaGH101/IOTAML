import type { Project, ProjectPriority } from '../../../shared/types';
import { PRIORITY_OPTIONS } from './constants';

export function ProjectPriorityBadge({ priority }: { priority?: ProjectPriority }) {
  const value = priority || 'medium';
  const label = PRIORITY_OPTIONS.find((option) => option.value === value)?.label || 'متوسط';
  return <span className={`project-priority ${value}`}>{label}</span>;
}

export function ProjectStatus({ state }: { state: Project['state'] }) {
  return <span className={`project-state ${state}`}>{state === 'open' ? 'باز' : 'بسته'}</span>;
}
