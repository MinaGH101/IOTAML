import type { CSSProperties, Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import { memo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { BarChart3, Bot, Check, ChevronLeft, ChevronRight, GitBranch, History, PackageOpen, RefreshCw, RotateCcw, SlidersHorizontal, Square, Trash2, Undo2 } from 'lucide-react';
import { AssistantPanel } from '../components/AssistantPanel';
import { ComponentLibraryPanel } from '../components/ComponentLibraryPanel';
import { Inspector } from '../components/Inspector';
import type { AnalysisBoardTab } from '../components/AnalysisBoard';
import { ResultsPanel, type Output } from '../components/ResultsPanel';
import type { Dataset, RegistryNode, Run, RunSummary, WorkflowComponent, WorkflowVersionSummary } from '../types';
import { formatDateTime, runDuration } from '../utils/appShared';

type RightTab = 'results' | 'settings' | 'history' | 'assistant' | 'versions' | 'components';

function RunHistoryPanel({ runs, currentRunId, busy, onSelect, onRetry, onCancel, onRefresh }: { runs: RunSummary[]; currentRunId?: number | null; busy: boolean; onSelect: (run: RunSummary) => void; onRetry: (run: RunSummary) => void; onCancel: (run: RunSummary) => void; onRefresh: () => void }) {
  return (
    <section className="run-history-panel workflow-tab-history-panel">
      <div className="workflow-tab-content-head">
        <span>تاریخچه اجرا و Debug</span>
        <button type="button" className="workflow-tab-icon-button" onClick={onRefresh} title="به‌روزرسانی" aria-label="به‌روزرسانی"><RefreshCw size={17}/></button>
      </div>
      <div className="run-history-list">
        {runs.slice(0, 20).map((run) => (
          <div key={run.id} className={`run-history-row ${currentRunId === run.id ? 'active' : ''}`}>
            <button type="button" className="run-history-main" onClick={() => onSelect(run)}>
              <span className={`run-dot ${run.status}`} />
              <b>{run.workflow_name}</b>
              <small>#{run.id} · {formatDateTime(run.created_at)} · {runDuration(run)} · تلاش {run.attempts}/{run.max_attempts}</small>
              <small>{Math.round(Number(run.progress?.percent || 0))}% · {run.status}</small>
            </button>
            {['queued', 'running'].includes(run.status)
              ? <button type="button" className="workflow-tab-icon-button" onClick={() => onCancel(run)} title="توقف اجرا" aria-label="توقف اجرا"><Square size={13} /></button>
              : <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onRetry(run)} title="اجرای دوباره با همین گراف" aria-label="اجرای دوباره"><RotateCcw size={17}/></button>}
          </div>
        ))}
        {runs.length === 0 && <div className="empty-state small">هنوز اجرای ذخیره‌شده‌ای برای این پروژه وجود ندارد.</div>}
      </div>
    </section>
  );
}

function WorkflowVersionsPanel({
  versions,
  workflowId,
  selectedVersionId,
  previewActive,
  busy,
  onSelect,
  onRestore,
  onDelete,
  onRefresh,
  onReturnToCurrent
}: {
  versions: WorkflowVersionSummary[];
  workflowId: number | null;
  selectedVersionId: number | null;
  previewActive: boolean;
  busy: boolean;
  onSelect: (version: WorkflowVersionSummary) => void;
  onRestore: (version: WorkflowVersionSummary) => void;
  onDelete: (version: WorkflowVersionSummary) => void;
  onRefresh: () => void;
  onReturnToCurrent: () => void;
}) {
  const selected = versions.find((item) => item.id === selectedVersionId) || null;
  return (
    <section className="workflow-versions-panel">
      <div className="workflow-tab-content-head">
        <span>نسخه‌های نام‌گذاری‌شده</span>
        <button type="button" className="workflow-tab-icon-button" disabled={!workflowId} onClick={onRefresh} title="به‌روزرسانی نسخه‌ها" aria-label="به‌روزرسانی نسخه‌ها"><RefreshCw size={17}/></button>
      </div>

      {previewActive && (
        <div className="workflow-version-preview-banner">
          <div>
            <b>نمایش نسخه ذخیره‌شده</b>
            <small>{selected ? `${selected.name} · v${selected.version_number}` : 'نسخه انتخاب‌شده'}</small>
          </div>
          <div className="workflow-version-preview-actions">
            <button type="button" className="workflow-tab-icon-button" onClick={onReturnToCurrent} title="بازگشت به آخرین نسخه خودکار" aria-label="بازگشت به آخرین نسخه خودکار"><Undo2 size={16}/></button>
            {selected && <button type="button" className="workflow-tab-icon-button active" disabled={busy} onClick={() => onRestore(selected)} title="بازیابی به‌عنوان نسخه جاری" aria-label="بازیابی به‌عنوان نسخه جاری"><Check size={16}/></button>}
          </div>
        </div>
      )}

      <div className="workflow-version-list">
        {versions.map((version) => (
          <div key={version.id} className={`workflow-version-row ${selectedVersionId === version.id ? 'active' : ''}`}>
            <button type="button" className="workflow-version-main" onClick={() => onSelect(version)}>
              <span className="workflow-version-number">v{version.version_number}</span>
              <b>{version.name}</b>
              <small>{formatDateTime(version.created_at)} · draft r{version.source_revision}</small>
              {version.description && <small>{version.description}</small>}
              {version.run_id && <small>Run #{version.run_id}</small>}
            </button>
            <button type="button" className="workflow-tab-icon-button workflow-version-delete" disabled={busy} onClick={() => onDelete(version)} title="حذف نسخه" aria-label="حذف نسخه"><Trash2 size={15}/></button>
          </div>
        ))}
        {!workflowId && <div className="empty-state small">ابتدا جریان به‌صورت خودکار ذخیره می‌شود، سپس می‌توانید نسخه نام‌گذاری‌شده بسازید.</div>}
        {workflowId && versions.length === 0 && <div className="empty-state small">هنوز نسخه نام‌گذاری‌شده‌ای ذخیره نشده است. دکمه Save بالای صفحه یک نسخه ثابت ایجاد می‌کند.</div>}
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
  runHistory: RunSummary[];
  currentRun: Run | null;
  busy: boolean;
  retryRun: (run: Run | RunSummary) => void | Promise<void>;
  cancelRun: (run: Run | RunSummary) => void | Promise<void>;
  selectHistoricalRun: (run: RunSummary) => void | Promise<void>;
  refreshRunHistory: () => Promise<void>;
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  datasets: Dataset[];
  availableColumns: string[];
  availableRows?: Record<string, unknown>[];
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
  renameNode: (nodeId: string, label: string) => void;
  deleteSelected: () => void;
  onUngroupComponent: (node: Node) => void;
  selectedId: string | null;
  onAddOutputToBoard?: (output: Output, index: number) => void;
  analysisBoardOpen: boolean;
  boardTabs: AnalysisBoardTab[];
  boardTargetId: string;
  onBoardTargetChange: (id: string) => void;
  workflowId: number | null;
  workflowVersions: WorkflowVersionSummary[];
  selectedVersionId: number | null;
  versionPreviewActive: boolean;
  onSelectVersion: (version: WorkflowVersionSummary) => void;
  onRestoreVersion: (version: WorkflowVersionSummary) => void;
  onDeleteVersion: (version: WorkflowVersionSummary) => void;
  onRefreshVersions: () => void;
  onReturnToCurrentVersion: () => void;
  components: WorkflowComponent[];
  onRefreshComponents: () => void;
  onEditComponent: (component: WorkflowComponent) => void;
  onManageComponentVersions: (component: WorkflowComponent) => void;
  onExportComponent: (component: WorkflowComponent) => void;
  onArchiveComponent: (component: WorkflowComponent) => void;
  onDeleteComponent: (component: WorkflowComponent) => void;
  onImportComponent: (payload: Record<string, unknown>) => void;
  readOnly: boolean;
};

const tabMeta: Record<RightTab, { label: string; icon: typeof BarChart3 }> = {
  results: { label: 'خروجی نود', icon: BarChart3 },
  settings: { label: 'تنظیمات نود', icon: SlidersHorizontal },
  history: { label: 'تاریخچه اجرا', icon: History },
  assistant: { label: 'دستیار هوشمند', icon: Bot },
  versions: { label: 'نسخه‌های جریان', icon: GitBranch },
  components: { label: 'کامپوننت‌ها', icon: PackageOpen }
};

function RightPanelComponent({
  floatingRightStyle,
  resultsCollapsed,
  setResultsCollapsed,
  startResize,
  selectedFlow,
  runHistory,
  currentRun,
  busy,
  retryRun,
  cancelRun,
  selectHistoricalRun,
  refreshRunHistory,
  selectedNode,
  selectedEdge,
  registry,
  aliases,
  datasets,
  availableColumns,
  availableRows = [],
  updateNodeParams,
  renameNode,
  deleteSelected,
  onUngroupComponent,
  selectedId,
  onAddOutputToBoard,
  analysisBoardOpen,
  boardTabs,
  boardTargetId,
  onBoardTargetChange,
  workflowId,
  workflowVersions,
  selectedVersionId,
  versionPreviewActive,
  onSelectVersion,
  onRestoreVersion,
  onDeleteVersion,
  onRefreshVersions,
  onReturnToCurrentVersion,
  components,
  onRefreshComponents,
  onEditComponent,
  onManageComponentVersions,
  onExportComponent,
  onArchiveComponent,
  onDeleteComponent,
  onImportComponent,
  readOnly
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('results');
  const [visitedTabs, setVisitedTabs] = useState<Set<RightTab>>(() => new Set<RightTab>(['results']));

  const openTab = (tab: RightTab) => {
    setActiveTab(tab);
    setVisitedTabs((current) => {
      if (current.has(tab)) return current;
      const next = new Set(current);
      next.add(tab);
      return next;
    });
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
            {(['results', 'settings', 'history', 'assistant', 'versions', 'components'] as RightTab[]).map(renderTabButton)}
          </div>
        </div>

        <div className="workflow-right-tabs-content" aria-hidden={resultsCollapsed}>
            <div className="workflow-right-context-line">
              <b>{tabMeta[activeTab].label}</b>
              <span>{selectedFlow.mode === 'selected' ? 'جریان انتخاب‌شده' : 'کل برد'} · {selectedFlow.nodes.length} نود، {selectedFlow.edges.length} اتصال</span>
            </div>

            {visitedTabs.has('results') && (
              <div className="workflow-right-tab-body workflow-results-tab" hidden={activeTab !== 'results'}>
                {onAddOutputToBoard && (
                  <div className="workflow-board-target">
                    <label htmlFor="workflow-board-target-select">برد مقصد</label>
                    <select
                      id="workflow-board-target-select"
                      value={analysisBoardOpen ? boardTargetId : 'analysis-board-main'}
                      disabled={!analysisBoardOpen}
                      onChange={(event) => onBoardTargetChange(event.target.value)}
                    >
                      {boardTabs.map((tab) => <option value={tab.id} key={tab.id}>{tab.name}</option>)}
                    </select>
                    <small>{analysisBoardOpen ? 'Pin به برد انتخاب‌شده اضافه می‌شود.' : 'در Workflow، Pin همیشه به برد اصلی می‌رود.'}</small>
                  </div>
                )}
                <ResultsPanel run={currentRun} selectedNodeId={selectedId} collapsed={false} onToggle={() => setResultsCollapsed(true)} onAddToBoard={onAddOutputToBoard} />
              </div>
            )}

            {visitedTabs.has('settings') && (
              <div className="workflow-right-tab-body workflow-settings-tab" hidden={activeTab !== 'settings'}>
                <Inspector embedded readOnly={readOnly} selectedNode={selectedNode} selectedEdge={selectedEdge} registry={registry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} availableRows={availableRows} onChange={updateNodeParams} onRename={renameNode} onDelete={deleteSelected} onUngroupComponent={onUngroupComponent} />
              </div>
            )}

            {visitedTabs.has('history') && (
              <div className="workflow-right-tab-body workflow-history-tab" hidden={activeTab !== 'history'}>
                <RunHistoryPanel
                  runs={runHistory}
                  currentRunId={currentRun?.id}
                  busy={busy}
                  onSelect={(run) => { void selectHistoricalRun(run); }}
                  onRetry={retryRun}
                  onCancel={cancelRun}
                  onRefresh={() => refreshRunHistory().catch(() => undefined)}
                />
              </div>
            )}

            {visitedTabs.has('assistant') && (
              <div className="workflow-right-tab-body workflow-assistant-tab" hidden={activeTab !== 'assistant'}>
                <AssistantPanel workflowId={workflowId} />
              </div>
            )}

            {visitedTabs.has('versions') && (
              <div className="workflow-right-tab-body workflow-versions-tab" hidden={activeTab !== 'versions'}>
                <WorkflowVersionsPanel
                  versions={workflowVersions}
                  workflowId={workflowId}
                  selectedVersionId={selectedVersionId}
                  previewActive={versionPreviewActive}
                  busy={busy}
                  onSelect={onSelectVersion}
                  onRestore={onRestoreVersion}
                  onDelete={onDeleteVersion}
                  onRefresh={onRefreshVersions}
                  onReturnToCurrent={onReturnToCurrentVersion}
                />
              </div>
            )}

            {visitedTabs.has('components') && (
              <div className="workflow-right-tab-body workflow-components-tab" hidden={activeTab !== 'components'}>
                <ComponentLibraryPanel
                  components={components}
                  busy={busy}
                  onRefresh={onRefreshComponents}
                  onEdit={onEditComponent}
                  onManageVersions={onManageComponentVersions}
                  onExport={onExportComponent}
                  onArchive={onArchiveComponent}
                  onDelete={onDeleteComponent}
                  onImport={onImportComponent}
                />
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

export const RightPanel = memo(RightPanelComponent);
