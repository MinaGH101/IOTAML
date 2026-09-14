import { useCallback } from 'react';
import { addEdge, type Connection } from '@xyflow/react';
import { compatiblePorts, portTypeFor } from '../../../../_model/catalog';
import type { WorkflowCanvasOptions } from './types';
export function useCanvasConnections(o: WorkflowCanvasOptions) {
    const onInputSourceHandleChange = useCallback((edgeId: string, sourceHandle: string) => { if (!o.readOnly)
        o.setEdges((items) => items.map((edge) => edge.id === edgeId ? { ...edge, sourceHandle } : edge)); }, [o.readOnly, o.setEdges]);
    const onConnect = useCallback((connection: Connection) => {
        if (o.readOnly)
            return;
        const source = o.nodes.find((node) => node.id === connection.source);
        const target = o.nodes.find((node) => node.id === connection.target);
        const sourceHandle = connection.sourceHandle || String(((source?.data?.outputs || []) as Array<{
            id?: string;
        }>)[0]?.id || 'output');
        const targetHandle = connection.targetHandle || String(((target?.data?.inputs || []) as Array<{
            id?: string;
        }>)[0]?.id || 'input');
        const sourceType = portTypeFor(source, o.registry, o.catalog.aliases, sourceHandle, 'source');
        const targetType = portTypeFor(target, o.registry, o.catalog.aliases, targetHandle, 'target');
        if (!compatiblePorts(sourceType, targetType, o.catalog.compatiblePorts)) {
            o.setMessage(`اتصال نامعتبر است: ${sourceType} → ${targetType}`);
            return;
        }
        o.setEdges((items) => addEdge({ ...connection, sourceHandle, targetHandle, animated: true }, items));
    }, [o.catalog.aliases, o.catalog.compatiblePorts, o.nodes, o.readOnly, o.registry, o.setEdges, o.setMessage]);
    return { onInputSourceHandleChange, onConnect };
}
