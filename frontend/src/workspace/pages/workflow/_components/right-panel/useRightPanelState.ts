import { useCallback, useMemo, useState } from 'react';
import type { InteractiveTableState } from '../../../../_components/output/InteractiveTableOutput';
import type { RightPanelProps, RightTab } from './types';
export function useRightPanelState(p: RightPanelProps) {
    const [activeTab, setActiveTab] = useState<RightTab>('results');
    const nodesById = useMemo(() => new Map(p.selectedFlow.nodes.map((node) => [node.id, node])), [p.selectedFlow.nodes]);
    const inputDataframes = useMemo(() => !p.selectedNode ? [] : p.selectedFlow.edges.filter((edge) => edge.target === p.selectedNode!.id).map((edge) => {
        const source = nodesById.get(edge.source);
        const label = String(source?.data?.label || source?.data?.typeLabel || edge.source);
        return { value: edge.source, label: `${label} · ${String(edge.sourceHandle || 'dataframe')}` };
    }), [nodesById, p.selectedFlow.edges, p.selectedNode]);
    const openTab = useCallback((tab: RightTab) => { setActiveTab(tab); p.setResultsCollapsed(false); }, [p.setResultsCollapsed]);
    const updateInteractiveTable = useCallback((nodeId: string, state: InteractiveTableState) => {
        if (p.readOnly)
            return;
        const target = nodesById.get(nodeId);
        const params = (target?.data?.params || {}) as Record<string, unknown>;
        p.updateNodeParams(nodeId, { ...params, table_state: state });
    }, [nodesById, p.readOnly, p.updateNodeParams]);
    return { activeTab, openTab, inputDataframes, updateInteractiveTable };
}
