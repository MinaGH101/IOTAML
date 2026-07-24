import {
  useCallback,
  useMemo,
  type Dispatch,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import {
  addEdge,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { NodeCatalogResponse, RegistryNode, Run } from '../../../../shared/_types';
import { compatiblePorts, portTypeFor } from '../../../_model/catalog';
import {
  renameWorkflowNode,
  updateNodeParameters,
  updateNodePinnedOutput,
  type PinnedNodeData,
} from '../../../_model/nodeMutations';
import { makeNode } from '../../../_model/graph';
import { layoutWorkflowNodes } from '../_model/workflowAutoLayout';

type FitView = (options: {
  padding?: number;
  duration?: number;
  minZoom?: number;
  maxZoom?: number;
}) => unknown;

export function useWorkflowCanvasActions({
  nodes,
  setNodes,
  edges,
  setEdges,
  registry,
  catalog,
  readOnly,
  currentRun,
  resultsWidth,
  paletteCollapsed,
  resultsCollapsed,
  screenToFlowPosition,
  fitView,
  setMessage,
  setResultsCollapsed,
  setSelectedId,
  setSelectedIds,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  setModalNodeId,
  selectNode,
  enterComponentNode,
  renameNodeSources,
}: {
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
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
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
}) {
  const onInputSourceHandleChange = useCallback((edgeId: string, sourceHandle: string) => {
    if (readOnly) return;
    setEdges((items) => items.map((edge) => (
      edge.id === edgeId ? { ...edge, sourceHandle } : edge
    )));
  }, [readOnly, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    if (readOnly) return;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const sourcePorts = (sourceNode?.data?.outputs || []) as Array<{ id?: string }>;
    const targetPorts = (targetNode?.data?.inputs || []) as Array<{ id?: string }>;
    const sourceHandle = connection.sourceHandle || String(sourcePorts[0]?.id || 'output');
    const targetHandle = connection.targetHandle || String(targetPorts[0]?.id || 'input');
    const sourceType = portTypeFor(sourceNode, registry, catalog.aliases, sourceHandle, 'source');
    const targetType = portTypeFor(targetNode, registry, catalog.aliases, targetHandle, 'target');
    if (!compatiblePorts(sourceType, targetType, catalog.compatiblePorts)) {
      setMessage(`اتصال نامعتبر است: ${sourceType} → ${targetType}`);
      return;
    }
    setEdges((items) => addEdge({
      ...connection,
      sourceHandle,
      targetHandle,
      animated: true,
    }, items));
  }, [catalog.aliases, catalog.compatiblePorts, nodes, readOnly, registry, setEdges, setMessage]);

  const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: Node) => {
    if (readOnly) return;
    if (node.data?.componentSnapshot) {
      void enterComponentNode(node);
      return;
    }
    selectNode(node.id, true);
  }, [enterComponentNode, readOnly, selectNode]);

  const updateNodeParams = useCallback((nodeId: string, params: Record<string, unknown>) => {
    if (readOnly) return;
    setNodes((items) => updateNodeParameters(items, nodeId, params));
  }, [readOnly, setNodes]);

  const renameNode = useCallback((nodeId: string, label: string) => {
    if (readOnly) return;
    setNodes((items) => renameWorkflowNode(items, nodeId, label));
    renameNodeSources(nodeId, label);
  }, [readOnly, renameNodeSources, setNodes]);

  const updateNodePinned = useCallback((nodeId: string, pinned: PinnedNodeData) => {
    if (readOnly) return;
    setNodes((items) => updateNodePinnedOutput(items, nodeId, pinned));
  }, [readOnly, setNodes]);

  const selectWorkflowNode = useCallback((nodeId: string) => {
    selectNode(nodeId);
    setResultsCollapsed(false);
  }, [selectNode, setResultsCollapsed]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (readOnly) return;
    const nodeId = event.dataTransfer.getData('application/nocodeml-node');
    const registryNode = registry.find((node) => node.id === nodeId);
    if (!registryNode) return;
    const newNode = makeNode(
      registryNode,
      nodes.length,
      screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    );
    setNodes((items) => [...items, newNode]);
    setSelectedId(newNode.id);
    setSelectedIds([newNode.id]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
  }, [nodes.length, readOnly, registry, screenToFlowPosition, setModalNodeId, setNodes, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds]);

  const prettyLayout = useCallback(() => {
    if (readOnly) return;
    setNodes(layoutWorkflowNodes(nodes, edges, {
      width: window.innerWidth,
      height: window.innerHeight,
      paletteCollapsed,
      resultsCollapsed,
      resultsWidth,
    }));
    window.setTimeout(() => fitView({
      padding: 0.08,
      duration: 450,
      minZoom: 0.42,
      maxZoom: 1.2,
    }), 60);
  }, [edges, fitView, nodes, paletteCollapsed, readOnly, resultsCollapsed, resultsWidth, setNodes]);

  const flowNodes = useMemo(() => nodes.map((node) => {
    const runtimeInfo = currentRun?.node_statuses?.[node.id];
    return {
      ...node,
      data: {
        ...node.data,
        onRename: renameNode,
        runtimeStatus: runtimeInfo?.status || null,
        runtimeInfo: runtimeInfo || null,
      },
    };
  }), [currentRun?.node_statuses, nodes, renameNode]);

  return {
    onInputSourceHandleChange,
    onConnect,
    onNodeDoubleClick,
    updateNodeParams,
    renameNode,
    updateNodePinned,
    selectWorkflowNode,
    onDragOver,
    onDrop,
    prettyLayout,
    flowNodes,
  };
}
