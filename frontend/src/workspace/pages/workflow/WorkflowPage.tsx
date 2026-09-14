import { ReactFlowProvider } from '@xyflow/react';
import { AppErrorBoundary } from '../../../app/error-boundary/AppErrorBoundary';
import { WorkflowEditor, type WorkflowPageProps } from './WorkflowEditor';
export function WorkflowPage(props: WorkflowPageProps) {
    return (<AppErrorBoundary scope="workflow-canvas">
      <ReactFlowProvider>
        <WorkflowEditor {...props}/>
      </ReactFlowProvider>
    </AppErrorBoundary>);
}
