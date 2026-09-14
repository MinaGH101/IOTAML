import type { Project, ProjectPriority, ProjectState } from '../../../shared/types';

export type AccessFilter = 'all' | 'owned' | 'assigned' | 'edit' | 'view' | 'new';
export type ProjectFilters = { query: string; state: 'all' | ProjectState; priority: 'all' | ProjectPriority; access: AccessFilter };
export const EMPTY_FILTERS: ProjectFilters = { query: '', state: 'all', priority: 'all', access: 'all' };

export function matchesProject(project: Project, filters: ProjectFilters) {
  const search = filters.query.trim().toLocaleLowerCase('fa');
  const assignmentText = project.assignments.map((item) => `${item.display_name} ${item.username}`).join(' ');
  if (search && !`${project.name} ${project.description} ${project.project_manager} ${project.owner_display_name} ${assignmentText}`.toLocaleLowerCase('fa').includes(search)) return false;
  if (filters.state !== 'all' && project.state !== filters.state) return false;
  if (filters.priority !== 'all' && project.priority !== filters.priority) return false;
  if (filters.access === 'owned' && project.access_source !== 'owned' && project.effective_access !== 'admin') return false;
  if (filters.access === 'assigned' && project.access_source !== 'assigned') return false;
  if (filters.access === 'edit' && project.effective_access !== 'edit') return false;
  if (filters.access === 'view' && project.effective_access !== 'view') return false;
  if (filters.access === 'new' && !project.is_new_assignment) return false;
  return true;
}

export const accessLabel = (project: Project) => project.effective_access === 'owner' ? 'مالک' : project.effective_access === 'edit' ? 'دسترسی ویرایش' : project.effective_access === 'admin' ? 'مدیریت کامل' : 'فقط مشاهده';
