import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../../../../shared/types';
import type { LegacyNodeAliases } from '../../../../_model/catalog';
import type { Output } from '../../../../_model/output';
export type AnalysisBoardsOptions = {
    outputs: Output[];
    currentRunId: number | null;
    nodes: Node[];
    registry: RegistryNode[];
    aliases: LegacyNodeAliases;
    selectedNodeId: string | null;
    readOnly: boolean;
    boardOpen: boolean;
    setBoardOpen: (open: boolean) => void;
    setMessage: (message: string) => void;
};
