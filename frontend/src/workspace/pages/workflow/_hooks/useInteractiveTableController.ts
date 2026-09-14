import { useEffect, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { Output } from '../../../_model/output';
import { InteractiveTableRuntime, } from '../../../_model/interactiveTableRuntime';
export function useInteractiveTableController({ scope, nodes, outputs, updateNodeParams, }: {
    scope: string;
    nodes: Node[];
    outputs: Output[];
    updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
}) {
    const runtimeRef = useRef<InteractiveTableRuntime | null>(null);
    if (!runtimeRef.current)
        runtimeRef.current = new InteractiveTableRuntime();
    const runtime = runtimeRef.current;
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    runtime.configure(scope, (nodeId, tableState) => {
        const target = nodesRef.current.find((node) => node.id === nodeId);
        const params = (target?.data?.params || {}) as Record<string, unknown>;
        updateNodeParams(nodeId, { ...params, table_state: tableState });
    });
    useEffect(() => runtime.hydrateNodes(nodes), [nodes, runtime]);
    useEffect(() => runtime.hydrateOutputs(outputs), [outputs, runtime]);
    useEffect(() => () => runtime.dispose(), [runtime]);
    return runtime;
}
