import { Controls, MiniMap, ReactFlow } from '@xyflow/react';
import type { Run } from '../../../../shared/types';
import { MlNode } from '../../../_components/nodes/MlNode';
import { BoardPage } from '../../board/BoardPage';
import type { WorkflowStageProps } from './workflowStageTypes';
const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];
export function WorkflowCanvas({ run, ...p }: WorkflowStageProps & {
    run: Run | null;
}) {
    return <section className="board" onDrop={p.canvas.onDrop} onDragOver={p.canvas.onDragOver} style={p.layout.floatingBoardStyle}>
    {p.message && <div className="toast">{p.message}</div>}
    <div className={`workflow-flow-layer ${p.analysisBoardOpen ? 'is-hidden' : ''}`} aria-hidden={p.analysisBoardOpen}>
      <ReactFlow nodes={p.canvas.flowNodes} edges={p.graph.edges} nodeTypes={nodeTypes} onNodesChange={p.graph.onNodesChange} onNodeDragStop={p.graph.commitNodePositions} onEdgesChange={p.graph.onEdgesChange} onConnect={p.canvas.onConnect} onSelectionChange={p.graph.onSelectionChange} onNodeClick={p.graph.onNodeClick} onNodeDoubleClick={p.canvas.onNodeDoubleClick} onEdgeClick={p.graph.onEdgeClick} onPaneClick={p.graph.onPaneClick} nodesDraggable={!p.readOnly && !p.graph.ctrlSelectionActive} nodesConnectable={!p.readOnly} edgesReconnectable={!p.readOnly} selectionOnDrag={p.graph.ctrlSelectionActive} selectionKeyCode={null} multiSelectionKeyCode={multiSelectionKeys} panOnDrag={!p.graph.ctrlSelectionActive} className={p.graph.ctrlSelectionActive ? 'workflow-ctrl-selection-active' : ''} onlyRenderVisibleElements defaultViewport={p.workflowViewport} onMoveEnd={(_, viewport) => p.onWorkflowViewportChange(viewport)}>
        <Controls /><MiniMap className="workflow-minimap-visible" pannable zoomable style={{ left: p.paletteCollapsed ? 76 : 304, right: 'auto', bottom: 24 }}/>
      </ReactFlow>
    </div>
    <div className={`analysis-board-mount-layer ${p.analysisBoardOpen ? '' : 'is-hidden'}`} aria-hidden={!p.analysisBoardOpen}>
      <BoardPage tabs={p.boards.boards} activeBoardId={p.boards.activeBoardId} items={p.boards.activeBoard?.items || []} run={run} workflowDirty={p.workflowDirtyForBoard} onSelectBoard={p.boards.selectBoard} onCreateBoard={p.boards.createBoard} onUpdateItem={p.boards.updateItem} onRemoveItem={p.boards.removeItem} onDuplicateItem={p.boards.duplicateItem} onSelectSourceNode={p.canvas.selectWorkflowNode} viewportStorageScope={p.viewportStorageScope} active={p.analysisBoardOpen} readOnly={p.readOnly}/>
    </div>
  </section>;
}
