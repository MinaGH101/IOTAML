import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowLeftSidebar } from './WorkflowLeftSidebar';
import { WorkflowRightSidebar } from './WorkflowRightSidebar';
import type { WorkflowStageProps } from './workflowStageTypes';
export function WorkflowStage(props: WorkflowStageProps) {
    const { runs } = props;
    return <main className={`workspace ${props.paletteCollapsed ? 'palette-collapsed' : ''} ${props.resultsCollapsed ? 'results-collapsed' : ''} ${props.components.editor ? 'component-editor-active' : ''}`} style={props.layout.floatingWorkspaceStyle}>
    <WorkflowLeftSidebar {...props}/>
    <WorkflowCanvas {...props} run={runs.displayRun}/>
    <WorkflowRightSidebar {...props} resultRun={runs.displayRun}/>
  </main>;
}
