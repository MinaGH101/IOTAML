import { useCanvasConnections } from './workflow-canvas/useCanvasConnections';
import { useCanvasNodeActions } from './workflow-canvas/useCanvasNodeActions';
import { useCanvasRendering } from './workflow-canvas/useCanvasRendering';
import type { WorkflowCanvasOptions } from './workflow-canvas/types';
export function useWorkflowCanvasActions(options: WorkflowCanvasOptions) {
    const connections = useCanvasConnections(options);
    const actions = useCanvasNodeActions(options);
    const flowNodes = useCanvasRendering(options.nodes, options.currentRun, actions.renameNode);
    return { ...connections, ...actions, flowNodes };
}
