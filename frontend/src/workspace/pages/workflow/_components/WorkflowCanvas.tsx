import { Controls, MiniMap, ReactFlow } from '@xyflow/react';
import type { Run } from '../../../../shared/types';
import { MlNode } from '../../../_components/nodes/MlNode';
import { BoardPage } from '../../board/BoardPage';
import type { BoardCaseFilters } from '../../board/_hooks/useBoardCaseFilters';
import type { WorkflowStageProps } from './workflowStageTypes';
const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];
export function WorkflowCanvas({ run, boardCaseFilters, ...p }: WorkflowStageProps & {
    run: Run | null;
    boardCaseFilters: BoardCaseFilters;
}) {
    const extractNodeIds = p.graph.nodes.filter((node) => {
        const data = node.data as { registryId?: string } | undefined;
        return data?.registryId === 'RV-003';
    }).map((node) => node.id);
    return <section className="board" onDrop={p.canvas.onDrop} onDragOver={p.canvas.onDragOver} style={p.layout.floatingBoardStyle}>
    {p.message && <div className="toast" role="status">{p.message}</div>}
    {!p.analysisBoardOpen && <div className="workflow-flow-layer">
      <ReactFlow nodes={p.canvas.flowNodes} edges={p.graph.edges} nodeTypes={nodeTypes} onNodesChange={p.graph.onNodesChange} onNodeDragStop={p.graph.commitNodePositions} onEdgesChange={p.graph.onEdgesChange} onConnect={p.canvas.onConnect} onSelectionChange={p.graph.onSelectionChange} onNodeClick={p.graph.onNodeClick} onNodeDoubleClick={p.canvas.onNodeDoubleClick} onEdgeClick={p.graph.onEdgeClick} onPaneClick={p.graph.onPaneClick} nodesDraggable={!p.readOnly && !p.graph.ctrlSelectionActive} nodesConnectable={!p.readOnly} edgesReconnectable={!p.readOnly} selectionOnDrag={p.graph.ctrlSelectionActive} selectionKeyCode={null} multiSelectionKeyCode={multiSelectionKeys} panOnDrag={!p.graph.ctrlSelectionActive} className={p.graph.ctrlSelectionActive ? 'workflow-ctrl-selection-active' : ''} onlyRenderVisibleElements defaultViewport={p.workflowViewport} onMoveEnd={(_, viewport) => p.onWorkflowViewportChange(viewport)}>
        <Controls /><MiniMap className="workflow-minimap-visible" pannable zoomable style={{ left: p.paletteCollapsed ? 76 : 304, right: 'auto', bottom: 24 }}/>
      </ReactFlow>
    </div>}
    <div className={`analysis-board-mount-layer ${p.analysisBoardOpen ? '' : 'is-hidden'}`} aria-hidden={!p.analysisBoardOpen}>
      <BoardPage caseExtractNodeIds={extractNodeIds} tabs={p.boards.boards} activeBoardId={p.boards.activeBoardId} items={p.boards.activeBoard?.items || []} run={run} workflowDirty={p.workflowDirtyForBoard} onSelectBoard={p.boards.selectBoard} onCreateBoard={p.boards.createBoard} onRenameBoard={p.boards.renameBoard} onRemoveBoard={p.boards.removeBoard} onUpdateItem={p.boards.updateItem} onRemoveItem={p.boards.removeItem} onMoveItem={p.boards.moveItem} onAddOutputAt={p.boards.addOutputAt} onUpdateViewport={p.boards.updateBoardViewport} onOpenOutputs={() => p.setResultsCollapsed(false)} onSave={() => p.document.persistSnapshot(p.document.autosaveSnapshot, p.document.autosaveSignature)} active={p.analysisBoardOpen} nodesOpen={!p.paletteCollapsed} onToggleNodes={() => p.setPaletteCollapsed((value) => !value)} canManageLocks={p.canManageLocks} onToggleBoardLock={p.boards.toggleBoardLock} readOnly={p.readOnly} caseFilters={boardCaseFilters}/>
    </div>
  </section>;
}
