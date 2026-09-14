import { WorkflowOverlays } from '../_components/WorkflowOverlays';
import { WorkflowStage } from '../_components/WorkflowStage';
import type { WorkflowEditorBase } from './useWorkflowEditorBase';
import type { WorkflowEditorDocument } from './useWorkflowEditorDocument';
import type { WorkflowEditorRuntime } from './useWorkflowEditorRuntime';
export function WorkflowEditorBody({ base, data, runtime, effects }: {
    base: WorkflowEditorBase;
    data: WorkflowEditorDocument;
    runtime: WorkflowEditorRuntime;
    effects: {
        refreshVersions: () => void;
        refreshComponents: () => void;
        workflowDirtyForBoard: boolean;
    };
}) {
    const { graph, runs, shell } = base;
    return <>
    <WorkflowStage layout={runtime.layout} graph={graph} boards={data.boards} runs={runs} canvas={runtime.canvas} document={data.document} execution={runtime.execution} components={data.components} catalog={base.catalog} datasets={base.datasets.datasets} columns={runtime.columns} message={base.message} paletteCollapsed={shell.paletteCollapsed} resultsCollapsed={shell.resultsCollapsed} analysisBoardOpen={shell.analysisBoardOpen} workflowViewport={base.workflowCanvas.viewport} onWorkflowViewportChange={base.workflowCanvas.update} viewportStorageScope={base.viewportStorageScope} setPaletteCollapsed={shell.setPaletteCollapsed} setResultsCollapsed={shell.setResultsCollapsed} workflowDirtyForBoard={effects.workflowDirtyForBoard} readOnly={base.readOnly} onCreateCustomNode={runtime.customNodes.openBuilder} onEditCustomNode={runtime.customNodes.editNode} onRefreshVersions={effects.refreshVersions} onRefreshComponents={effects.refreshComponents}/>
    <WorkflowOverlays graph={graph} boards={data.boards} runs={runs} canvas={runtime.canvas} execution={runtime.execution} document={data.document} components={data.components} customNodes={runtime.customNodes} boardDialogs={runtime.boardDialogs} datasets={base.datasets.datasets} catalog={base.catalog} columns={runtime.columns} versionPreview={base.versionPreview}/>
  </>;
}
