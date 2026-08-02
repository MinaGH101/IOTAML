import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { ComponentBoundaryPort, ComponentDefinitionDraft, ComponentVersion } from '../../../../../../shared/_types';
import { analyzeComponentBoundary } from '../../../../../_model/componentBoundary';
import { makeNode } from '../../../../../_model/graph';
import { componentDraftSignature } from '../../../../../_model/runtimeContext';
import { workspaceApi } from '../../../../../_service/workspaceApi';
import { expandComponentGraph, groupComponentGraph, upgradeComponentGraph } from '../_model/componentGraph';
import type { UseComponentEditorOptions } from '../_model/componentEditorTypes';
import type { ComponentEditorLocalState } from './useComponentEditorState';

export function useComponentEditorActions(options: UseComponentEditorOptions, state: ComponentEditorLocalState, restoreSelection: (nodeId: string | null) => void) {
  const { projectId, nodes, edges, selectedIds, readOnly, fitView, setBusy, setEdges, setMessage, setModalNodeId, setNodes, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds, refreshComponents, refreshRegistry } = options;
  const { editor, pendingUpgrade, setBoundary, setConfirmUngroup, setCreateDialogOpen, setDefinitionDialogOpen, setEditor, setPendingUpgrade, setVersionDialogOpen } = state;

  const selectedBoundary = useCallback(() => analyzeComponentBoundary(nodes, edges, selectedIds), [edges, nodes, selectedIds]);

  const openCreateDialog = useCallback(() => {
    if (readOnly || editor) return;
    const selected = selectedBoundary();
    if (!selected) return setMessage('برای ساخت کامپوننت حداقل دو نود را انتخاب کنید.');
    if (selected.disconnected) return setMessage('نودهای انتخاب‌شده باید در یک گروه متصل باشند. گروه‌های جدا را به‌صورت کامپوننت‌های مستقل بسازید.');
    setBoundary({ inputs: selected.inputs, outputs: selected.outputs });
    setCreateDialogOpen(true);
  }, [editor, readOnly, selectedBoundary, setBoundary, setCreateDialogOpen, setMessage]);

  const createFromSelection = useCallback(async (draft: ComponentDefinitionDraft) => {
    const selected = selectedBoundary();
    if (!selected || selected.disconnected) return;
    setBusy(true);
    try {
      const minX = Math.min(...selected.selectedNodes.map((node) => node.position.x));
      const minY = Math.min(...selected.selectedNodes.map((node) => node.position.y));
      const internalNodes = selected.selectedNodes.map((node) => ({ ...node, selected: false, position: { x: node.position.x - minX + 80, y: node.position.y - minY + 80 } }));
      const internalEdges = selected.internalEdges.map((edge) => ({ ...edge, selected: false }));
      const component = await workspaceApi.createComponent({
        name: draft.name, description: draft.description, category: 'Components', icon: 'workflow', visibility: draft.visibility,
        project_id: draft.visibility === 'project' ? projectId : null,
        semantic_version: draft.semanticVersion,
        graph: { nodes: internalNodes, edges: internalEdges, meta: {} },
        interface: { inputs: draft.inputs, outputs: draft.outputs },
        exposed_parameters: draft.exposedParameters,
        changelog: 'Initial component',
      });
      const registryNode = await workspaceApi.componentRegistry(component.id, projectId);
      const centerX = selected.selectedNodes.reduce((sum, node) => sum + node.position.x, 0) / selected.selectedNodes.length;
      const centerY = selected.selectedNodes.reduce((sum, node) => sum + node.position.y, 0) / selected.selectedNodes.length;
      const componentNode = makeNode(registryNode, nodes.length, { x: centerX, y: centerY });
      componentNode.data = { ...componentNode.data, label: component.name, typeLabel: component.name };
      const grouped = groupComponentGraph({ nodes, edges, boundary: selected, draft, componentNode });
      setNodes(grouped.nodes);
      setEdges(grouped.edges);
      restoreSelection(grouped.componentNode.id);
      setCreateDialogOpen(false);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      setMessage(`کامپوننت «${component.name}» ساخته شد و در کتابخانه قرار گرفت.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ساخت کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [edges, nodes, projectId, refreshComponents, refreshRegistry, restoreSelection, selectedBoundary, setBusy, setCreateDialogOpen, setEdges, setMessage, setNodes]);

  const ungroup = useCallback((componentNode: Node) => {
    if (readOnly || editor) return;
    const expanded = expandComponentGraph({ nodes, edges, componentNode, nonce: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}` });
    if (!expanded.ok) {
      setMessage(expanded.reason === 'missing_snapshot' ? 'این نود یک کامپوننت قابل بازگردانی نیست.' : 'گراف داخلی کامپوننت خالی است.');
      return;
    }
    setNodes(expanded.nodes); setEdges(expanded.edges);
    setSelectedId(expanded.expandedIds[0] || null); setSelectedIds(expanded.expandedIds);
    setSelectedEdgeId(null); setSelectedEdgeIds([]); setModalNodeId(null); setConfirmUngroup(null);
    setMessage(`کامپوننت «${String(componentNode.data?.label || componentNode.data?.typeLabel || '')}» فقط در این جریان به نودهای اصلی بازگردانده شد. نسخه کتابخانه بدون تغییر باقی ماند.`);
    window.setTimeout(() => fitView({ nodes: expanded.expandedNodes, padding: 0.2, duration: 300 }), 40);
  }, [edges, editor, fitView, nodes, readOnly, setConfirmUngroup, setEdges, setMessage, setModalNodeId, setNodes, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds]);

  const saveVersion = useCallback(async (semanticVersion: string, changelog: string) => {
    if (!editor) return;
    setBusy(true);
    try {
      const version = await workspaceApi.createComponentVersion(editor.component.id, { semantic_version: semanticVersion, graph: { nodes, edges, meta: {} }, interface: editor.version.interface_json, exposed_parameters: editor.version.exposed_parameters, changelog });
      const [updatedComponent, registryNode] = await Promise.all([workspaceApi.getComponent(editor.component.id, projectId), workspaceApi.componentRegistry(editor.component.id, projectId)]);
      setEditor((current) => current ? { ...current, component: updatedComponent, version, baselineSignature: componentDraftSignature(nodes, edges, version) } : current);
      setVersionDialogOpen(false);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      if (editor.sourceNodeId) {
        setPendingUpgrade({ component: updatedComponent, version, registryNode });
        setMessage(`نسخه ${version.semantic_version} ذخیره شد. برای ارتقای این نمونه تأیید کنید.`);
      } else setMessage(`نسخه ${version.semantic_version} ذخیره شد. جریان‌های موجود همچنان به نسخه قبلی متصل‌اند.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره نسخه کامپوننت ناموفق بود');
    } finally { setBusy(false); }
  }, [edges, editor, nodes, projectId, refreshComponents, refreshRegistry, setBusy, setEditor, setMessage, setPendingUpgrade, setVersionDialogOpen]);

  const applyDefinition = useCallback((value: { inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[]; exposedParameters: ComponentVersion['exposed_parameters'] }) => {
    setEditor((current) => current ? { ...current, version: { ...current.version, interface_json: { inputs: value.inputs, outputs: value.outputs }, exposed_parameters: value.exposedParameters } } : current);
    setDefinitionDialogOpen(false);
    setMessage('رابط عمومی و پارامترها برای نسخه جدید آماده شد. برای ثبت، نسخه جدید ذخیره کنید.');
  }, [setDefinitionDialogOpen, setEditor, setMessage]);

  const confirmUpgradeInstance = useCallback(() => {
    if (!editor?.sourceNodeId || !pendingUpgrade) return;
    const upgraded = upgradeComponentGraph({ sourceNodeId: editor.sourceNodeId, parentNodes: editor.parentNodes, parentEdges: editor.parentEdges, component: pendingUpgrade.component, version: pendingUpgrade.version, registryNode: pendingUpgrade.registryNode });
    if (!upgraded.ok) {
      setMessage('ارتقا انجام نشد: نسخه جدید بعضی پورت‌های متصل این نمونه را ندارد. ابتدا رابط عمومی را سازگار کنید.');
      setPendingUpgrade(null); return;
    }
    const sourceNodeId = editor.sourceNodeId;
    const semanticVersion = pendingUpgrade.version.semantic_version;
    setNodes(upgraded.nodes); setEdges(upgraded.edges); setEditor(null); setPendingUpgrade(null);
    restoreSelection(sourceNodeId);
    setMessage(`نمونه کامپوننت به نسخه ${semanticVersion} ارتقا یافت.`);
    window.setTimeout(() => fitView({ padding: 0.1, duration: 260 }), 40);
  }, [editor, fitView, pendingUpgrade, restoreSelection, setEdges, setEditor, setMessage, setNodes, setPendingUpgrade]);

  return { openCreateDialog, createFromSelection, ungroup, saveVersion, applyDefinition, confirmUpgradeInstance };
}
