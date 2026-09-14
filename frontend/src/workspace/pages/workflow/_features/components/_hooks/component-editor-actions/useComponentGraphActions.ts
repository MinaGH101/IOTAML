import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { expandComponentGraph, upgradeComponentGraph } from '../../_model/componentGraph';
import type { UseComponentEditorOptions } from '../../_model/componentEditorTypes';
import type { ComponentEditorLocalState } from '../useComponentEditorState';
export function useComponentGraphActions(o: UseComponentEditorOptions, s: ComponentEditorLocalState, restore: (id: string | null) => void) { const ungroup = useCallback((node: Node) => { if (o.readOnly || s.editor)
    return; const expanded = expandComponentGraph({ nodes: o.nodes, edges: o.edges, componentNode: node, nonce: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}` }); if (!expanded.ok) {
    o.setMessage(expanded.reason === 'missing_snapshot' ? 'این نود یک کامپوننت قابل بازگردانی نیست.' : 'گراف داخلی کامپوننت خالی است.');
    return;
} o.setNodes(expanded.nodes); o.setEdges(expanded.edges); o.setSelectedId(expanded.expandedIds[0] || null); o.setSelectedIds(expanded.expandedIds); o.setSelectedEdgeId(null); o.setSelectedEdgeIds([]); o.setModalNodeId(null); s.setConfirmUngroup(null); o.setMessage(`کامپوننت «${String(node.data?.label || node.data?.typeLabel || '')}» فقط در این جریان به نودهای اصلی بازگردانده شد. نسخه کتابخانه بدون تغییر باقی ماند.`); window.setTimeout(() => o.fitView({ nodes: expanded.expandedNodes, padding: .2, duration: 300 }), 40); }, [o.edges, o.fitView, o.nodes, o.readOnly, o.setEdges, o.setMessage, o.setModalNodeId, o.setNodes, o.setSelectedEdgeId, o.setSelectedEdgeIds, o.setSelectedId, o.setSelectedIds, s.editor, s.setConfirmUngroup]); const confirmUpgradeInstance = useCallback(() => { if (!s.editor?.sourceNodeId || !s.pendingUpgrade)
    return; const upgraded = upgradeComponentGraph({ sourceNodeId: s.editor.sourceNodeId, parentNodes: s.editor.parentNodes, parentEdges: s.editor.parentEdges, component: s.pendingUpgrade.component, version: s.pendingUpgrade.version, registryNode: s.pendingUpgrade.registryNode }); if (!upgraded.ok) {
    o.setMessage('ارتقا انجام نشد: نسخه جدید بعضی پورت‌های متصل این نمونه را ندارد. ابتدا رابط عمومی را سازگار کنید.');
    s.setPendingUpgrade(null);
    return;
} const id = s.editor.sourceNodeId; const version = s.pendingUpgrade.version.semantic_version; o.setNodes(upgraded.nodes); o.setEdges(upgraded.edges); s.setEditor(null); s.setPendingUpgrade(null); restore(id); o.setMessage(`نمونه کامپوننت به نسخه ${version} ارتقا یافت.`); window.setTimeout(() => o.fitView({ padding: .1, duration: 260 }), 40); }, [o.fitView, o.setEdges, o.setMessage, o.setNodes, restore, s.editor, s.pendingUpgrade, s.setEditor, s.setPendingUpgrade]); return { ungroup, confirmUpgradeInstance }; }
