import { MAIN_ANALYSIS_BOARD_ID } from '../../../_model/graph';
import { terminalRunStatuses } from '../_hooks/useRunHistory';
import { ComponentEditorBanner, WorkflowHeader } from '../_components/WorkflowHeader';
import type { WorkflowPageProps } from './types';
import type { WorkflowEditorBase } from './useWorkflowEditorBase';
import type { WorkflowEditorDocument } from './useWorkflowEditorDocument';
import type { WorkflowEditorRuntime } from './useWorkflowEditorRuntime';
export function WorkflowEditorHeader({ props, base, data, runtime }: {
    props: WorkflowPageProps;
    base: WorkflowEditorBase;
    data: WorkflowEditorDocument;
    runtime: WorkflowEditorRuntime;
}) {
    const { project, user, onBack, onProfile, onAdmin, onLogout, onProjects } = props;
    const { runs, shell, graph } = base;
    return <>
    <WorkflowHeader floatingTopbarStyle={runtime.layout.floatingTopbarStyle} topbarLeftStyle={runtime.layout.topbarLeftStyle} topbarCenterStyle={runtime.layout.topbarCenterStyle} topbarRightStyle={runtime.layout.topbarRightStyle} onLogout={onLogout} onProfile={onProfile} onAdmin={onAdmin} showAdmin={user.role === 'admin'} onProjects={onProjects} onCancelRun={() => { if (runs.currentRun)
        void runs.cancelRun(runs.currentRun); }} runActive={Boolean(runs.currentRun && !terminalRunStatuses.has(runs.currentRun.status))} onExport={data.document.exportCurrent} onLayout={runtime.canvas.prettyLayout} onCreateComponent={data.components.openCreateDialog} createComponentDisabled={base.readOnly || Boolean(data.components.editor) || graph.selectedIds.length < 2} readOnly={base.readOnly} runDisabled={runs.busy || data.document.versionBusy || base.readOnly || Boolean(data.components.editor) || graph.nodes.length === 0} runSelectedNode={Boolean(graph.selectedNode)} runBusy={runs.busy} onRun={runtime.execution.runWorkflow} boardOpen={shell.analysisBoardOpen} onToggleBoard={() => shell.setAnalysisBoardOpen((value) => !value)} saveDisabled={data.document.versionBusy || base.readOnly || Boolean(data.components.editor)} versionBusy={data.document.versionBusy} onSaveVersion={() => data.document.setVersionDialogOpen(true)} onRenameBoard={runtime.boardDialogs.openRename} onDeleteBoard={() => runtime.boardDialogs.setDeleteOpen(true)} activeBoardIsMain={data.boards.activeBoard?.id === MAIN_ANALYSIS_BOARD_ID} autosaveState={data.document.autosaveState} autosaveUpdatedAt={data.document.autosaveUpdatedAt} autosaveLabel={data.document.autosaveLabel} projectName={project.name} workflowName={data.document.workflowName} onProject={onBack}/>
    {data.components.editor && <ComponentEditorBanner workflowName={data.document.workflowName} componentName={data.components.editor.component.name} semanticVersion={data.components.editor.version.semantic_version} dirty={data.components.editorDirty} busy={data.components.busy} onEditDefinition={() => data.components.setDefinitionDialogOpen(true)} onLeave={data.components.requestLeaveEditor} onSaveVersion={() => data.components.setVersionDialogOpen(true)}/>}
  </>;
}
