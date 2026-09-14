import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { RegistryNode, UserProfile } from '../../../../../../shared/types';
export type FitView = (options: {
    padding?: number;
    duration?: number;
    nodes?: Node[];
}) => unknown;
export type UseWorkflowComponentsOptions = {
    projectId: number;
    user: UserProfile;
    nodes: Node[];
    setNodes: Dispatch<SetStateAction<Node[]>>;
    edges: Edge[];
    setEdges: Dispatch<SetStateAction<Edge[]>>;
    selectedIds: string[];
    setSelectedId: Dispatch<SetStateAction<string | null>>;
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
    setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
    setModalNodeId: Dispatch<SetStateAction<string | null>>;
    registry: RegistryNode[];
    aliases: Record<string, string>;
    readOnly: boolean;
    fitView: FitView;
    setBoardOpen: (open: boolean) => void;
    setMessage: (message: string) => void;
    refreshRegistry: () => Promise<void>;
};
