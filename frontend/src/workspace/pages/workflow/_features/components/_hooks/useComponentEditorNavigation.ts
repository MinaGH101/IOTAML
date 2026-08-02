import { useCallback } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { ComponentVersion, WorkflowComponent } from '../../../../../../shared/_types';
import { normalizeFlowNodes } from '../../../../../_model/graph';
import { componentDraftSignature } from '../../../../../_model/runtimeContext';
import { workspaceApi } from '../../../../../_service/workspaceApi';
import { componentVersionFromSnapshot } from '../_model/componentGraph';
import type { UseComponentEditorOptions } from '../_model/componentEditorTypes';
import type { ComponentEditorLocalState } from './useComponentEditorState';

export function useComponentEditorNavigation(options: UseComponentEditorOptions, state: ComponentEditorLocalState) {
  const { items, projectId, user, nodes, edges, registry, aliases, readOnly, fitView, setBoardOpen, setEdges, setMessage, setModalNodeId, setNodes, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds } = options;
  const { editor, editorDirty, setEditor, setVersionDialogOpen, setDefinitionDialogOpen, setConfirmLeaveEditor } = state;

  const restoreSelection = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId);
    setSelectedIds(nodeId ? [nodeId] : []);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
  }, [setModalNodeId, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds]);

  const enterEditor = useCallback(async (component: WorkflowComponent, version: ComponentVersion, sourceNodeId: string | null = null) => {
    if (readOnly || editor) return;
    const graph = version.graph as unknown as { nodes?: Node[]; edges?: Edge[] };
    const editorNodes = normalizeFlowNodes(graph.nodes || [], registry, aliases);
    const editorEdges = (graph.edges || []).map((edge) => ({ ...edge, animated: true }));
    setEditor({ component, version, parentNodes: nodes, parentEdges: edges, sourceNodeId, baselineSignature: componentDraftSignature(editorNodes, editorEdges, version) });
    setNodes(editorNodes);
    setEdges(editorEdges);
    restoreSelection(null);
    setBoardOpen(false);
    window.setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 40);
  }, [aliases, edges, editor, fitView, nodes, readOnly, registry, restoreSelection, setBoardOpen, setEdges, setEditor, setNodes]);

  const enterNode = useCallback(async (node: Node) => {
    const snapshot = node.data?.componentSnapshot as Record<string, unknown> | undefined;
    if (!snapshot) return false;
    const componentId = Number(snapshot.component_id || node.data?.componentId || 0);
    const versionId = Number(snapshot.version_id || node.data?.componentVersionId || 0);
    try {
      const component = items.find((item) => item.id === componentId) || await workspaceApi.getComponent(componentId, projectId);
      const version = versionId
        ? await workspaceApi.getComponentVersion(componentId, versionId, projectId).catch(() => componentVersionFromSnapshot(snapshot, user.username))
        : componentVersionFromSnapshot(snapshot, user.username);
      await enterEditor(component, version, node.id);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'باز کردن کامپوننت ناموفق بود');
      return false;
    }
  }, [enterEditor, items, projectId, setMessage, user.username]);

  const leaveEditor = useCallback(() => {
    if (!editor) return;
    setNodes(editor.parentNodes);
    setEdges(editor.parentEdges);
    const sourceNodeId = editor.sourceNodeId;
    setEditor(null);
    setVersionDialogOpen(false);
    setDefinitionDialogOpen(false);
    setConfirmLeaveEditor(false);
    restoreSelection(sourceNodeId);
    window.setTimeout(() => fitView({ padding: 0.1, duration: 260 }), 40);
  }, [editor, fitView, restoreSelection, setConfirmLeaveEditor, setDefinitionDialogOpen, setEdges, setEditor, setNodes, setVersionDialogOpen]);

  const requestLeaveEditor = useCallback(() => {
    if (editorDirty) setConfirmLeaveEditor(true);
    else leaveEditor();
  }, [editorDirty, leaveEditor, setConfirmLeaveEditor]);

  return { restoreSelection, enterEditor, enterNode, leaveEditor, requestLeaveEditor };
}
