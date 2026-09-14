import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { RegistryNode, UserProfile, WorkflowComponent, ComponentVersion } from '../../../../../../shared/types';
export type ComponentEditorState = {
    component: WorkflowComponent;
    version: ComponentVersion;
    parentNodes: Node[];
    parentEdges: Edge[];
    sourceNodeId: string | null;
    baselineSignature: string;
};
export type PendingComponentUpgrade = {
    component: WorkflowComponent;
    version: ComponentVersion;
    registryNode: RegistryNode;
};
export type FitView = (options: {
    padding?: number;
    duration?: number;
    nodes?: Node[];
}) => unknown;
export type UseComponentEditorOptions = {
    projectId: number;
    user: UserProfile;
    items: WorkflowComponent[];
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
    busy: boolean;
    setBusy: Dispatch<SetStateAction<boolean>>;
    fitView: FitView;
    setBoardOpen: (open: boolean) => void;
    setMessage: (message: string) => void;
    refreshComponents: () => Promise<WorkflowComponent[]>;
    refreshRegistry: () => Promise<void>;
};
