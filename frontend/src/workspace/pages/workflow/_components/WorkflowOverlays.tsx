import type { NodeCatalogResponse, WorkflowVersion } from '../../../../shared/_types';
import { CustomNodeBuilder } from '../../../_components/CustomNodeBuilder';
import { NodeModal } from '../../../_components/NodeModal';
import { WorkflowVersionDialog } from '../../../_components/WorkflowVersionDialog';
import type { useProjectDatasets } from '../_hooks/useProjectDatasets';
import type { useRunHistory } from '../_hooks/useRunHistory';
import type { useWorkflowCanvasActions } from '../_hooks/useWorkflowCanvasActions';
import type { useWorkflowDocument } from '../_hooks/useWorkflowDocument';
import type { useWorkflowExecution } from '../_hooks/useWorkflowExecution';
import type { useWorkflowGraph } from '../_hooks/useWorkflowGraph';
import type { useCustomNodes } from '../_hooks/useCustomNodes';
import type { useAnalysisBoards } from '../_hooks/useAnalysisBoards';
import type { useBoardDialogs } from '../_features/boards/_hooks/useBoardDialogs';
import { BoardDialogs } from '../_features/boards/_components/BoardDialogs';
import type { WorkflowComponentsController } from '../_features/components/_hooks/useWorkflowComponents';
import { WorkflowComponentOverlays } from '../_features/components/_components/WorkflowComponentOverlays';

type ColumnContext = {
  availableColumns: string[];
  availableIdColumns: string[];
  inheritedIdColumn: string | null;
  availableRows: Array<Record<string, unknown>>;
};

export function WorkflowOverlays({
  graph,
  boards,
  runs,
  canvas,
  execution,
  document,
  components,
  customNodes,
  boardDialogs,
  datasets,
  catalog,
  columns,
  versionPreview,
}: {
  graph: ReturnType<typeof useWorkflowGraph>;
  boards: ReturnType<typeof useAnalysisBoards>;
  runs: ReturnType<typeof useRunHistory>;
  canvas: ReturnType<typeof useWorkflowCanvasActions>;
  execution: ReturnType<typeof useWorkflowExecution>;
  document: ReturnType<typeof useWorkflowDocument>;
  components: WorkflowComponentsController;
  customNodes: ReturnType<typeof useCustomNodes>;
  boardDialogs: ReturnType<typeof useBoardDialogs>;
  datasets: ReturnType<typeof useProjectDatasets>['datasets'];
  catalog: NodeCatalogResponse;
  columns: ColumnContext;
  versionPreview: WorkflowVersion | null;
}) {
  return (
    <>
      {graph.modalNode && !versionPreview && (
        <NodeModal
          node={graph.modalNode}
          workflowNodes={graph.nodes}
          edges={graph.edges}
          registry={catalog.nodes}
          aliases={catalog.aliases}
          portCompatibility={catalog.compatiblePorts}
          datasets={datasets}
          availableColumns={columns.availableColumns}
          availableIdColumns={columns.availableIdColumns}
          inheritedIdColumn={columns.inheritedIdColumn}
          availableRows={columns.availableRows}
          run={runs.currentRun}
          busy={runs.busy}
          onRunNode={() => execution.runGraphFromNode(graph.modalNode!.id)}
          onParamsChange={canvas.updateNodeParams}
          onRename={canvas.renameNode}
          onPinnedChange={canvas.updateNodePinned}
          onAddOutputToBoard={boards.addOutputToMainBoard}
          onInputSourceHandleChange={canvas.onInputSourceHandleChange}
          onClose={() => graph.setModalNodeId(null)}
        />
      )}
      {customNodes.open && (
        <CustomNodeBuilder
          definition={customNodes.definition}
          workflowNodes={graph.nodes}
          registry={catalog.nodes}
          busy={customNodes.busy}
          onSave={customNodes.saveNode}
          onDelete={customNodes.definition ? customNodes.deleteNode : undefined}
          onClose={customNodes.closeBuilder}
        />
      )}
      <BoardDialogs activeBoard={boards.activeBoard} controller={boardDialogs} />
      <WorkflowVersionDialog
        open={document.versionDialogOpen}
        defaultName={`نسخه ${document.workflowVersions.length + 1}`}
        busy={document.versionBusy}
        onClose={() => document.setVersionDialogOpen(false)}
        onSave={(name, description) => {
          void document.saveVersion(name, description);
        }}
      />
      <WorkflowComponentOverlays
        controller={components}
        nodes={graph.nodes}
        registry={catalog.nodes}
        selectedCount={graph.selectedIds.length}
      />
    </>
  );
}
