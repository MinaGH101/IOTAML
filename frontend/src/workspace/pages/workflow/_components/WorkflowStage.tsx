import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowLeftSidebar } from './WorkflowLeftSidebar';
import { WorkflowRightSidebar } from './WorkflowRightSidebar';
import { useBoardCaseFilters } from '../../board/_hooks/useBoardCaseFilters';
import type { WorkflowStageProps } from './workflowStageTypes';
export function WorkflowStage(props: WorkflowStageProps) {
    const { runs } = props;
    const caseExtractNodeIds = new Set(props.graph.nodes.filter((node) => (node.data as { registryId?: string } | undefined)?.registryId === 'RV-003').map((node) => node.id));
    const boardItems = props.boards.activeBoard?.items || [];
    const hasBoardCaseResults = boardItems.some((item) => (item.nodeId && caseExtractNodeIds.has(item.nodeId)) || ['review_form', 'review_stage', 'review_score', 'review_batch', 'work_task_result'].includes(item.outputKind));
    const boardCaseFilters = useBoardCaseFilters({ projectId: props.projectId, active: props.analysisBoardOpen, available: hasBoardCaseResults });
    return <main className={`workspace ${props.paletteCollapsed ? 'palette-collapsed' : ''} ${props.resultsCollapsed ? 'results-collapsed' : ''} ${props.components.editor ? 'component-editor-active' : ''}`} style={props.layout.floatingWorkspaceStyle}>
    <WorkflowLeftSidebar {...props}/>
    <WorkflowCanvas {...props} run={runs.displayRun} boardCaseFilters={boardCaseFilters}/>
    <WorkflowRightSidebar {...props} resultRun={runs.displayRun} boardCaseFilters={boardCaseFilters}/>
  </main>;
}
