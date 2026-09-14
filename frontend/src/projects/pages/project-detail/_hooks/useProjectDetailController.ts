import { useCallback, useEffect, useState } from 'react';
import type { ArtifactUsage, Dataset, ProjectPayload, Workflow } from '../../../../shared/types';
import { payloadFromProject } from '../../../../shared/lib/projects';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { projectsApi } from '../../../api/projectsApi';
import { fetchProjectAssets } from '../../../lib/projectData';
import { useAssignableUsers } from '../../../hooks/useAssignableUsers';
import { useProjectMutations } from './useProjectMutations';
import { useWorkflowManagement } from './useWorkflowManagement';
import type { ProjectDetailPageProps } from '../ProjectDetailPage';

export function useProjectDetailController(props: ProjectDetailPageProps) {
  const [draft, setDraft] = useState<ProjectPayload>(() => payloadFromProject(props.project)); const [message, setMessage] = useState<UiMessage>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]); const [workflows, setWorkflows] = useState<Workflow[]>([]); const [artifactUsage, setArtifactUsage] = useState<ArtifactUsage | null>(null);
  const refresh = useCallback(async () => {
    const [project, assets, usage] = await Promise.all([projectsApi.get(props.project.id), fetchProjectAssets(props.project.id), projectsApi.artifactUsage(props.project.id)]);
    props.onProjectUpdated(project); setDatasets(assets.datasets); setWorkflows(assets.workflows); setArtifactUsage(usage);
  }, [props.onProjectUpdated, props.project.id]);
  useEffect(() => { setDraft(payloadFromProject(props.project)); refresh().catch((error) => setMessage(messageFromError(error, 'دریافت جزئیات پروژه ناموفق بود'))); }, [props.project.id, refresh]);
  const users = useAssignableUsers(props.project.can_manage_assignments);
  const mutations = useProjectMutations({ project: props.project, draft, onBack: props.onBack, onProjectUpdated: props.onProjectUpdated, refresh, setMessage });
  const workflow = useWorkflowManagement({ projectId: props.project.id, datasets, workflows, setWorkflows, refresh, setMessage, onOpenEditor: props.onOpenEditor });
  return { refresh, draft, setDraft, message, users, datasets, workflows, artifactUsage, ...mutations, workflow };
}
