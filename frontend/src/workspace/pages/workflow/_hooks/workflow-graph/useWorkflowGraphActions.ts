import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import type { createWorkflowGraphStore } from '../../../../../features/workflow/model/workflowGraphStore';
import { sameStringArray } from '../../../../../shared/lib/collections';
type Store = ReturnType<typeof createWorkflowGraphStore>;
export function useWorkflowGraphActions(store: Store, readOnly: boolean, canManageLocks: boolean) {
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
    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (readOnly) return;
        const locked = new Set(store.getState().liveNodes.filter((node) => node.data?.ownerLocked === true).map((node) => node.id));
        store.getState().applyNodeChanges(canManageLocks ? changes : changes.filter((change) => !('id' in change) || !locked.has(change.id)
            || change.type === 'select'));
    }, [canManageLocks, readOnly, store]);
    const commitNodePositions = useCallback(() => store.getState().commitNodePositions(), [store]);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        if (readOnly) return;
        const state = store.getState();
        if (canManageLocks) {
            state.applyEdgeChanges(changes);
            return;
        }
        const locked = new Set(state.liveNodes.filter((node) => node.data?.ownerLocked === true).map((node) => node.id));
        const protectedEdges = new Set(state.edges.filter((edge) => locked.has(edge.source) || locked.has(edge.target)).map((edge) => edge.id));
        state.applyEdgeChanges(changes.filter((change) => !('id' in change) || !protectedEdges.has(change.id) || change.type === 'select'));
    }, [canManageLocks, readOnly, store]);
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
            const remove = new Set(nodeIds.filter((id) => canManageLocks || state.liveNodes.find((node) => node.id === id)?.data?.ownerLocked !== true));
            if (!remove.size) return;
            state.setNodes((items) => items.filter((node) => !remove.has(node.id)));
            state.setEdges((items) => items.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)));
            state.resetSelection();
        }
        else if (edgeIds.length) {
            const locked = new Set(state.liveNodes.filter((node) => node.data?.ownerLocked === true).map((node) => node.id));
            const remove = new Set(edgeIds.filter((id) => {
                const edge = state.edges.find((item) => item.id === id);
                return canManageLocks || !edge || (!locked.has(edge.source) && !locked.has(edge.target));
            }));
            if (!remove.size) return;
            state.setEdges((items) => items.filter((edge) => !remove.has(edge.id)));
            state.setSelectedEdgeId(null);
            state.setSelectedEdgeIds([]);
        }
    }, [canManageLocks, readOnly, store]);
    return { clearSelection, selectNode, onNodesChange, commitNodePositions, onEdgesChange, onSelectionChange, onNodeClick, onEdgeClick, onPaneClick: clearSelection, deleteSelected };
}
