import { useCallback } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { ComponentDefinitionDraft } from '../../../../../../../shared/types';
import { analyzeComponentBoundary } from '../../../../../../_model/componentBoundary';
import { makeNode } from '../../../../../../_model/graph';
import { groupComponentGraph } from '../../_model/componentGraph';
import type { UseComponentEditorOptions } from '../../_model/componentEditorTypes';
import type { ComponentEditorLocalState } from '../useComponentEditorState';
export function useCreateComponent(o: UseComponentEditorOptions, s: ComponentEditorLocalState, restore: (id: string | null) => void) { const selectedBoundary = useCallback(() => analyzeComponentBoundary(o.nodes, o.edges, o.selectedIds), [o.edges, o.nodes, o.selectedIds]); const openCreateDialog = useCallback(() => { if (o.readOnly || s.editor)
    return; const selected = selectedBoundary(); if (!selected)
    return o.setMessage('برای ساخت کامپوننت حداقل دو نود را انتخاب کنید.'); if (selected.disconnected)
    return o.setMessage('نودهای انتخاب‌شده باید در یک گروه متصل باشند. گروه‌های جدا را به‌صورت کامپوننت‌های مستقل بسازید.'); s.setBoundary({ inputs: selected.inputs, outputs: selected.outputs }); s.setCreateDialogOpen(true); }, [o.readOnly, o.setMessage, s.editor, s.setBoundary, s.setCreateDialogOpen, selectedBoundary]); const createFromSelection = useCallback(async (draft: ComponentDefinitionDraft) => { const selected = selectedBoundary(); if (!selected || selected.disconnected)
    return; o.setBusy(true); try {
    const minX = Math.min(...selected.selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selected.selectedNodes.map((n) => n.position.y));
    const internalNodes = selected.selectedNodes.map((n) => ({ ...n, selected: false, position: { x: n.position.x - minX + 80, y: n.position.y - minY + 80 } }));
    const internalEdges = selected.internalEdges.map((e) => ({ ...e, selected: false }));
    const component = await componentsApi.create({ name: draft.name, description: draft.description, category: 'Components', icon: 'workflow', visibility: draft.visibility, project_id: draft.visibility === 'project' ? o.projectId : null, semantic_version: draft.semanticVersion, graph: { nodes: internalNodes, edges: internalEdges, meta: {} }, interface: { inputs: draft.inputs, outputs: draft.outputs }, exposed_parameters: draft.exposedParameters, changelog: 'Initial component' });
    const registryNode = await componentsApi.registry(component.id, o.projectId);
    const centerX = selected.selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selected.selectedNodes.length;
    const centerY = selected.selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selected.selectedNodes.length;
    const componentNode = makeNode(registryNode, o.nodes.length, { x: centerX, y: centerY });
    componentNode.data = { ...componentNode.data, label: component.name, typeLabel: component.name };
    const grouped = groupComponentGraph({ nodes: o.nodes, edges: o.edges, boundary: selected, draft, componentNode });
    o.setNodes(grouped.nodes);
    o.setEdges(grouped.edges);
    restore(grouped.componentNode.id);
    s.setCreateDialogOpen(false);
    await Promise.all([o.refreshComponents(), o.refreshRegistry()]);
    o.setMessage(`کامپوننت «${component.name}» ساخته شد و در کتابخانه قرار گرفت.`);
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'ساخت کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [o.edges, o.nodes, o.projectId, o.refreshComponents, o.refreshRegistry, o.setBusy, o.setEdges, o.setMessage, o.setNodes, restore, s.setCreateDialogOpen, selectedBoundary]); return { openCreateDialog, createFromSelection }; }
