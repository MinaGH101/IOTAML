import { useCallback, useEffect, useMemo, useRef, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import { useAtomicStore } from '../../../../shared/state/atomicStore';
import { createWorkflowGraphStore } from '../../../../features/workflow/model/workflowGraphStore';
import { connectedGraph, isTextInput } from '../../../_model/graph';
import { sameStringArray } from '../../../../shared/_utils/appShared';

export function useWorkflowGraph({ readOnly }: { readOnly: boolean }) {
  const storeRef = useRef<ReturnType<typeof createWorkflowGraphStore> | null>(null);
  if (!storeRef.current) storeRef.current = createWorkflowGraphStore();
  const store = storeRef.current;

  const nodes = useAtomicStore(store, (state) => state.liveNodes);
  const documentNodes = useAtomicStore(store, (state) => state.documentNodes);
  const edges = useAtomicStore(store, (state) => state.edges);
  const selectedId = useAtomicStore(store, (state) => state.selectedId);
  const selectedIds = useAtomicStore(store, (state) => state.selectedIds);
  const selectedEdgeId = useAtomicStore(store, (state) => state.selectedEdgeId);
  const selectedEdgeIds = useAtomicStore(store, (state) => state.selectedEdgeIds);
  const modalNodeId = useAtomicStore(store, (state) => state.modalNodeId);
  const ctrlSelectionActive = useAtomicStore(store, (state) => state.ctrlSelectionActive);

  const setNodes = useCallback<Dispatch<SetStateAction<Node[]>>>((value) => store.getState().setNodes(value), [store]);
  const setEdges = useCallback<Dispatch<SetStateAction<Edge[]>>>((value) => store.getState().setEdges(value), [store]);
  const setSelectedId = useCallback<Dispatch<SetStateAction<string | null>>>((value) => store.getState().setSelectedId(value), [store]);
  const setSelectedIds = useCallback<Dispatch<SetStateAction<string[]>>>((value) => store.getState().setSelectedIds(value), [store]);
  const setSelectedEdgeId = useCallback<Dispatch<SetStateAction<string | null>>>((value) => store.getState().setSelectedEdgeId(value), [store]);
  const setSelectedEdgeIds = useCallback<Dispatch<SetStateAction<string[]>>>((value) => store.getState().setSelectedEdgeIds(value), [store]);
  const setModalNodeId = useCallback<Dispatch<SetStateAction<string | null>>>((value) => store.getState().setModalNodeId(value), [store]);

  const nodesById = useMemo(() => new Map(documentNodes.map((node) => [node.id, node])), [documentNodes]);
  const selectedNode = useMemo(() => nodesById.get(selectedId || '') || null, [nodesById, selectedId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId) || null, [edges, selectedEdgeId]);
  const selectedFlow = useMemo(() => connectedGraph(documentNodes, edges, selectedId), [documentNodes, edges, selectedId]);
  const modalNode = useMemo(() => nodesById.get(modalNodeId || '') || null, [modalNodeId, nodesById]);

  const clearSelection = useCallback(() => store.getState().resetSelection(), [store]);
  const selectNode = useCallback((nodeId: string, openModal = false) => {
    const state = store.getState();
    state.setSelectedId(nodeId); state.setSelectedIds([nodeId]);
    state.setSelectedEdgeId(null); state.setSelectedEdgeIds([]);
    if (openModal) state.setModalNodeId(nodeId);
  }, [store]);
  const onNodesChange = useCallback((changes: NodeChange[]) => store.getState().applyNodeChanges(changes), [store]);
  const commitNodePositions = useCallback(() => store.getState().commitNodePositions(), [store]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => store.getState().applyEdgeChanges(changes), [store]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
    const nextNodeIds = selectedNodes.map((node) => node.id);
    const nextEdgeIds = selectedEdges.map((edge) => edge.id);
    const state = store.getState();
    state.setSelectedIds((previous) => sameStringArray(previous, nextNodeIds) ? previous : nextNodeIds);
    state.setSelectedEdgeIds((previous) => sameStringArray(previous, nextEdgeIds) ? previous : nextEdgeIds);
    if (nextNodeIds.length) {
      state.setSelectedId(nextNodeIds[nextNodeIds.length - 1]); state.setSelectedEdgeId(null);
    } else if (nextEdgeIds.length) {
      state.setSelectedEdgeId(nextEdgeIds[nextEdgeIds.length - 1]); state.setSelectedId(null);
    } else {
      state.setSelectedId(null); state.setSelectedEdgeId(null);
    }
  }, [store]);

  const onNodeClick = useCallback((_: ReactMouseEvent, node: Node) => selectNode(node.id), [selectNode]);
  const onEdgeClick = useCallback((_: ReactMouseEvent, edge: Edge) => {
    const state = store.getState();
    state.setSelectedEdgeId(edge.id); state.setSelectedEdgeIds([edge.id]);
    state.setSelectedId(null); state.setSelectedIds([]);
  }, [store]);
  const onPaneClick = useCallback(() => clearSelection(), [clearSelection]);

  const deleteSelected = useCallback(() => {
    if (readOnly) return;
    const state = store.getState();
    const nodeIds = state.selectedIds.length ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
    const edgeIds = state.selectedEdgeIds.length ? state.selectedEdgeIds : (state.selectedEdgeId ? [state.selectedEdgeId] : []);
    if (nodeIds.length) {
      const remove = new Set(nodeIds);
      state.setNodes((items) => items.filter((node) => !remove.has(node.id)));
      state.setEdges((items) => items.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)));
      state.resetSelection();
    } else if (edgeIds.length) {
      const remove = new Set(edgeIds);
      state.setEdges((items) => items.filter((edge) => !remove.has(edge.id)));
      state.setSelectedEdgeId(null); state.setSelectedEdgeIds([]);
    }
  }, [readOnly, store]);

  useEffect(() => {
    const updateModifier = (event: KeyboardEvent) => store.getState().setCtrlSelectionActive(event.ctrlKey || event.metaKey);
    const clearModifier = () => store.getState().setCtrlSelectionActive(false);
    window.addEventListener('keydown', updateModifier); window.addEventListener('keyup', updateModifier); window.addEventListener('blur', clearModifier);
    return () => { window.removeEventListener('keydown', updateModifier); window.removeEventListener('keyup', updateModifier); window.removeEventListener('blur', clearModifier); };
  }, [store]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput(event.target)) deleteSelected();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  return { nodes, documentNodes, setNodes, edges, setEdges, nodesById, selectedNode, selectedEdge, selectedFlow, modalNode, selectedId, setSelectedId, selectedIds, setSelectedIds, selectedEdgeId, setSelectedEdgeId, selectedEdgeIds, setSelectedEdgeIds, modalNodeId, setModalNodeId, ctrlSelectionActive, clearSelection, selectNode, onNodesChange, commitNodePositions, onEdgesChange, onSelectionChange, onNodeClick, onEdgeClick, onPaneClick, deleteSelected };
}
