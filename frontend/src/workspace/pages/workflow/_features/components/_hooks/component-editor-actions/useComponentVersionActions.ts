import { useCallback } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { ComponentBoundaryPort, ComponentVersion } from '../../../../../../../shared/types';
import { componentDraftSignature } from '../../../../../../_model/runtimeContext';
import type { UseComponentEditorOptions } from '../../_model/componentEditorTypes';
import type { ComponentEditorLocalState } from '../useComponentEditorState';
export function useComponentVersionActions(o: UseComponentEditorOptions, s: ComponentEditorLocalState) { const saveVersion = useCallback(async (semanticVersion: string, changelog: string) => { if (!s.editor)
    return; o.setBusy(true); try {
    const version = await componentsApi.createVersion(s.editor.component.id, { semantic_version: semanticVersion, graph: { nodes: o.nodes, edges: o.edges, meta: {} }, interface: s.editor.version.interface_json, exposed_parameters: s.editor.version.exposed_parameters, changelog });
    const [component, registryNode] = await Promise.all([componentsApi.get(s.editor.component.id, o.projectId), componentsApi.registry(s.editor.component.id, o.projectId)]);
    s.setEditor((current) => current ? { ...current, component, version, baselineSignature: componentDraftSignature(o.nodes, o.edges, version) } : current);
    s.setVersionDialogOpen(false);
    await Promise.all([o.refreshComponents(), o.refreshRegistry()]);
    if (s.editor.sourceNodeId) {
        s.setPendingUpgrade({ component, version, registryNode });
        o.setMessage(`نسخه ${version.semantic_version} ذخیره شد. برای ارتقای این نمونه تأیید کنید.`);
    }
    else
        o.setMessage(`نسخه ${version.semantic_version} ذخیره شد. جریان‌های موجود همچنان به نسخه قبلی متصل‌اند.`);
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'ذخیره نسخه کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [o.edges, o.nodes, o.projectId, o.refreshComponents, o.refreshRegistry, o.setBusy, o.setMessage, s.editor, s.setEditor, s.setPendingUpgrade, s.setVersionDialogOpen]); const applyDefinition = useCallback((value: {
    inputs: ComponentBoundaryPort[];
    outputs: ComponentBoundaryPort[];
    exposedParameters: ComponentVersion['exposed_parameters'];
}) => { s.setEditor((current) => current ? { ...current, version: { ...current.version, interface_json: { inputs: value.inputs, outputs: value.outputs }, exposed_parameters: value.exposedParameters } } : current); s.setDefinitionDialogOpen(false); o.setMessage('رابط عمومی و پارامترها برای نسخه جدید آماده شد. برای ثبت، نسخه جدید ذخیره کنید.'); }, [o.setMessage, s.setDefinitionDialogOpen, s.setEditor]); return { saveVersion, applyDefinition }; }
