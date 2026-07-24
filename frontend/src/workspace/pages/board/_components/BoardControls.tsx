import { Plus } from 'lucide-react';
import type { AnalysisBoardTab } from '../../../_model/board';

export function BoardTabs({
  tabs,
  activeBoardId,
  readOnly,
  onSelectBoard,
  onCreateBoard,
}: {
  tabs: AnalysisBoardTab[];
  activeBoardId: string;
  readOnly: boolean;
  onSelectBoard: (id: string) => void;
  onCreateBoard: () => void;
}) {
  return (
    <div className="analysis-board-toolbar analysis-board-toolbar-direct workflow-shell-card">
      <div className="analysis-board-tabs-row" aria-label="بردهای تحلیل">
        <div className="analysis-board-tabs-scroll">
          {tabs.map((tab) => (
            <div className={`analysis-board-tab ${tab.id === activeBoardId ? 'active' : ''}`} key={tab.id}>
              <button type="button" className="analysis-board-tab-select" onClick={() => onSelectBoard(tab.id)}>
                <span>{tab.name}</span>
                <small>{tab.items.length.toLocaleString('fa-IR')}</small>
              </button>
            </div>
          ))}
        </div>
        {!readOnly && <button className="analysis-board-add-tab" type="button" onClick={onCreateBoard} title="برد جدید"><Plus size={13} /></button>}
      </div>
    </div>
  );
}
