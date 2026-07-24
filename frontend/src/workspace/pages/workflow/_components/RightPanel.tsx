import type { CSSProperties, Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import { memo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { BarChart3, Bot, ChevronLeft, ChevronRight, GitBranch, History, PackageOpen, SlidersHorizontal } from 'lucide-react';
import { AssistantPanel } from '../../../_components/AssistantPanel';
import { ComponentLibraryPanel } from '../../../_components/ComponentLibraryPanel';
import { Inspector } from '../../../_components/Inspector';
import type { AnalysisBoardTab } from '../../../_model/board';
import { ResultsPanel, type Output } from '../../../_components/ResultsPanel';
import type { Dataset, RegistryNode, Run, RunSummary, WorkflowComponent, WorkflowVersionSummary } from '../../../../shared/_types';
import { RunHistoryPanel } from './RunHistoryPanel';
import { WorkflowVersionsPanel } from './WorkflowVersionsPanel';

type RightTab = 'results' | 'settings' | 'history' | 'assistant' | 'versions' | 'components';


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
  availableIdColumns?: string[];
  inheritedIdColumn?: string | null;
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
  availableIdColumns = [],
  inheritedIdColumn = null,
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
            {(['results', 'settings', 'history', 'assistant', 'versions', 'components'] as RightTab[]).map(renderTabButton)}
          </div>
        </div>

        <div className="workflow-right-tabs-content" aria-hidden={resultsCollapsed}>
            <div className="workflow-right-context-line">
              <b>{tabMeta[activeTab].label}</b>
              <span>{selectedFlow.mode === 'selected' ? 'جریان انتخاب‌شده' : 'کل برد'} · {selectedFlow.nodes.length} نود، {selectedFlow.edges.length} اتصال</span>
            </div>

            {activeTab === 'results' && (
              <div className="workflow-right-tab-body workflow-results-tab">
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

            {activeTab === 'settings' && (
              <div className="workflow-right-tab-body workflow-settings-tab">
                <Inspector embedded readOnly={readOnly} selectedNode={selectedNode} selectedEdge={selectedEdge} registry={registry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} availableIdColumns={availableIdColumns} inheritedIdColumn={inheritedIdColumn} availableRows={availableRows} onChange={updateNodeParams} onRename={renameNode} onDelete={deleteSelected} onUngroupComponent={onUngroupComponent} />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="workflow-right-tab-body workflow-history-tab">
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

            {activeTab === 'assistant' && (
              <div className="workflow-right-tab-body workflow-assistant-tab">
                <AssistantPanel workflowId={workflowId} />
              </div>
            )}

            {activeTab === 'versions' && (
              <div className="workflow-right-tab-body workflow-versions-tab">
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

            {activeTab === 'components' && (
              <div className="workflow-right-tab-body workflow-components-tab">
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
