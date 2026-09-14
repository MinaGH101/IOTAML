import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { NodeCatalogResponse, WorkflowVersion } from '../../../../shared/types';
import { useWorkflowGraph } from '../_hooks/useWorkflowGraph';
import { useProjectDatasets } from '../_hooks/useProjectDatasets';
import { useRunHistory } from '../_hooks/useRunHistory';
import { useWorkflowShellState } from '../_hooks/useWorkflowShellState';
import { usePersistentWorkflowViewport } from '../_hooks/usePersistentWorkflowViewport';
import type { WorkflowPageProps } from './types';
const EMPTY_CATALOG: NodeCatalogResponse = { version: 0, nodes: [], aliases: {}, categories: [], compatiblePorts: {} };
export function useWorkflowEditorBase({ project, user, initialWorkflowId }: WorkflowPageProps) {
    const flow = useReactFlow();
    const projectId = project.id;
    const [catalog, setCatalog] = useState<NodeCatalogResponse>(EMPTY_CATALOG);
    const [targetColumn, setTargetColumn] = useState('target');
    const [taskType, setTaskType] = useState('auto');
    const [message, setMessage] = useState('');
    const [resultsWidth, setResultsWidth] = useState(380);
    const [versionPreview, setVersionPreview] = useState<WorkflowVersion | null>(null);
    const readOnly = !project.can_edit || Boolean(versionPreview);
    const shell = useWorkflowShellState();
    const graph = useWorkflowGraph({ readOnly });
    const viewportStorageScope = `user:${user.username}:project:${projectId}:workflow:${initialWorkflowId ?? 'draft'}`;
    const workflowCanvas = usePersistentWorkflowViewport({ storageScope: viewportStorageScope, setViewport: flow.setViewport });
    const datasets = useProjectDatasets({ projectId, setNodes: graph.setNodes, setMessage });
    const runs = useRunHistory({ projectId, setMessage });
    return { projectId, catalog, setCatalog, targetColumn, setTargetColumn, taskType, setTaskType, message, setMessage, resultsWidth, setResultsWidth,
        versionPreview, setVersionPreview, readOnly, shell, graph, workflowCanvas, viewportStorageScope, datasets, runs, flow };
}
export type WorkflowEditorBase = ReturnType<typeof useWorkflowEditorBase>;
