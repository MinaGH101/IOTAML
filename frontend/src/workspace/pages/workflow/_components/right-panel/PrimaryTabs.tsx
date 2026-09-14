import { Inspector } from '../../../../_components/Inspector';
import { ResultsPanel } from '../../../../../features/results/components/ResultsPanel';
import type { InteractiveTableState } from '../../../../_components/output/InteractiveTableOutput';
import type { RightPanelProps, RightTab } from './types';
export function PrimaryTabs({ tab, p, inputDataframes, updateInteractiveTable }: {
    tab: RightTab;
    p: RightPanelProps;
    inputDataframes: Array<{
        value: string;
        label: string;
    }>;
    updateInteractiveTable: (nodeId: string, state: InteractiveTableState) => void;
}) {
    if (tab === 'results')
        return <div className="workflow-right-tab-body workflow-results-tab">
    {p.onAddOutputToBoard && <div className="workflow-board-target"><label htmlFor="workflow-board-target-select">برد مقصد</label><select id="workflow-board-target-select" value={p.analysisBoardOpen ? p.boardTargetId : 'analysis-board-main'} disabled={!p.analysisBoardOpen} onChange={(event) => p.onBoardTargetChange(event.target.value)}>
      {p.boardTabs.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>{p.analysisBoardOpen ? 'Pin به برد انتخاب‌شده اضافه می‌شود.' : 'در Workflow، Pin همیشه به برد اصلی می‌رود.'}</small></div>}
    <ResultsPanel run={p.resultRun} selectedNodeId={p.selectedId} collapsed={false} onToggle={() => p.setResultsCollapsed(true)} onAddToBoard={p.onAddOutputToBoard} onInteractiveTableChange={updateInteractiveTable}/>
  </div>;
    if (tab !== 'settings')
        return null;
    return <div className="workflow-right-tab-body workflow-settings-tab"><Inspector embedded readOnly={p.readOnly} selectedNode={p.selectedNode} selectedEdge={p.selectedEdge} registry={p.registry} aliases={p.aliases} datasets={p.datasets} availableColumns={p.availableColumns} availableIdColumns={p.availableIdColumns || []} inheritedIdColumn={p.inheritedIdColumn ?? null} availableRows={p.availableRows || []} inputDataframes={inputDataframes} onChange={p.updateNodeParams} onRename={p.renameNode} onDelete={p.deleteSelected} onUngroupComponent={p.onUngroupComponent}/></div>;
}
