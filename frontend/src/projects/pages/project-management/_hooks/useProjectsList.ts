import { useMemo, useState } from 'react';
import type { Project } from '../../../../shared/types';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { queryKeys } from '../../../../shared/state/queryKeys';
import { invalidateQueries, useServerQuery } from '../../../../shared/state/serverQuery';
import { projectsApi } from '../../../api/projectsApi';
import { EMPTY_FILTERS, matchesProject, type ProjectFilters } from '../projectFilters';

export function useProjectsList(onOpenProject: (project: Project) => void) {
  const [filters, setFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [message, setMessage] = useState<UiMessage>(null);
  const query = useServerQuery({ key: queryKeys.projects(), queryFn: projectsApi.list, staleTime: 20_000 });
  const filtered = useMemo(() => (query.data ?? []).filter((project) => matchesProject(project, filters)), [filters, query.data]);
  const groups = useMemo(() => ({
    newAssigned: filtered.filter((project) => project.is_new_assignment),
    owned: filtered.filter((project) => !project.is_new_assignment && (project.access_source === 'owned' || project.effective_access === 'admin')),
    accessible: filtered.filter((project) => !project.is_new_assignment && project.access_source !== 'owned' && project.effective_access !== 'admin'),
  }), [filtered]);
  const refresh = async () => { try { await query.refetch(); setMessage(null); } catch (error) { setMessage(messageFromError(error, 'دریافت پروژه‌ها ناموفق بود')); } };
  const open = (project: Project) => { if (project.is_new_assignment) void projectsApi.acknowledge(project.id).then(() => invalidateQueries(queryKeys.projects())).catch(() => undefined); onOpenProject(project); };
  return { filters, setFilters, message: message ?? (query.error ? messageFromError(query.error, 'دریافت پروژه‌ها ناموفق بود') : null), groups, refresh, open, fetching: query.isFetching };
}
