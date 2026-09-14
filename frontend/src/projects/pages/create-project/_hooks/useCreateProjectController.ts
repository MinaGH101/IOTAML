import { useCallback, useState } from 'react';
import type { Dataset, Project, ProjectPayload, Workflow } from '../../../../shared/types';
import { defaultProjectPayload, payloadFromProject } from '../../../../shared/lib/projects';
import type { UiMessage } from '../../../../shared/lib/errors';
import { useAssignableUsers } from '../../../hooks/useAssignableUsers';
import { useCreateProjectActions } from './useCreateProjectActions';
import { useCreateWorkflowActions } from './useCreateWorkflowActions';
import type { CreateProjectPageProps } from '../CreateProjectPage';

export function useCreateProjectController(props: CreateProjectPageProps) {
  const [draft, setDraft] = useState<ProjectPayload>(() => defaultProjectPayload(props.user));
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]); const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowName, setWorkflowName] = useState('جریان IOTA ML'); const [message, setMessage] = useState<UiMessage>(null);
  const assignableUsers = useAssignableUsers(props.user.role === 'manager' || props.user.role === 'admin');
  const activateProject = useCallback((next: Project) => { setProject(next); setDraft(payloadFromProject(next)); props.onCreated(next); }, [props.onCreated]);
  const actions = useCreateProjectActions({ draft, project, activateProject, setDatasets, setWorkflows, setMessage });
  const workflow = useCreateWorkflowActions({ project, datasets, workflowName, ensureProject: actions.ensureProject, refresh: actions.refresh, setMessage, onOpenEditor: props.onOpenEditor });
  return { draft, setDraft, project, datasets, workflows, workflowName, setWorkflowName, message, assignableUsers, ...actions, workflow };
}
