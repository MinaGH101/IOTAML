import { NodeMenu } from './NodeMenu';
import { WorkflowNodesList } from './WorkflowNodesList';
import type { WorkflowStageProps } from './workflowStageTypes';
export function WorkflowLeftSidebar(p: WorkflowStageProps) {
    return p.analysisBoardOpen
        ? <WorkflowNodesList nodes={p.graph.nodes} selectedId={p.graph.selectedId} collapsed={p.paletteCollapsed} floatingLeftStyle={p.layout.floatingLeftStyle} onSelectNode={p.canvas.selectWorkflowNode} onClose={() => p.setPaletteCollapsed(true)}/>
        : <NodeMenu registry={p.catalog.nodes} paletteCollapsed={p.paletteCollapsed} setPaletteCollapsed={p.setPaletteCollapsed} floatingLeftStyle={p.layout.floatingLeftStyle} onCreateCustomNode={p.onCreateCustomNode} onEditCustomNode={p.onEditCustomNode}/>;
}
