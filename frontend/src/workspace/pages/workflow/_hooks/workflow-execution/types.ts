import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { Run, RunSummary, Workflow } from '../../../../../shared/types';
export type WorkflowExecutionOptions = {
    nodes: Node[];
    edges: Edge[];
    selectedId: string | null;
    setSelectedId: Dispatch<SetStateAction<string | null>>;
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
    setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
    versionPreviewActive: boolean;
    componentEditorActive: boolean;
    workflowName: string;
    datasetId: number | null;
    projectId: number;
    targetColumn: string;
    taskType: string;
    getExecutionSnapshot: () => {
        nodes: Node[];
        edges: Edge[];
        autosaveSnapshot: {
            name: string;
            graph: Record<string, unknown>;
            project_id: number;
        };
        autosaveSignature: string;
        currentOutputSignature: string;
    };
    autosaveSnapshot: {
        name: string;
        graph: Record<string, unknown>;
        project_id: number;
    };
    autosaveSignature: string;
    currentOutputSignature: string;
    persistSnapshot: (snapshot: {
        name: string;
        graph: Record<string, unknown>;
        project_id: number;
    }, signature: string) => Promise<Workflow>;
    setBusy: Dispatch<SetStateAction<boolean>>;
    setLastRunSignature: Dispatch<SetStateAction<string>>;
    recordRun: (run: Run) => void;
    retryRunWithSignature: (run: Run | RunSummary, signature: string) => Promise<void>;
    setMessage: (message: string) => void;
};
