import type { Project, ProjectPayload, UserProfile } from '../types';
import { getDefaultProjectColor } from './theme';

export function defaultProjectPayload(user?: UserProfile | null): ProjectPayload {
  return {
    name: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    project_manager: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '',
    state: 'open',
    priority: 'medium',
    color: getDefaultProjectColor(),
    assignments: [],
  };
}

export function payloadFromProject(project: Project): ProjectPayload {
  return {
    name: project.name,
    description: project.description || '',
    start_date: project.start_date || '',
    due_date: project.due_date || '',
    project_manager: project.project_manager || '',
    state: project.state,
    priority: project.priority || 'medium',
    color: project.color || getDefaultProjectColor(),
    assignments: project.assignments.map(({ user_id, access_type }) => ({ user_id, access_type })),
  };
}
