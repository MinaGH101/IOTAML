import { Check, ListTree, Pencil, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AnalysisBoardTab } from '../../../_model/board';
import { MAIN_ANALYSIS_BOARD_ID } from '../../../_model/graph';

export function BoardTabs({ tabs, activeBoardId, editing, readOnly, nodesOpen, onToggleNodes, onSelectBoard, onCreateBoard, onRenameBoard, onRemoveBoard }: {
    tabs: AnalysisBoardTab[];
    activeBoardId: string;
    editing: boolean;
    readOnly: boolean;
    nodesOpen: boolean;
    onToggleNodes: () => void;
    onSelectBoard: (id: string) => void;
    onCreateBoard: () => void;
    onRenameBoard: (id: string, name: string) => void;
    onRemoveBoard: (id: string) => void;
}) {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const cancelRename = useRef(false);
    const commit = () => {
        if (cancelRename.current) { cancelRename.current = false; setRenamingId(null); return; }
        if (renamingId && draft.trim()) onRenameBoard(renamingId, draft.trim());
        setRenamingId(null);
    };
    return <div className="analysis-board-tabs-row">
      {!nodesOpen && <button className="analysis-board-nodes-toggle" type="button" onClick={onToggleNodes} title="باز کردن لیست نودها" aria-label="باز کردن لیست نودها" aria-expanded={false}><ListTree size={17}/></button>}
      <div className="analysis-board-tabs-scroll" role="tablist" aria-label="بردهای تحلیل">
        {tabs.map((tab) => <div className={`analysis-board-tab ${tab.id === activeBoardId ? 'active' : ''}`} key={tab.id}>
          {renamingId === tab.id && editing ? <input autoFocus aria-label="نام برد" value={draft} maxLength={80} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') { cancelRename.current = true; setRenamingId(null); } }} onBlur={commit}/> : <button role="tab" aria-selected={tab.id === activeBoardId} type="button" className="analysis-board-tab-select" onClick={() => onSelectBoard(tab.id)}><span>{tab.name}</span><small>{tab.items.length.toLocaleString('fa-IR')}</small></button>}
          {editing && !readOnly && <div className="analysis-board-tab-actions"><button type="button" title="تغییر نام" aria-label={`تغییر نام ${tab.name}`} onClick={() => { cancelRename.current = false; setRenamingId(tab.id); setDraft(tab.name); }}><Pencil size={13}/></button>{tab.id !== MAIN_ANALYSIS_BOARD_ID && <button type="button" title="حذف برد" aria-label={`حذف ${tab.name}`} onClick={() => onRemoveBoard(tab.id)}><X size={14}/></button>}</div>}
        </div>)}
      </div>
      {editing && !readOnly && <button className="analysis-board-add-tab" type="button" onClick={onCreateBoard} title="برد جدید" aria-label="برد جدید"><Plus size={16}/></button>}
      {renamingId && editing && <button className="analysis-board-rename-commit" type="button" onClick={commit} title="ثبت نام"><Check size={16}/></button>}
    </div>;
}
