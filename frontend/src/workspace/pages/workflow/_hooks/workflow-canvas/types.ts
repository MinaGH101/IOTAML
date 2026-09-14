import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { NodeCatalogResponse, RegistryNode, Run } from '../../../../../shared/types';
export type FitView = (options: {
    padding?: number;
    duration?: number;
    minZoom?: number;
    maxZoom?: number;
}) => unknown;
export type WorkflowCanvasOptions = {
    nodes: Node[];
    setNodes: Dispatch<SetStateAction<Node[]>>;
    edges: Edge[];
    setEdges: Dispatch<SetStateAction<Edge[]>>;
    registry: RegistryNode[];
    catalog: NodeCatalogResponse;
    readOnly: boolean;
    currentRun: Run | null;
    resultsWidth: number;
    paletteCollapsed: boolean;
    resultsCollapsed: boolean;
    screenToFlowPosition: (position: {
        x: number;
        y: number;
    }) => {
        x: number;
        y: number;
    };
    fitView: FitView;
    setMessage: (message: string) => void;
    setResultsCollapsed: (collapsed: boolean) => void;
    setSelectedId: Dispatch<SetStateAction<string | null>>;
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
    setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
    setModalNodeId: Dispatch<SetStateAction<string | null>>;
    selectNode: (nodeId: string, openModal?: boolean) => void;
    enterComponentNode: (node: Node) => Promise<boolean>;
    renameNodeSources: (nodeId: string, label: string) => void;
};
