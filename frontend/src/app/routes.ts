export type AppRoute =
  | { name: 'login' }
  | { name: 'projects' }
  | { name: 'create-project' }
  | { name: 'profile' }
  | { name: 'project'; projectId: number }
  | { name: 'workflow'; projectId: number; workflowId: number | null }
  | { name: 'not-found' };

function positiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseAppRoute(pathname: string, search = ''): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/login') return { name: 'login' };
  if (path === '/' || path === '/projects') return { name: 'projects' };
  if (path === '/projects/new') return { name: 'create-project' };
  if (path === '/profile') return { name: 'profile' };

  const projectMatch = path.match(/^\/projects\/(\d+)$/);
  if (projectMatch) {
    const projectId = positiveInteger(projectMatch[1]);
    return projectId ? { name: 'project', projectId } : { name: 'not-found' };
  }

  const workspaceMatch = path.match(/^\/projects\/(\d+)\/workspace$/);
  if (workspaceMatch) {
    const projectId = positiveInteger(workspaceMatch[1]);
    const workflowId = positiveInteger(new URLSearchParams(search).get('workflow') || undefined);
    return projectId
      ? { name: 'workflow', projectId, workflowId }
      : { name: 'not-found' };
  }

  return { name: 'not-found' };
}

export function appRoutePath(route: Exclude<AppRoute, { name: 'not-found' }>) {
  switch (route.name) {
    case 'login': return '/login';
    case 'projects': return '/projects';
    case 'create-project': return '/projects/new';
    case 'profile': return '/profile';
    case 'project': return `/projects/${route.projectId}`;
    case 'workflow': {
      const query = route.workflowId ? `?workflow=${route.workflowId}` : '';
      return `/projects/${route.projectId}/workspace${query}`;
    }
  }
}
