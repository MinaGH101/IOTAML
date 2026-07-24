import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { connectedGraph, isTextInput } from '../../../_model/graph';
import { sameStringArray } from '../../../../shared/_utils/appShared';

export function useWorkflowGraph({
  readOnly,
}: {
  readOnly: boolean;
}) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [ctrlSelectionActive, setCtrlSelectionActive] = useState(false);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);

  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const selectedNode = useMemo(
    () => nodesById.get(selectedId || '') || null,
    [nodesById, selectedId],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) || null,
    [edges, selectedEdgeId],
  );
  const selectedFlow = useMemo(
    () => connectedGraph(nodes, edges, selectedId),
    [edges, nodes, selectedId],
  );
  const modalNode = useMemo(
    () => nodesById.get(modalNodeId || '') || null,
    [modalNodeId, nodesById],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
  }, []);

  const selectNode = useCallback((nodeId: string, openModal = false) => {
    setSelectedId(nodeId);
    setSelectedIds([nodeId]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    if (openModal) setModalNodeId(nodeId);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((items) => applyNodeChanges(changes, items)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((items) => applyEdgeChanges(changes, items)),
    [],
  );

  const onSelectionChange = useCallback(({
    nodes: selectedNodes,
    edges: selectedEdges,
  }: {
    nodes: Node[];
    edges: Edge[];
  }) => {
    const nextNodeIds = selectedNodes.map((node) => node.id);
    const nextEdgeIds = selectedEdges.map((edge) => edge.id);
    setSelectedIds((previous) => sameStringArray(previous, nextNodeIds) ? previous : nextNodeIds);
    setSelectedEdgeIds((previous) => sameStringArray(previous, nextEdgeIds) ? previous : nextEdgeIds);
    if (nextNodeIds.length) {
      const nextSelectedId = nextNodeIds[nextNodeIds.length - 1];
      setSelectedId((previous) => previous === nextSelectedId ? previous : nextSelectedId);
      setSelectedEdgeId(null);
    } else if (nextEdgeIds.length) {
      const nextSelectedEdgeId = nextEdgeIds[nextEdgeIds.length - 1];
      setSelectedEdgeId((previous) => previous === nextSelectedEdgeId ? previous : nextSelectedEdgeId);
      setSelectedId(null);
    } else {
      setSelectedId(null);
      setSelectedEdgeId(null);
    }
  }, []);

  const onNodeClick = useCallback((_: ReactMouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onEdgeClick = useCallback((_: ReactMouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedEdgeIds([edge.id]);
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const onPaneClick = useCallback(() => clearSelection(), [clearSelection]);

  const deleteSelected = useCallback(() => {
    if (readOnly) return;
    const nodeIds = selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []);
    const edgeIds = selectedEdgeIds.length ? selectedEdgeIds : (selectedEdgeId ? [selectedEdgeId] : []);
    if (nodeIds.length) {
      const remove = new Set(nodeIds);
      setNodes((items) => items.filter((node) => !remove.has(node.id)));
      setEdges((items) => items.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)));
      clearSelection();
      return;
    }
    if (edgeIds.length) {
      const remove = new Set(edgeIds);
      setEdges((items) => items.filter((edge) => !remove.has(edge.id)));
      setSelectedEdgeId(null);
      setSelectedEdgeIds([]);
    }
  }, [clearSelection, readOnly, selectedEdgeId, selectedEdgeIds, selectedId, selectedIds]);

  useEffect(() => {
    const updateModifier = (event: KeyboardEvent) => {
      setCtrlSelectionActive(event.ctrlKey || event.metaKey);
    };
    const clearModifier = () => setCtrlSelectionActive(false);
    window.addEventListener('keydown', updateModifier);
    window.addEventListener('keyup', updateModifier);
    window.addEventListener('blur', clearModifier);
    return () => {
      window.removeEventListener('keydown', updateModifier);
      window.removeEventListener('keyup', updateModifier);
      window.removeEventListener('blur', clearModifier);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.key === 'Delete' || event.key === 'Backspace')
        && !isTextInput(event.target)
      ) deleteSelected();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  return {
    nodes,
    setNodes: setNodes as Dispatch<SetStateAction<Node[]>>,
    edges,
    setEdges: setEdges as Dispatch<SetStateAction<Edge[]>>,
    nodesById,
    selectedNode,
    selectedEdge,
    selectedFlow,
    modalNode,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedEdgeIds,
    setSelectedEdgeIds,
    modalNodeId,
    setModalNodeId,
    ctrlSelectionActive,
    clearSelection,
    selectNode,
    onNodesChange,
    onEdgesChange,
    onSelectionChange,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    deleteSelected,
  };
}
