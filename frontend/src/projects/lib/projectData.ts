import { queryKeys } from '../../shared/state/queryKeys';
import { invalidateQueries } from '../../shared/state/serverQuery';
import { workflowsApi } from '../../features/workflow/api/workflowsApi';
import { projectsApi } from '../api/projectsApi';

export async function fetchProjectAssets(projectId: number) {
  const [datasets, workflows] = await Promise.all([projectsApi.datasets(projectId), workflowsApi.list(projectId)]);
  return { datasets, workflows };
}

export function invalidateProjectCaches(projectId?: number | null) {
  invalidateQueries(queryKeys.projects());
  if (projectId == null) return;
  invalidateQueries(queryKeys.project(projectId)); invalidateQueries(queryKeys.datasets(projectId));
  invalidateQueries(queryKeys.workflows(projectId)); invalidateQueries(queryKeys.artifacts(projectId));
}
