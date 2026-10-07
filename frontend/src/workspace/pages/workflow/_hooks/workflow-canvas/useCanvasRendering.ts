import { useMemo, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { Run } from '../../../../../shared/types';
type Entry = {
    source: Node;
    runtimeInfo: unknown;
    rename: (id: string, label: string) => void;
    rendered: Node;
};
export function useCanvasRendering(nodes: Node[], currentRun: Run | null, renameNode: (id: string, label: string) => void, canManageLocks: boolean) {
    const cacheRef = useRef(new Map<string, Entry>());
    return useMemo(() => {
        const previous = cacheRef.current;
        const next = new Map<string, Entry>();
        const rendered = nodes.map((node) => {
            const runtimeInfo = currentRun?.node_statuses?.[node.id] || null;
            const cached = previous.get(node.id);
            if (cached && cached.source === node && cached.runtimeInfo === runtimeInfo && cached.rename === renameNode) {
                next.set(node.id, cached);
                return cached.rendered;
            }
            const locked = node.data?.ownerLocked === true;
            const item = { ...node, draggable: !locked || canManageLocks, deletable: !locked || canManageLocks,
                connectable: !locked || canManageLocks, data: { ...node.data, onRename: renameNode,
                canEditNode: !locked || canManageLocks, runtimeStatus: runtimeInfo?.status || null, runtimeInfo } };
            next.set(node.id, { source: node, runtimeInfo, rename: renameNode, rendered: item });
            return item;
        });
        cacheRef.current = next;
        return rendered;
    }, [canManageLocks, currentRun?.node_statuses, nodes, renameNode]);
}
