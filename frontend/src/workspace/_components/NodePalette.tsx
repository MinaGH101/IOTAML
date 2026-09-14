import { useMemo, useState } from 'react';
import type { RegistryNode } from '../../shared/types';
import { CollapsedPalette } from './node-palette/CollapsedPalette';
import { ExpandedPalette } from './node-palette/ExpandedPalette';
import { categoryOrder } from './node-palette/config';
export { categoryClassName, categoryIcon, categoryLabel, categoryOrder, nodeIcon } from './node-palette/config';
type Props = {
    nodes: RegistryNode[];
    collapsed: boolean;
    onToggle: () => void;
    onCreateCustomNode?: () => void;
    onEditCustomNode?: (node: RegistryNode) => void;
};
export function NodePalette({ nodes, collapsed, onCreateCustomNode, onEditCustomNode }: Props) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [flyout, setFlyout] = useState<string | null>(null);
    const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return nodes.filter((n) => !q || `${n.label} ${n.category} ${n.description} ${n.id}`.toLowerCase().includes(q)); }, [nodes, search]);
    const grouped = useMemo(() => { const map = new Map<string, RegistryNode[]>(); categoryOrder.forEach((c) => map.set(c, [])); filtered.forEach((n) => map.set(n.category, [...(map.get(n.category) || []), n])); return map; }, [filtered]);
    return collapsed ? <CollapsedPalette grouped={grouped} flyout={flyout} setFlyout={setFlyout} onCreate={onCreateCustomNode} onEdit={onEditCustomNode}/> : <ExpandedPalette nodes={nodes} grouped={grouped} search={search} setSearch={setSearch} open={open} setOpen={setOpen} onCreate={onCreateCustomNode} onEdit={onEditCustomNode}/>;
}
