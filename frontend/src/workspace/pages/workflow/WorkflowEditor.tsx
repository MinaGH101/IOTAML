import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { normalizeOutputs } from '../../../features/results/components/ResultsPanel';
import { InteractiveTableRuntimeContext } from '../../_model/interactiveTableRuntime';
import { WorkflowEditorBody } from './_editor/WorkflowEditorBody';
import { WorkflowEditorHeader } from './_editor/WorkflowEditorHeader';
import type { WorkflowPageProps } from './_editor/types';
import { useWorkflowEditorBase } from './_editor/useWorkflowEditorBase';
import { useWorkflowEditorDocument } from './_editor/useWorkflowEditorDocument';
import { useWorkflowEditorEffects } from './_editor/useWorkflowEditorEffects';
import { useWorkflowEditorRuntime } from './_editor/useWorkflowEditorRuntime';
export type { WorkflowPageProps } from './_editor/types';
export function WorkflowEditor(props: WorkflowPageProps) {
    const base = useWorkflowEditorBase(props);
    const { displayRun } = base.runs;
    const outputContext = useMemo(() => ({ currentRun: displayRun, outputs: normalizeOutputs(displayRun, null) }), [displayRun]);
    const data = useWorkflowEditorDocument(props, base, outputContext.outputs);
    const runtime = useWorkflowEditorRuntime(props, base, data, outputContext.outputs);
    const effects = useWorkflowEditorEffects(base, data);
    return <InteractiveTableRuntimeContext.Provider value={runtime.interactiveTable}>
    <div className="app-shell workflow-shell-page" style={runtime.layout.appStyle}>
      <WorkflowEditorHeader props={props} base={base} data={data} runtime={runtime}/>
      <WorkflowEditorBody base={base} data={data} runtime={runtime} effects={effects}/>
    </div>
  </InteractiveTableRuntimeContext.Provider>;
}
