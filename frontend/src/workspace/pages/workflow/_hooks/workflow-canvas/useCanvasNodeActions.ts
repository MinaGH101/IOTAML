import { useCallback, useRef, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { makeNode } from '../../../../_model/graph';
import { updateParametersAndPropagateColumns } from '../../../../_model/columnParameterPropagation';
import { renameWorkflowNode, updateNodePinnedOutput, type PinnedNodeData } from '../../../../_model/nodeMutations';
import { layoutWorkflowNodes } from '../../_model/workflowAutoLayout';
import type { WorkflowCanvasOptions } from './types';
export function useCanvasNodeActions(o: WorkflowCanvasOptions) {
    const nodesRef = useRef(o.nodes);
    const edgesRef = useRef(o.edges);
    nodesRef.current = o.nodes;
    edgesRef.current = o.edges;
    const lockedForEditor = useCallback((id: string) => !o.canManageLocks && nodesRef.current.find((node) => node.id === id)?.data?.ownerLocked === true, [o.canManageLocks]);
    const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: Node) => { if (o.readOnly || lockedForEditor(node.id))
        return; if (node.data?.componentSnapshot)
        void o.enterComponentNode(node);
    else
        o.selectNode(node.id, true); }, [lockedForEditor, o.enterComponentNode, o.readOnly, o.selectNode]);
    const updateNodeParams = useCallback((id: string, params: Record<string, unknown>) => { if (!o.readOnly && !lockedForEditor(id))
        o.setNodes((items) => updateParametersAndPropagateColumns({ nodes: items, edges: o.edges, nodeId: id, params, registry: o.registry, aliases: o.catalog.aliases, datasets: o.datasets, workflowDatasetId: o.datasetId })); }, [lockedForEditor, o.catalog.aliases, o.datasetId, o.datasets, o.edges, o.readOnly, o.registry, o.setNodes]);
    const renameNode = useCallback((id: string, label: string) => { if (o.readOnly || lockedForEditor(id))
        return; o.setNodes((items) => renameWorkflowNode(items, id, label)); o.renameNodeSources(id, label); }, [lockedForEditor, o.readOnly, o.renameNodeSources, o.setNodes]);
    const toggleNodeLock = useCallback((id: string) => { if (!o.canManageLocks) return;
        o.setNodes((items) => items.map((node) => node.id === id ? { ...node, data: { ...node.data, ownerLocked: node.data?.ownerLocked !== true } } : node));
    }, [o.canManageLocks, o.setNodes]);
    const updateNodePinned = useCallback((id: string, pinned: PinnedNodeData) => { if (!o.readOnly && !lockedForEditor(id))
        o.setNodes((items) => updateNodePinnedOutput(items, id, pinned)); }, [lockedForEditor, o.readOnly, o.setNodes]);
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
        if (!o.canManageLocks && nodesRef.current.some((node) => node.data?.ownerLocked === true)) {
            o.setMessage('چیدمان خودکار نیاز به جابه‌جایی نودهای قفل‌شده دارد. فقط مالک پروژه می‌تواند این کار را انجام دهد.');
            return;
        }
        o.setNodes(layoutWorkflowNodes(nodesRef.current, edgesRef.current, { width: window.innerWidth, height: window.innerHeight, paletteCollapsed: o.paletteCollapsed, resultsCollapsed: o.resultsCollapsed, resultsWidth: o.resultsWidth }));
        window.setTimeout(() => o.fitView({ padding: 0.08, duration: 450, minZoom: 0.42, maxZoom: 1.2 }), 60);
    }, [o.canManageLocks, o.fitView, o.paletteCollapsed, o.readOnly, o.resultsCollapsed, o.resultsWidth, o.setMessage, o.setNodes]);
    return { onNodeDoubleClick, updateNodeParams, renameNode, toggleNodeLock, updateNodePinned, selectWorkflowNode, onDragOver, onDrop, prettyLayout };
}
