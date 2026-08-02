export const queryKeys = {
  currentUser: () => ['current-user'] as const,
  projects: () => ['projects'] as const,
  project: (projectId: number | null) => ['project', projectId] as const,
  datasets: (projectId: number | null) => ['datasets', projectId] as const,
  workflows: (projectId: number | null) => ['workflows', projectId] as const,
  workflow: (workflowId: number | null) => ['workflow', workflowId] as const,
  workflowVersions: (workflowId: number | null) => ['workflow-versions', workflowId] as const,
  runs: (projectId: number | null) => ['runs', projectId] as const,
  run: (runId: number | null) => ['run', runId] as const,
  nodeCatalog: () => ['node-catalog'] as const,
  components: (projectId: number | null) => ['components', projectId] as const,
  artifacts: (projectId: number | null) => ['artifacts', projectId] as const,
};
