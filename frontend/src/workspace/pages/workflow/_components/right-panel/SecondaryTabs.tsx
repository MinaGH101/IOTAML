import { AssistantPanel } from '../../../../_components/AssistantPanel';
import { ComponentLibraryPanel } from '../../../../_components/ComponentLibraryPanel';
import { RunHistoryPanel } from '../RunHistoryPanel';
import { WorkflowVersionsPanel } from '../WorkflowVersionsPanel';
import type { RightPanelProps, RightTab } from './types';
export function SecondaryTabs({ tab, p }: {
    tab: RightTab;
    p: RightPanelProps;
}) {
    if (tab === 'history')
        return <div className="workflow-right-tab-body workflow-history-tab"><RunHistoryPanel runs={p.runHistory} currentRunId={p.currentRun?.id} busy={p.busy} onSelect={(run) => { void p.selectHistoricalRun(run); }} onRetry={p.retryRun} onCancel={p.cancelRun} onRefresh={() => p.refreshRunHistory().catch(() => undefined)}/></div>;
    if (tab === 'assistant')
        return <div className="workflow-right-tab-body workflow-assistant-tab"><AssistantPanel workflowId={p.workflowId}/></div>;
    if (tab === 'versions')
        return <div className="workflow-right-tab-body workflow-versions-tab"><WorkflowVersionsPanel versions={p.workflowVersions} workflowId={p.workflowId} selectedVersionId={p.selectedVersionId} previewActive={p.versionPreviewActive} busy={p.busy} onSelect={p.onSelectVersion} onRestore={p.onRestoreVersion} onDelete={p.onDeleteVersion} onRefresh={p.onRefreshVersions} onReturnToCurrent={p.onReturnToCurrentVersion}/></div>;
    if (tab === 'components')
        return <div className="workflow-right-tab-body workflow-components-tab"><ComponentLibraryPanel components={p.components} busy={p.busy} onRefresh={p.onRefreshComponents} onEdit={p.onEditComponent} onManageVersions={p.onManageComponentVersions} onExport={p.onExportComponent} onArchive={p.onArchiveComponent} onDelete={p.onDeleteComponent} onImport={p.onImportComponent}/></div>;
    return null;
}
