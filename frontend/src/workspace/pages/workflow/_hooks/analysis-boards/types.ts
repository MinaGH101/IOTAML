import type { Node } from '@xyflow/react';
import type { Output } from '../../../../_model/output';
export type AnalysisBoardsOptions = {
    outputs: Output[];
    currentRunId: number | null;
    nodes: Node[];
    selectedNodeId: string | null;
    readOnly: boolean;
    boardOpen: boolean;
    setBoardOpen: (open: boolean) => void;
    setMessage: (message: string) => void;
};
