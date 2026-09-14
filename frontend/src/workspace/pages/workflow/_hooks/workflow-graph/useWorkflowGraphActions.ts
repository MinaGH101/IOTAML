import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import type { createWorkflowGraphStore } from '../../../../../features/workflow/model/workflowGraphStore';
import { sameStringArray } from '../../../../../shared/lib/collections';
type Store = ReturnType<typeof createWorkflowGraphStore>;
export function useWorkflowGraphActions(store: Store, readOnly: boolean) {
    const clearSelection = useCallback(() => store.getState().resetSelection(), [store]);
    const selectNode = useCallback((nodeId: string, openModal = false) => {
        const state = store.getState();
        state.setSelectedId(nodeId);
        state.setSelectedIds([nodeId]);
        state.setSelectedEdgeId(null);
        state.setSelectedEdgeIds([]);
        if (openModal)
            state.setModalNodeId(nodeId);
    }, [store]);
    const onNodesChange = useCallback((changes: NodeChange[]) => store.getState().applyNodeChanges(changes), [store]);
    const commitNodePositions = useCallback(() => store.getState().commitNodePositions(), [store]);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => store.getState().applyEdgeChanges(changes), [store]);
    const onSelectionChange = useCallback(({ nodes, edges }: {
        nodes: Node[];
        edges: Edge[];
    }) => {
        const nodeIds = nodes.map((node) => node.id);
        const edgeIds = edges.map((edge) => edge.id);
        const state = store.getState();
        state.setSelectedIds((previous) => sameStringArray(previous, nodeIds) ? previous : nodeIds);
        state.setSelectedEdgeIds((previous) => sameStringArray(previous, edgeIds) ? previous : edgeIds);
        if (nodeIds.length) {
            state.setSelectedId(nodeIds[nodeIds.length - 1] || null);
            state.setSelectedEdgeId(null);
        }
        else if (edgeIds.length) {
            state.setSelectedEdgeId(edgeIds[edgeIds.length - 1] || null);
            state.setSelectedId(null);
        }
        else {
            state.setSelectedId(null);
            state.setSelectedEdgeId(null);
        }
    }, [store]);
    const onNodeClick = useCallback((_: ReactMouseEvent, node: Node) => selectNode(node.id), [selectNode]);
    const onEdgeClick = useCallback((_: ReactMouseEvent, edge: Edge) => {
        const state = store.getState();
        state.setSelectedEdgeId(edge.id);
        state.setSelectedEdgeIds([edge.id]);
        state.setSelectedId(null);
        state.setSelectedIds([]);
    }, [store]);
    const deleteSelected = useCallback(() => {
        if (readOnly)
            return;
        const state = store.getState();
        const nodeIds = state.selectedIds.length ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
        const edgeIds = state.selectedEdgeIds.length ? state.selectedEdgeIds : (state.selectedEdgeId ? [state.selectedEdgeId] : []);
        if (nodeIds.length) {
            const remove = new Set(nodeIds);
            state.setNodes((items) => items.filter((node) => !remove.has(node.id)));
            state.setEdges((items) => items.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)));
            state.resetSelection();
        }
        else if (edgeIds.length) {
            const remove = new Set(edgeIds);
            state.setEdges((items) => items.filter((edge) => !remove.has(edge.id)));
            state.setSelectedEdgeId(null);
            state.setSelectedEdgeIds([]);
        }
    }, [readOnly, store]);
    return { clearSelection, selectNode, onNodesChange, commitNodePositions, onEdgesChange, onSelectionChange, onNodeClick, onEdgeClick, onPaneClick: clearSelection, deleteSelected };
}
