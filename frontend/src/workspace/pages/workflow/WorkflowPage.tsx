import '@xyflow/react/dist/style.css';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type SetStateAction,
} from 'react';
import {
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type {
  NodeCatalogResponse,
  Project,
  UserProfile,
  WorkflowVersion,
} from '../../../shared/_types';
import { normalizeOutputs } from '../../_components/ResultsPanel';
import { useWorkflowLayout } from '../../_hooks/useWorkflowLayout';
import { MAIN_ANALYSIS_BOARD_ID } from '../../_model/graph';
import { initialWorkflowViewState, workflowViewReducer } from '../../_model/viewState';
import { workspaceApi } from '../../_service/workspaceApi';
import { useBoardDialogs } from './_features/boards/_hooks/useBoardDialogs';
import { useWorkflowComponents } from './_features/components/_hooks/useWorkflowComponents';
import { ComponentEditorBanner, WorkflowHeader } from './_components/WorkflowHeader';
import { WorkflowOverlays } from './_components/WorkflowOverlays';
import { WorkflowStage } from './_components/WorkflowStage';
import { useAnalysisBoards } from './_hooks/useAnalysisBoards';
import { useCustomNodes } from './_hooks/useCustomNodes';
import { useNodeColumnContext } from './_hooks/useNodeColumnContext';
import { useProjectDatasets } from './_hooks/useProjectDatasets';
import { terminalRunStatuses, useRunHistory } from './_hooks/useRunHistory';
import { useWorkflowCanvasActions } from './_hooks/useWorkflowCanvasActions';
import { useWorkflowDocument } from './_hooks/useWorkflowDocument';
import { useWorkflowExecution } from './_hooks/useWorkflowExecution';
import { useWorkflowGraph } from './_hooks/useWorkflowGraph';

type WorkflowPageProps = {
  project: Project;
  user: UserProfile;
  initialWorkflowId: number | null;
  onBack: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onProjects: () => void;
};

function WorkflowEditor({
  project,
  user,
  initialWorkflowId,
  onBack,
  onProfile,
  onLogout,
  onProjects,
}: WorkflowPageProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const projectId = project.id;
  const [catalog, setCatalog] = useState<NodeCatalogResponse>({
    version: 0,
    nodes: [],
    aliases: {},
    categories: [],
    compatiblePorts: {},
  });
  const registry = catalog.nodes;
  const [targetColumn, setTargetColumn] = useState('target');
  const [taskType, setTaskType] = useState('auto');
  const [message, setMessage] = useState('');
  const [resultsWidth, setResultsWidth] = useState(380);
  const [versionPreview, setVersionPreview] = useState<WorkflowVersion | null>(null);
  const [viewState, dispatchViewState] = useReducer(
    workflowViewReducer,
    initialWorkflowViewState,
  );
  const { paletteCollapsed, resultsCollapsed, analysisBoardOpen } = viewState;
  const setPaletteCollapsed = useCallback((value: SetStateAction<boolean>) => {
    dispatchViewState({ type: 'palette', value });
  }, []);
  const setResultsCollapsed = useCallback((value: SetStateAction<boolean>) => {
    dispatchViewState({ type: 'results', value });
  }, []);
  const setAnalysisBoardOpen = useCallback((value: SetStateAction<boolean>) => {
    dispatchViewState({ type: 'analysis-board', value });
  }, []);

  const graph = useWorkflowGraph({ readOnly: Boolean(versionPreview) });
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    nodesById,
    selectedNode,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    modalNodeId,
    setModalNodeId,
    clearSelection,
    selectNode,
  } = graph;

  const {
    datasets,
    datasetId,
    setDatasetId,
    refreshDatasets,
  } = useProjectDatasets({ projectId, setNodes, setMessage });
  const runs = useRunHistory({ projectId, setMessage });
  const {
    currentRun,
    setCurrentRun,
    workflowLastRunId,
    setWorkflowLastRunId,
    runHistory,
    setRunHistory,
    busy,
    setBusy,
    lastRunSignature,
    setLastRunSignature,
    refreshRunHistory,
    recordRun,
    retryRun: retryRunWithSignature,
    cancelRun,
    selectHistoricalRun,
  } = runs;
  const allRunOutputs = useMemo(
    () => normalizeOutputs(currentRun, null),
    [currentRun],
  );

  const boards = useAnalysisBoards({
    outputs: allRunOutputs,
    currentRunId: currentRun?.id ?? null,
    nodes,
    selectedNodeId: selectedId,
    readOnly: Boolean(versionPreview),
    boardOpen: analysisBoardOpen,
    setBoardOpen: setAnalysisBoardOpen,
    setMessage,
  });
  const {
    activeBoard,
    activeBoardId,
    restoreBoards,
    renameBoard: renameAnalysisBoard,
    removeBoard: removeAnalysisBoard,
    renameNodeSources,
    serializedBoards: serializedAnalysisBoards,
    persistenceSignature: analysisBoardSignature,
  } = boards;

  const refreshRegistry = useCallback(async () => {
    setCatalog(await workspaceApi.nodeCatalog());
  }, []);
  const components = useWorkflowComponents({
    projectId,
    user,
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
    aliases: catalog.aliases,
    readOnly: Boolean(versionPreview),
    fitView,
    setBoardOpen: setAnalysisBoardOpen,
    setMessage,
    refreshRegistry,
  });

  const document = useWorkflowDocument({
    projectId,
    initialWorkflowId,
    catalog,
    setCatalog,
    nodes,
    setNodes,
    edges,
    setEdges,
    clearSelection,
    datasetId,
    setDatasetId,
    refreshDatasets,
    targetColumn,
    setTargetColumn,
    taskType,
    setTaskType,
    serializedBoards: serializedAnalysisBoards,
    analysisBoardSignature,
    activeBoardId,
    restoreBoards,
    setBoardOpen: setAnalysisBoardOpen,
    workflowLastRunId,
    setWorkflowLastRunId,
    setCurrentRun,
    setRunHistory,
    setLastRunSignature,
    setComponentItems: components.setItems,
    autosavePaused: Boolean(components.editor),
    versionPreview,
    setVersionPreview,
    setMessage,
  });

  const customNodes = useCustomNodes({ refreshRegistry, setMessage });
  const {
    availableColumns,
    availableIdColumns,
    inheritedIdColumn,
    availableRows,
  } = useNodeColumnContext({
    nodes,
    edges,
    nodesById,
    datasets,
    datasetId,
    aliases: catalog.aliases,
    selectedNodeId: selectedId,
    modalNodeId,
    outputs: allRunOutputs,
  });
  const boardDialogs = useBoardDialogs({
    activeBoard,
    readOnly: Boolean(versionPreview),
    renameBoard: renameAnalysisBoard,
    removeBoard: removeAnalysisBoard,
  });
  const canvas = useWorkflowCanvasActions({
    nodes,
    setNodes,
    edges,
    setEdges,
    registry,
    catalog,
    readOnly: Boolean(versionPreview),
    currentRun,
    resultsWidth,
    paletteCollapsed,
    resultsCollapsed,
    screenToFlowPosition,
    fitView,
    setMessage,
    setResultsCollapsed,
    setSelectedId,
    setSelectedIds,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    setModalNodeId,
    selectNode,
    enterComponentNode: components.enterNode,
    renameNodeSources,
  });
  const execution = useWorkflowExecution({
    nodes,
    edges,
    selectedId,
    setSelectedId,
    setSelectedIds,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    versionPreviewActive: Boolean(versionPreview),
    componentEditorActive: Boolean(components.editor),
    workflowName: document.workflowName,
    datasetId,
    projectId,
    targetColumn,
    taskType,
    autosaveSnapshot: document.autosaveSnapshot,
    autosaveSignature: document.autosaveSignature,
    currentOutputSignature: document.currentOutputSignature,
    persistSnapshot: document.persistSnapshot,
    setBusy,
    setLastRunSignature,
    recordRun,
    retryRunWithSignature,
    setMessage,
  });
  const layout = useWorkflowLayout(
    paletteCollapsed,
    resultsCollapsed,
    resultsWidth,
    setResultsWidth,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        setAnalysisBoardOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setAnalysisBoardOpen]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)');
    const collapseFloatingPanels = () => {
      if (!mobile.matches) return;
      setPaletteCollapsed(true);
      setResultsCollapsed(true);
    };
    collapseFloatingPanels();
    mobile.addEventListener('change', collapseFloatingPanels);
    return () => mobile.removeEventListener('change', collapseFloatingPanels);
  }, [setPaletteCollapsed, setResultsCollapsed]);

  const workflowDirtyForBoard = Boolean(
    currentRun
    && lastRunSignature
    && document.currentOutputSignature !== lastRunSignature
  );
  const refreshVersionsForPanel = useCallback(() => {
    void document.refreshWorkflowVersions().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌ها ناموفق بود');
    });
  }, [document.refreshWorkflowVersions]);
  const refreshComponentsForPanel = useCallback(() => {
    void components.refresh().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'دریافت کامپوننت‌ها ناموفق بود');
    });
  }, [components.refresh]);

  return (
    <div className="app-shell workflow-shell-page" style={layout.appStyle}>
      <WorkflowHeader
        floatingTopbarStyle={layout.floatingTopbarStyle}
        topbarLeftStyle={layout.topbarLeftStyle}
        topbarCenterStyle={layout.topbarCenterStyle}
        topbarRightStyle={layout.topbarRightStyle}
        onLogout={onLogout}
        onProfile={onProfile}
        onProjects={onProjects}
        onCancelRun={() => { if (currentRun) void cancelRun(currentRun); }}
        runActive={Boolean(currentRun && !terminalRunStatuses.has(currentRun.status))}
        onExport={document.exportCurrent}
        onLayout={canvas.prettyLayout}
        onCreateComponent={components.openCreateDialog}
        createComponentDisabled={Boolean(versionPreview) || Boolean(components.editor) || selectedIds.length < 2}
        readOnly={Boolean(versionPreview)}
        runDisabled={busy || document.versionBusy || Boolean(versionPreview) || Boolean(components.editor) || nodes.length === 0}
        runSelectedNode={Boolean(selectedNode)}
        runBusy={busy}
        onRun={execution.runWorkflow}
        boardOpen={analysisBoardOpen}
        onToggleBoard={() => setAnalysisBoardOpen((value) => !value)}
        saveDisabled={document.versionBusy || Boolean(versionPreview) || Boolean(components.editor)}
        versionBusy={document.versionBusy}
        onSaveVersion={() => document.setVersionDialogOpen(true)}
        onRenameBoard={boardDialogs.openRename}
        onDeleteBoard={() => boardDialogs.setDeleteOpen(true)}
        activeBoardIsMain={activeBoard?.id === MAIN_ANALYSIS_BOARD_ID}
        autosaveState={document.autosaveState}
        autosaveUpdatedAt={document.autosaveUpdatedAt}
        autosaveLabel={document.autosaveLabel}
        projectName={project.name}
        workflowName={document.workflowName}
        onProject={onBack}
      />

      {components.editor && (
        <ComponentEditorBanner
          workflowName={document.workflowName}
          componentName={components.editor.component.name}
          semanticVersion={components.editor.version.semantic_version}
          dirty={components.editorDirty}
          busy={components.busy}
          onEditDefinition={() => components.setDefinitionDialogOpen(true)}
          onLeave={components.requestLeaveEditor}
          onSaveVersion={() => components.setVersionDialogOpen(true)}
        />
      )}

      <WorkflowStage
        layout={layout}
        graph={graph}
        boards={boards}
        runs={runs}
        canvas={canvas}
        document={document}
        execution={execution}
        components={components}
        catalog={catalog}
        datasets={datasets}
        columns={{
          availableColumns,
          availableIdColumns,
          inheritedIdColumn,
          availableRows,
        }}
        message={message}
        paletteCollapsed={paletteCollapsed}
        resultsCollapsed={resultsCollapsed}
        analysisBoardOpen={analysisBoardOpen}
        setPaletteCollapsed={setPaletteCollapsed}
        setResultsCollapsed={setResultsCollapsed}
        workflowDirtyForBoard={workflowDirtyForBoard}
        readOnly={Boolean(versionPreview)}
        onCreateCustomNode={customNodes.openBuilder}
        onEditCustomNode={customNodes.editNode}
        onRefreshVersions={refreshVersionsForPanel}
        onRefreshComponents={refreshComponentsForPanel}
      />
      <WorkflowOverlays
        graph={graph}
        boards={boards}
        runs={runs}
        canvas={canvas}
        execution={execution}
        document={document}
        components={components}
        customNodes={customNodes}
        boardDialogs={boardDialogs}
        datasets={datasets}
        catalog={catalog}
        columns={{
          availableColumns,
          availableIdColumns,
          inheritedIdColumn,
          availableRows,
        }}
        versionPreview={versionPreview}
      />
    </div>
  );
}

export function WorkflowPage(props: WorkflowPageProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditor {...props} />
    </ReactFlowProvider>
  );
}
