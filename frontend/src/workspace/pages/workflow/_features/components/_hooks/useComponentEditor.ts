import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Edge, Node } from '@xyflow/react';
import type {
  ComponentBoundaryPort,
  ComponentDefinitionDraft,
  ComponentVersion,
  RegistryNode,
  UserProfile,
  WorkflowComponent,
} from '../../../../../../shared/_types';
import { analyzeComponentBoundary } from '../../../../../_model/componentBoundary';
import { makeNode, normalizeFlowNodes } from '../../../../../_model/graph';
import { componentDraftSignature } from '../../../../../_model/runtimeContext';
import { workspaceApi } from '../../../../../_service/workspaceApi';
import {
  componentVersionFromSnapshot,
  expandComponentGraph,
  groupComponentGraph,
  upgradeComponentGraph,
} from '../_model/componentGraph';

export type ComponentEditorState = {
  component: WorkflowComponent;
  version: ComponentVersion;
  parentNodes: Node[];
  parentEdges: Edge[];
  sourceNodeId: string | null;
  baselineSignature: string;
};

type FitView = (options: {
  padding?: number;
  duration?: number;
  nodes?: Node[];
}) => unknown;

export function useComponentEditor({
  projectId,
  user,
  items,
  nodes,
  setNodes,
  edges,
  setEdges,
  selectedIds,
  setSelectedId,
  setSelectedIds,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  setModalNodeId,
  registry,
  aliases,
  readOnly,
  busy,
  setBusy,
  fitView,
  setBoardOpen,
  setMessage,
  refreshComponents,
  refreshRegistry,
}: {
  projectId: number;
  user: UserProfile;
  items: WorkflowComponent[];
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  selectedIds: string[];
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  setModalNodeId: Dispatch<SetStateAction<string | null>>;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  fitView: FitView;
  setBoardOpen: (open: boolean) => void;
  setMessage: (message: string) => void;
  refreshComponents: () => Promise<WorkflowComponent[]>;
  refreshRegistry: () => Promise<void>;
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [boundary, setBoundary] = useState<{
    inputs: ComponentBoundaryPort[];
    outputs: ComponentBoundaryPort[];
  }>({ inputs: [], outputs: [] });
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [editor, setEditor] = useState<ComponentEditorState | null>(null);
  const [confirmUngroup, setConfirmUngroup] = useState<Node | null>(null);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    component: WorkflowComponent;
    version: ComponentVersion;
    registryNode: RegistryNode;
  } | null>(null);
  const [confirmLeaveEditor, setConfirmLeaveEditor] = useState(false);

  const editorDirty = useMemo(
    () => Boolean(
      editor
      && componentDraftSignature(nodes, edges, editor.version) !== editor.baselineSignature
    ),
    [editor, edges, nodes],
  );
  const restoreSelection = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId);
    setSelectedIds(nodeId ? [nodeId] : []);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
  }, [setModalNodeId, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds]);

  const enterEditor = useCallback(async (
    component: WorkflowComponent,
    version: ComponentVersion,
    sourceNodeId: string | null = null,
  ) => {
    if (readOnly || editor) return;
    const graph = version.graph as unknown as { nodes?: Node[]; edges?: Edge[] };
    const editorNodes = normalizeFlowNodes(graph.nodes || [], registry, aliases);
    const editorEdges = (graph.edges || []).map((edge) => ({ ...edge, animated: true }));
    setEditor({
      component,
      version,
      parentNodes: nodes,
      parentEdges: edges,
      sourceNodeId,
      baselineSignature: componentDraftSignature(editorNodes, editorEdges, version),
    });
    setNodes(editorNodes);
    setEdges(editorEdges);
    restoreSelection(null);
    setBoardOpen(false);
    window.setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 40);
  }, [aliases, edges, editor, fitView, nodes, readOnly, registry, restoreSelection, setBoardOpen, setEdges, setNodes]);

  const enterNode = useCallback(async (node: Node) => {
    const snapshot = node.data?.componentSnapshot as Record<string, unknown> | undefined;
    if (!snapshot) return false;
    const componentId = Number(snapshot.component_id || node.data?.componentId || 0);
    const versionId = Number(snapshot.version_id || node.data?.componentVersionId || 0);
    try {
      const component = items.find((item) => item.id === componentId)
        || await workspaceApi.getComponent(componentId, projectId);
      const version = versionId
        ? await workspaceApi.getComponentVersion(componentId, versionId, projectId)
          .catch(() => componentVersionFromSnapshot(snapshot, user.username))
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
  }, [editor, fitView, restoreSelection, setEdges, setNodes]);

  const requestLeaveEditor = useCallback(() => {
    if (editorDirty) {
      setConfirmLeaveEditor(true);
      return;
    }
    leaveEditor();
  }, [editorDirty, leaveEditor]);
  const selectedBoundary = useCallback(
    () => analyzeComponentBoundary(nodes, edges, selectedIds),
    [edges, nodes, selectedIds],
  );
  const openCreateDialog = useCallback(() => {
    if (readOnly || editor) return;
    const selected = selectedBoundary();
    if (!selected) {
      setMessage('برای ساخت کامپوننت حداقل دو نود را انتخاب کنید.');
      return;
    }
    if (selected.disconnected) {
      setMessage('نودهای انتخاب‌شده باید در یک گروه متصل باشند. گروه‌های جدا را به‌صورت کامپوننت‌های مستقل بسازید.');
      return;
    }
    setBoundary({ inputs: selected.inputs, outputs: selected.outputs });
    setCreateDialogOpen(true);
  }, [editor, readOnly, selectedBoundary, setMessage]);

  const createFromSelection = useCallback(async (draft: ComponentDefinitionDraft) => {
    const selected = selectedBoundary();
    if (!selected || selected.disconnected) return;
    setBusy(true);
    try {
      const minX = Math.min(...selected.selectedNodes.map((node) => node.position.x));
      const minY = Math.min(...selected.selectedNodes.map((node) => node.position.y));
      const internalNodes = selected.selectedNodes.map((node) => ({
        ...node,
        selected: false,
        position: {
          x: node.position.x - minX + 80,
          y: node.position.y - minY + 80,
        },
      }));
      const internalEdges = selected.internalEdges.map((edge) => ({ ...edge, selected: false }));
      const component = await workspaceApi.createComponent({
        name: draft.name,
        description: draft.description,
        category: 'Components',
        icon: 'workflow',
        visibility: draft.visibility,
        project_id: draft.visibility === 'project' ? projectId : null,
        semantic_version: draft.semanticVersion,
        graph: { nodes: internalNodes, edges: internalEdges, meta: {} },
        interface: { inputs: draft.inputs, outputs: draft.outputs },
        exposed_parameters: draft.exposedParameters,
        changelog: 'Initial component',
      });
      const registryNode = await workspaceApi.componentRegistry(component.id, projectId);
      const centerX = selected.selectedNodes.reduce(
        (sum, node) => sum + node.position.x,
        0,
      ) / selected.selectedNodes.length;
      const centerY = selected.selectedNodes.reduce(
        (sum, node) => sum + node.position.y,
        0,
      ) / selected.selectedNodes.length;
      const componentNode = makeNode(
        registryNode,
        nodes.length,
        { x: centerX, y: centerY },
      );
      componentNode.data = {
        ...componentNode.data,
        label: component.name,
        typeLabel: component.name,
      };
      const grouped = groupComponentGraph({
        nodes,
        edges,
        boundary: selected,
        draft,
        componentNode,
      });
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
  }, [edges, nodes, projectId, refreshComponents, refreshRegistry, restoreSelection, selectedBoundary, setBusy, setEdges, setMessage, setNodes]);

  const ungroup = useCallback((componentNode: Node) => {
    if (readOnly || editor) return;
    const expanded = expandComponentGraph({
      nodes,
      edges,
      componentNode,
      nonce: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    });
    if (!expanded.ok) {
      setMessage(
        expanded.reason === 'missing_snapshot'
          ? 'این نود یک کامپوننت قابل بازگردانی نیست.'
          : 'گراف داخلی کامپوننت خالی است.',
      );
      return;
    }
    setNodes(expanded.nodes);
    setEdges(expanded.edges);
    setSelectedId(expanded.expandedIds[0] || null);
    setSelectedIds(expanded.expandedIds);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
    setConfirmUngroup(null);
    setMessage(`کامپوننت «${String(componentNode.data?.label || componentNode.data?.typeLabel || '')}» فقط در این جریان به نودهای اصلی بازگردانده شد. نسخه کتابخانه بدون تغییر باقی ماند.`);
    window.setTimeout(() => fitView({
      nodes: expanded.expandedNodes,
      padding: 0.2,
      duration: 300,
    }), 40);
  }, [edges, editor, fitView, nodes, readOnly, setEdges, setMessage, setModalNodeId, setNodes, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds]);

  const saveVersion = useCallback(async (semanticVersion: string, changelog: string) => {
    if (!editor) return;
    setBusy(true);
    try {
      const version = await workspaceApi.createComponentVersion(editor.component.id, {
        semantic_version: semanticVersion,
        graph: { nodes, edges, meta: {} },
        interface: editor.version.interface_json,
        exposed_parameters: editor.version.exposed_parameters,
        changelog,
      });
      const [updatedComponent, registryNode] = await Promise.all([
        workspaceApi.getComponent(editor.component.id, projectId),
        workspaceApi.componentRegistry(editor.component.id, projectId),
      ]);
      setEditor((current) => current ? {
        ...current,
        component: updatedComponent,
        version,
        baselineSignature: componentDraftSignature(nodes, edges, version),
      } : current);
      setVersionDialogOpen(false);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      if (editor.sourceNodeId) {
        setPendingUpgrade({ component: updatedComponent, version, registryNode });
        setMessage(`نسخه ${version.semantic_version} ذخیره شد. برای ارتقای این نمونه تأیید کنید.`);
      } else {
        setMessage(`نسخه ${version.semantic_version} ذخیره شد. جریان‌های موجود همچنان به نسخه قبلی متصل‌اند.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره نسخه کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [edges, editor, nodes, projectId, refreshComponents, refreshRegistry, setBusy, setMessage]);

  const applyDefinition = useCallback((value: {
    inputs: ComponentBoundaryPort[];
    outputs: ComponentBoundaryPort[];
    exposedParameters: ComponentVersion['exposed_parameters'];
  }) => {
    setEditor((current) => current ? {
      ...current,
      version: {
        ...current.version,
        interface_json: { inputs: value.inputs, outputs: value.outputs },
        exposed_parameters: value.exposedParameters,
      },
    } : current);
    setDefinitionDialogOpen(false);
    setMessage('رابط عمومی و پارامترها برای نسخه جدید آماده شد. برای ثبت، نسخه جدید ذخیره کنید.');
  }, [setMessage]);

  const confirmUpgradeInstance = useCallback(() => {
    if (!editor?.sourceNodeId || !pendingUpgrade) return;
    const upgraded = upgradeComponentGraph({
      sourceNodeId: editor.sourceNodeId,
      parentNodes: editor.parentNodes,
      parentEdges: editor.parentEdges,
      component: pendingUpgrade.component,
      version: pendingUpgrade.version,
      registryNode: pendingUpgrade.registryNode,
    });
    if (!upgraded.ok) {
      setMessage('ارتقا انجام نشد: نسخه جدید بعضی پورت‌های متصل این نمونه را ندارد. ابتدا رابط عمومی را سازگار کنید.');
      setPendingUpgrade(null);
      return;
    }
    const sourceNodeId = editor.sourceNodeId;
    const semanticVersion = pendingUpgrade.version.semantic_version;
    setNodes(upgraded.nodes);
    setEdges(upgraded.edges);
    setEditor(null);
    setPendingUpgrade(null);
    restoreSelection(sourceNodeId);
    setMessage(`نمونه کامپوننت به نسخه ${semanticVersion} ارتقا یافت.`);
    window.setTimeout(() => fitView({ padding: 0.1, duration: 260 }), 40);
  }, [editor, fitView, pendingUpgrade, restoreSelection, setEdges, setMessage, setNodes]);

  return {
    busy,
    createDialogOpen,
    setCreateDialogOpen,
    boundary,
    versionDialogOpen,
    setVersionDialogOpen,
    editor,
    editorDirty,
    confirmUngroup,
    setConfirmUngroup,
    definitionDialogOpen,
    setDefinitionDialogOpen,
    pendingUpgrade,
    setPendingUpgrade,
    confirmLeaveEditor,
    setConfirmLeaveEditor,
    enterEditor,
    enterNode,
    leaveEditor,
    requestLeaveEditor,
    openCreateDialog,
    createFromSelection,
    ungroup,
    saveVersion,
    applyDefinition,
    confirmUpgradeInstance,
  };
}

export type ComponentEditorController = ReturnType<typeof useComponentEditor>;
