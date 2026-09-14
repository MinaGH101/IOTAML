import { CustomNodeBuilder } from '../../../_components/CustomNodeBuilder';
import { NodeModal } from '../../../_components/NodeModal';
import type { Run } from '../../../../shared/types';
import type { WorkflowOverlaysProps } from './workflowOverlayTypes';
export function WorkflowNodeOverlays(p: WorkflowOverlaysProps & {
    run: Run | null;
}) { return <>{p.graph.modalNode && !p.versionPreview && <NodeModal node={p.graph.modalNode} workflowNodes={p.graph.nodes} edges={p.graph.edges} registry={p.catalog.nodes} aliases={p.catalog.aliases} portCompatibility={p.catalog.compatiblePorts} datasets={p.datasets} availableColumns={p.columns.availableColumns} availableIdColumns={p.columns.availableIdColumns} inheritedIdColumn={p.columns.inheritedIdColumn} availableRows={p.columns.availableRows} run={p.run} busy={p.runs.busy} onRunNode={() => p.execution.runGraphFromNode(p.graph.modalNode!.id)} onCancelRun={() => { if (p.runs.currentRun)
    void p.runs.cancelRun(p.runs.currentRun); }} onParamsChange={p.canvas.updateNodeParams} onRename={p.canvas.renameNode} onPinnedChange={p.canvas.updateNodePinned} onAddOutputToBoard={p.boards.addOutputToMainBoard} onInputSourceHandleChange={p.canvas.onInputSourceHandleChange} onClose={() => p.graph.setModalNodeId(null)}/>} {p.customNodes.open && <CustomNodeBuilder definition={p.customNodes.definition} workflowNodes={p.graph.nodes} registry={p.catalog.nodes} busy={p.customNodes.busy} onSave={p.customNodes.saveNode} onDelete={p.customNodes.definition ? p.customNodes.deleteNode : undefined} onClose={p.customNodes.closeBuilder}/>}</>; }
