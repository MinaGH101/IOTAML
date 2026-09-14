import { useCallback, useRef, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { makeNode } from '../../../../_model/graph';
import { renameWorkflowNode, updateNodeParameters, updateNodePinnedOutput, type PinnedNodeData } from '../../../../_model/nodeMutations';
import { layoutWorkflowNodes } from '../../_model/workflowAutoLayout';
import type { WorkflowCanvasOptions } from './types';
export function useCanvasNodeActions(o: WorkflowCanvasOptions) {
    const nodesRef = useRef(o.nodes);
    const edgesRef = useRef(o.edges);
    nodesRef.current = o.nodes;
    edgesRef.current = o.edges;
    const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: Node) => { if (o.readOnly)
        return; if (node.data?.componentSnapshot)
        void o.enterComponentNode(node);
    else
        o.selectNode(node.id, true); }, [o.enterComponentNode, o.readOnly, o.selectNode]);
    const updateNodeParams = useCallback((id: string, params: Record<string, unknown>) => { if (!o.readOnly)
        o.setNodes((items) => updateNodeParameters(items, id, params)); }, [o.readOnly, o.setNodes]);
    const renameNode = useCallback((id: string, label: string) => { if (o.readOnly)
        return; o.setNodes((items) => renameWorkflowNode(items, id, label)); o.renameNodeSources(id, label); }, [o.readOnly, o.renameNodeSources, o.setNodes]);
    const updateNodePinned = useCallback((id: string, pinned: PinnedNodeData) => { if (!o.readOnly)
        o.setNodes((items) => updateNodePinnedOutput(items, id, pinned)); }, [o.readOnly, o.setNodes]);
    const selectWorkflowNode = useCallback((id: string) => { o.selectNode(id); o.setResultsCollapsed(false); }, [o.selectNode, o.setResultsCollapsed]);
    const onDragOver = useCallback((event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
    const onDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        if (o.readOnly)
            return;
        const id = event.dataTransfer.getData('application/iotaml-node');
        const registryNode = o.registry.find((n) => n.id === id);
        if (!registryNode)
            return;
        const node = makeNode(registryNode, o.nodes.length, o.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        o.setNodes((items) => [...items, node]);
        o.setSelectedId(node.id);
        o.setSelectedIds([node.id]);
        o.setSelectedEdgeId(null);
        o.setSelectedEdgeIds([]);
        o.setModalNodeId(null);
    }, [o.nodes.length, o.readOnly, o.registry, o.screenToFlowPosition, o.setModalNodeId, o.setNodes, o.setSelectedEdgeId, o.setSelectedEdgeIds, o.setSelectedId, o.setSelectedIds]);
    const prettyLayout = useCallback(() => {
        if (o.readOnly)
            return;
        o.setNodes(layoutWorkflowNodes(nodesRef.current, edgesRef.current, { width: window.innerWidth, height: window.innerHeight, paletteCollapsed: o.paletteCollapsed, resultsCollapsed: o.resultsCollapsed, resultsWidth: o.resultsWidth }));
        window.setTimeout(() => o.fitView({ padding: 0.08, duration: 450, minZoom: 0.42, maxZoom: 1.2 }), 60);
    }, [o.fitView, o.paletteCollapsed, o.readOnly, o.resultsCollapsed, o.resultsWidth, o.setNodes]);
    return { onNodeDoubleClick, updateNodeParams, renameNode, updateNodePinned, selectWorkflowNode, onDragOver, onDrop, prettyLayout };
}
