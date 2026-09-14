import type { Edge, Node } from '@xyflow/react';
import type { WorkflowVersion } from '../../../../../shared/types';
import type { AnalysisBoardTab } from '../../../../_model/board';
export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type WorkflowPersistenceOptions = {
    projectId: number;
    nodes: Node[];
    edges: Edge[];
    datasetId: number | null;
    targetColumn: string;
    taskType: string;
    serializedBoards: AnalysisBoardTab[];
    analysisBoardSignature: unknown;
    activeBoardId: string;
    versionPreview: WorkflowVersion | null;
    paused: boolean;
    setMessage: (message: string) => void;
};
