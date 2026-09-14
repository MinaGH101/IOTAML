import type { AssignableUser } from '../../shared/types';
import { useServerQuery } from '../../shared/state/serverQuery';
import { projectsApi } from '../api/projectsApi';

export function useAssignableUsers(enabled: boolean): AssignableUser[] {
  const query = useServerQuery({ key: ['project-assignable-users'], queryFn: projectsApi.assignableUsers, enabled, staleTime: 60_000 });
  return query.data ?? [];
}
