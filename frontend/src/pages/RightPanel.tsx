import type { CSSProperties, Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import { useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { BarChart3, ChevronLeft, ChevronRight, History, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Inspector } from '../components/Inspector';
import { ResultsPanel, type Output } from '../components/ResultsPanel';
import type { Dataset, RegistryNode, Run } from '../types';
import { formatDateTime, runDuration } from '../utils/appShared';

type RightTab = 'results' | 'settings' | 'history';

function RunHistoryPanel({ runs, currentRunId, busy, onSelect, onRetry, onRefresh }: { runs: Run[]; currentRunId?: number | null; busy: boolean; onSelect: (run: Run) => void; onRetry: (run: Run) => void; onRefresh: () => void }) {
  return (
    <section className="run-history-panel workflow-tab-history-panel">
      <div className="workflow-tab-content-head">
        <span>تاریخچه اجرا و Debug</span>
        <button type="button" className="workflow-tab-icon-button" onClick={onRefresh} title="به‌روزرسانی" aria-label="به‌روزرسانی"><RefreshCw size={14} /></button>
      </div>
      <div className="run-history-list">
        {runs.slice(0, 12).map((run) => (
          <div key={run.id} className={`run-history-row ${currentRunId === run.id ? 'active' : ''}`}>
            <button type="button" className="run-history-main" onClick={() => onSelect(run)}>
              <span className={`run-dot ${run.status}`} />
              <b>{run.workflow_name}</b>
              <small>#{run.id} · {formatDateTime(run.created_at)} · {runDuration(run)}</small>
            </button>
            <button type="button" className="workflow-tab-icon-button" disabled={busy || !run.workflow_graph} onClick={() => onRetry(run)} title="اجرای دوباره با همین گراف" aria-label="اجرای دوباره"><RotateCcw size={14} /></button>
          </div>
        ))}
        {runs.length === 0 && <div className="empty-state small">هنوز اجرای ذخیره‌شده‌ای برای این پروژه وجود ندارد.</div>}
      </div>
    </section>
  );
}

type RightPanelProps = {
  floatingRightStyle: CSSProperties;
  resultsCollapsed: boolean;
  setResultsCollapsed: Dispatch<SetStateAction<boolean>>;
  startResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  selectedFlow: { nodes: Node[]; edges: Edge[]; mode: 'all' | 'selected' };
  historyCollapsed: boolean;
  setHistoryCollapsed: Dispatch<SetStateAction<boolean>>;
  runHistory: Run[];
  currentRun: Run | null;
  busy: boolean;
  setCurrentRun: Dispatch<SetStateAction<Run | null>>;
  setMessage: Dispatch<SetStateAction<string>>;
  retryRun: (run: Run) => void | Promise<void>;
  refreshRunHistory: () => Promise<void>;
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  datasets: Dataset[];
  availableColumns: string[];
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
  renameNode: (nodeId: string, label: string) => void;
  deleteSelected: () => void;
  nodeResultsCollapsed: boolean;
  setNodeResultsCollapsed: Dispatch<SetStateAction<boolean>>;
  quickSettingsCollapsed: boolean;
  setQuickSettingsCollapsed: Dispatch<SetStateAction<boolean>>;
  selectedId: string | null;
  onAddOutputToBoard?: (output: Output, index: number) => void;
};

const tabMeta: Record<RightTab, { label: string; icon: typeof BarChart3 }> = {
  results: { label: 'خروجی نود', icon: BarChart3 },
  settings: { label: 'تنظیمات نود', icon: SlidersHorizontal },
  history: { label: 'تاریخچه اجرا', icon: History }
};

export function RightPanel({
  floatingRightStyle,
  resultsCollapsed,
  setResultsCollapsed,
  startResize,
  selectedFlow,
  runHistory,
  currentRun,
  busy,
  setCurrentRun,
  setMessage,
  retryRun,
  refreshRunHistory,
  selectedNode,
  selectedEdge,
  registry,
  aliases,
  datasets,
  availableColumns,
  updateNodeParams,
  renameNode,
  deleteSelected,
  selectedId,
  onAddOutputToBoard
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('results');

  const openTab = (tab: RightTab) => {
    setActiveTab(tab);
    setResultsCollapsed(false);
  };

  const renderTabButton = (tab: RightTab) => {
    const Icon = tabMeta[tab].icon;
    return (
      <button
        key={tab}
        type="button"
        className={`workflow-right-tab-button ${activeTab === tab ? 'active' : ''}`}
        onClick={() => openTab(tab)}
        title={tabMeta[tab].label}
        aria-label={tabMeta[tab].label}
      >
        <Icon size={17} />
      </button>
    );
  };

  return (
    <div className={`right-stack-wrap workflow-right-tabs-wrap ${resultsCollapsed ? 'workflow-right-tabs-collapsed' : ''}`} style={floatingRightStyle}>
      {!resultsCollapsed && <div className="resize-handle" onPointerDown={startResize} title="تغییر عرض پنل راست" />}

      <div className="right-stack workflow-right-stack workflow-right-tabs-panel">
        <div className="workflow-right-tabs-toolbar">
          <button
            className="workflow-right-collapse-button"
            type="button"
            onClick={() => setResultsCollapsed((value) => !value)}
            title={resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'}
            aria-label={resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'}
          >
            {resultsCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>

          <div className="workflow-right-tab-buttons" aria-label="بخش‌های پنل راست">
            {(['results', 'settings', 'history'] as RightTab[]).map(renderTabButton)}
          </div>
        </div>

        {!resultsCollapsed && (
          <div className="workflow-right-tabs-content">
            <div className="workflow-right-context-line">
              <b>{tabMeta[activeTab].label}</b>
              <span>{selectedFlow.mode === 'selected' ? 'جریان انتخاب‌شده' : 'کل برد'} · {selectedFlow.nodes.length} نود، {selectedFlow.edges.length} اتصال</span>
            </div>

            {activeTab === 'results' && (
              <div className="workflow-right-tab-body workflow-results-tab">
                <ResultsPanel run={currentRun} selectedNodeId={selectedId} collapsed={false} onToggle={() => setResultsCollapsed(true)} onAddToBoard={onAddOutputToBoard} />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="workflow-right-tab-body workflow-settings-tab">
                <Inspector embedded selectedNode={selectedNode} selectedEdge={selectedEdge} registry={registry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} onChange={updateNodeParams} onRename={renameNode} onDelete={deleteSelected} />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="workflow-right-tab-body workflow-history-tab">
                <RunHistoryPanel
                  runs={runHistory}
                  currentRunId={currentRun?.id}
                  busy={busy}
                  onSelect={(run) => { setCurrentRun(run); setMessage('خروجی اجرای قبلی برای Debug نمایش داده شد'); }}
                  onRetry={retryRun}
                  onRefresh={() => refreshRunHistory().catch(() => undefined)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
