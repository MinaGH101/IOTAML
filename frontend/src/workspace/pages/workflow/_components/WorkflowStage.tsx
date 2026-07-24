import {
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react';
import type { SetStateAction } from 'react';
import type { Dataset, NodeCatalogResponse, RegistryNode } from '../../../../shared/_types';
import type { useWorkflowLayout } from '../../../_hooks/useWorkflowLayout';
import { MAIN_ANALYSIS_BOARD_ID } from '../../../_model/graph';
import { BoardPage } from '../../board/BoardPage';
import type { WorkflowComponentsController } from '../_features/components/_hooks/useWorkflowComponents';
import type { useAnalysisBoards } from '../_hooks/useAnalysisBoards';
import type { useRunHistory } from '../_hooks/useRunHistory';
import type { useWorkflowCanvasActions } from '../_hooks/useWorkflowCanvasActions';
import type { useWorkflowDocument } from '../_hooks/useWorkflowDocument';
import type { useWorkflowExecution } from '../_hooks/useWorkflowExecution';
import type { useWorkflowGraph } from '../_hooks/useWorkflowGraph';
import { NodeMenu } from './NodeMenu';
import { RightPanel } from './RightPanel';
import { WorkflowNodesList } from './WorkflowNodesList';
import { MlNode } from '../../../_components/nodes/MlNode';

const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];

type ColumnContext = {
  availableColumns: string[];
  availableIdColumns: string[];
  inheritedIdColumn: string | null;
  availableRows: Array<Record<string, unknown>>;
};

export function WorkflowStage({
  layout,
  graph,
  boards,
  runs,
  canvas,
  document,
  execution,
  components,
  catalog,
  datasets,
  columns,
  message,
  paletteCollapsed,
  resultsCollapsed,
  analysisBoardOpen,
  setPaletteCollapsed,
  setResultsCollapsed,
  workflowDirtyForBoard,
  readOnly,
  onCreateCustomNode,
  onEditCustomNode,
  onRefreshVersions,
  onRefreshComponents,
}: {
  layout: ReturnType<typeof useWorkflowLayout>;
  graph: ReturnType<typeof useWorkflowGraph>;
  boards: ReturnType<typeof useAnalysisBoards>;
  runs: ReturnType<typeof useRunHistory>;
  canvas: ReturnType<typeof useWorkflowCanvasActions>;
  document: ReturnType<typeof useWorkflowDocument>;
  execution: ReturnType<typeof useWorkflowExecution>;
  components: WorkflowComponentsController;
  catalog: NodeCatalogResponse;
  datasets: Dataset[];
  columns: ColumnContext;
  message: string;
  paletteCollapsed: boolean;
  resultsCollapsed: boolean;
  analysisBoardOpen: boolean;
  setPaletteCollapsed: (value: SetStateAction<boolean>) => void;
  setResultsCollapsed: (value: SetStateAction<boolean>) => void;
  workflowDirtyForBoard: boolean;
  readOnly: boolean;
  onCreateCustomNode: () => void;
  onEditCustomNode: (node: RegistryNode) => void;
  onRefreshVersions: () => void;
  onRefreshComponents: () => void;
}) {
  const activeBoard = boards.activeBoard;
  return (
    <main
      className={`workspace ${paletteCollapsed ? 'palette-collapsed' : ''} ${resultsCollapsed ? 'results-collapsed' : ''} ${components.editor ? 'component-editor-active' : ''}`}
      style={layout.floatingWorkspaceStyle}
    >
      {analysisBoardOpen ? (
        <WorkflowNodesList
          nodes={graph.nodes}
          selectedId={graph.selectedId}
          collapsed={paletteCollapsed}
          setCollapsed={setPaletteCollapsed}
          floatingLeftStyle={layout.floatingLeftStyle}
          onSelectNode={canvas.selectWorkflowNode}
        />
      ) : (
        <NodeMenu
          registry={catalog.nodes}
          paletteCollapsed={paletteCollapsed}
          setPaletteCollapsed={setPaletteCollapsed}
          floatingLeftStyle={layout.floatingLeftStyle}
          onCreateCustomNode={onCreateCustomNode}
          onEditCustomNode={onEditCustomNode}
        />
      )}

      <section
        className="board"
        onDrop={canvas.onDrop}
        onDragOver={canvas.onDragOver}
        style={layout.floatingBoardStyle}
      >
        {message && <div className="toast">{message}</div>}
        {!analysisBoardOpen && (
          <div className="workflow-flow-layer">
            <ReactFlow
              nodes={canvas.flowNodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onNodesChange={graph.onNodesChange}
              onEdgesChange={graph.onEdgesChange}
              onConnect={canvas.onConnect}
              onSelectionChange={graph.onSelectionChange}
              onNodeClick={graph.onNodeClick}
              onNodeDoubleClick={canvas.onNodeDoubleClick}
              onEdgeClick={graph.onEdgeClick}
              onPaneClick={graph.onPaneClick}
              nodesDraggable={!readOnly && !graph.ctrlSelectionActive}
              nodesConnectable={!readOnly}
              edgesReconnectable={!readOnly}
              selectionOnDrag={graph.ctrlSelectionActive}
              selectionKeyCode={null}
              multiSelectionKeyCode={multiSelectionKeys}
              panOnDrag={!graph.ctrlSelectionActive}
              className={graph.ctrlSelectionActive ? 'workflow-ctrl-selection-active' : ''}
              onlyRenderVisibleElements
              fitView
            >
              <Controls />
              <MiniMap
                className="workflow-minimap-visible"
                pannable
                zoomable
                style={{
                  left: paletteCollapsed ? 76 : 304,
                  right: 'auto',
                  bottom: 24,
                }}
              />
            </ReactFlow>
          </div>
        )}
        {analysisBoardOpen && (
          <div className="analysis-board-mount-layer">
            <BoardPage
              tabs={boards.boards}
              activeBoardId={boards.activeBoardId}
              items={activeBoard?.items || []}
              run={runs.currentRun}
              workflowDirty={workflowDirtyForBoard}
              onSelectBoard={boards.selectBoard}
              onCreateBoard={boards.createBoard}
              onUpdateItem={boards.updateItem}
              onRemoveItem={boards.removeItem}
              onDuplicateItem={boards.duplicateItem}
              onViewportChange={boards.updateViewport}
              readOnly={readOnly}
            />
          </div>
        )}
      </section>

      <RightPanel
        floatingRightStyle={layout.floatingRightStyle}
        resultsCollapsed={resultsCollapsed}
        setResultsCollapsed={setResultsCollapsed}
        startResize={layout.startResize}
        selectedFlow={graph.selectedFlow}
        runHistory={runs.runHistory}
        currentRun={runs.currentRun}
        busy={runs.busy}
        retryRun={execution.retryRun}
        cancelRun={runs.cancelRun}
        selectHistoricalRun={runs.selectHistoricalRun}
        refreshRunHistory={runs.refreshRunHistory}
        selectedNode={graph.selectedNode}
        selectedEdge={graph.selectedEdge}
        registry={catalog.nodes}
        aliases={catalog.aliases}
        datasets={datasets}
        availableColumns={columns.availableColumns}
        availableIdColumns={columns.availableIdColumns}
        inheritedIdColumn={columns.inheritedIdColumn}
        availableRows={columns.availableRows}
        updateNodeParams={canvas.updateNodeParams}
        renameNode={canvas.renameNode}
        deleteSelected={graph.deleteSelected}
        onUngroupComponent={components.setConfirmUngroup}
        selectedId={graph.selectedId}
        onAddOutputToBoard={boards.addOutputFromResults}
        analysisBoardOpen={analysisBoardOpen}
        boardTabs={boards.boards}
        boardTargetId={analysisBoardOpen ? boards.targetBoardId : MAIN_ANALYSIS_BOARD_ID}
        onBoardTargetChange={boards.selectBoard}
        workflowId={document.currentWorkflowId}
        workflowVersions={document.workflowVersions}
        selectedVersionId={document.selectedVersionId}
        versionPreviewActive={readOnly}
        onSelectVersion={document.viewVersion}
        onRestoreVersion={document.restoreVersion}
        onDeleteVersion={document.deleteVersion}
        onRefreshVersions={onRefreshVersions}
        onReturnToCurrentVersion={document.returnToCurrentVersion}
        components={components.items}
        onRefreshComponents={onRefreshComponents}
        onEditComponent={(component) => {
          if (component.current_version) {
            void components.enterEditor(component, component.current_version);
          }
        }}
        onManageComponentVersions={components.openVersionManager}
        onExportComponent={components.exportPackage}
        onArchiveComponent={components.archive}
        onDeleteComponent={components.setConfirmDelete}
        onImportComponent={components.importPackage}
        readOnly={readOnly}
      />
    </main>
  );
}
