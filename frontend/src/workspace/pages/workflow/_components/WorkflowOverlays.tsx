import { WorkflowVersionDialog } from '../../../_components/WorkflowVersionDialog';
import { BoardDialogs } from '../_features/boards/_components/BoardDialogs';
import { WorkflowComponentOverlays } from '../_features/components/_components/WorkflowComponentOverlays';
import { WorkflowNodeOverlays } from './WorkflowNodeOverlays';
import type { WorkflowOverlaysProps } from './workflowOverlayTypes';
export function WorkflowOverlays(p: WorkflowOverlaysProps) { const { runs } = p; return <><WorkflowNodeOverlays {...p} run={runs.displayRun}/><BoardDialogs activeBoard={p.boards.activeBoard} controller={p.boardDialogs}/><WorkflowVersionDialog open={p.document.versionDialogOpen} defaultName={`نسخه ${p.document.workflowVersions.length + 1}`} busy={p.document.versionBusy} onClose={() => p.document.setVersionDialogOpen(false)} onSave={(name, description) => { void p.document.saveVersion(name, description); }}/><WorkflowComponentOverlays controller={p.components} nodes={p.graph.nodes} registry={p.catalog.nodes} selectedCount={p.graph.selectedIds.length}/></>; }
