import type { Dispatch, SetStateAction } from 'react';
import type { NodeCatalogResponse, Run, WorkflowVersion } from '../../../../../shared/types';
import type { FlowGraph } from '../../../../_model/graph';
import type { WorkflowPersistenceController } from '../useWorkflowPersistence';
export type WorkflowVersionsOptions = {
    catalog: NodeCatalogResponse;
    persistence: WorkflowPersistenceController;
    workflowLastRunId: number | null;
    setWorkflowLastRunId: Dispatch<SetStateAction<number | null>>;
    setCurrentRun: Dispatch<SetStateAction<Run | null>>;
    setNodeStateRun: Dispatch<SetStateAction<Run | null>>;
    setLastRunSignature: Dispatch<SetStateAction<string>>;
    versionPreview: WorkflowVersion | null;
    setVersionPreview: Dispatch<SetStateAction<WorkflowVersion | null>>;
    applyGraph: (graph: FlowGraph, registry: NodeCatalogResponse['nodes'], aliases: Record<string, string>) => void;
    setMessage: (message: string) => void;
};
