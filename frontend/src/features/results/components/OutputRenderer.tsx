import { Download, Pin } from 'lucide-react';
import { memo } from 'react';
import type { Output } from '../../../workspace/_model/output';
import { applyInteractiveTableState } from '../../../workspace/_model/interactiveTableState';
import { useInteractiveTableEntry } from '../../../workspace/_model/interactiveTableRuntime';
import { chartHeight } from '../../../workspace/_components/charts/chartSizing';
import { InteractiveTableOutput, type InteractiveTableState } from '../../../workspace/_components/output/InteractiveTableOutput';
import { OutputTable } from '../../../workspace/_components/output/OutputTable';
import { useOutputVisibility } from '../../../workspace/_components/output/useOutputVisibility';
import { downloadOutput } from '../lib/outputDownload';
import { ChartOutput } from './ChartOutput';
import { OutputErrorBoundary } from './OutputErrorBoundary';
import { WorkflowErrorCard } from './WorkflowErrorCard';

export const CHART_KINDS = new Set(['scatter', 'histogram', 'bar', 'line', 'heatmap', 'matrix', 'boxplot', 'bar_plot', 'pp_plot', 'stair_outlier', 'dendrogram']);

function formatMetric(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('fa-IR') : value.toFixed(4);
  if (value === null || value === undefined) return '-';
  return String(value);
}

function MetricsOutput({ metrics }: { metrics: Record<string, unknown> }) {
  return <div className="metric-grid">{Object.entries(metrics).map(([key, value]) => <div className="metric-card workflow-shell-card" key={key}><span>{key}</span><b>{formatMetric(value)}</b></div>)}</div>;
}

function LinkedInteractiveResultTable({ output }: { output: Output }) {
  const entry = useInteractiveTableEntry(String(output.node_id || ''));
  if (!entry.source) return <OutputTable rows={(output.rows as Record<string, unknown>[] | undefined) || []} columns={output.columns as string[] | undefined} />;
  const linked = applyInteractiveTableState(entry.source.rows, entry.source.columns, entry.state);
  return <OutputTable rows={linked.resultRows} columns={linked.resultColumns} />;
}

function plotSubtitle(plot: Output) {
  const kind = String(plot.kind || 'plot');
  if (kind === 'scatter') return `${String(plot.x || 'x')} × ${String(plot.y || 'y')}`;
  if (['histogram', 'boxplot', 'pp_plot', 'stair_outlier'].includes(kind)) return String(plot.column || kind);
  if (kind === 'bar_plot') return String(plot.category_column || kind);
  return kind;
}

function PlotGroupOutput({ output, onAddToBoard, eagerCharts }: { output: Output; onAddToBoard?: (output: Output, index: number) => void; eagerCharts: boolean }) {
  const plots = Array.isArray(output.plots) ? output.plots.filter((plot): plot is Output => Boolean(plot && typeof plot === 'object' && !Array.isArray(plot))) : [];
  if (!plots.length) return <div className="empty-state">نموداری برای نمایش در این پنجره وجود ندارد.</div>;
  return (
    <div className="plot-group-window workflow-shell-card">
      <div className="plot-group-head"><b>{plots.length.toLocaleString('fa-IR')} نمودار در این نود</b>{onAddToBoard && <button className="tiny-action" type="button" onClick={() => onAddToBoard(output, 0)}><Pin size={12}/>افزودن کل پنجره</button>}</div>
      <div className="plot-group-scroll">{plots.map((plot, index) => <div className="plot-group-item" style={{ minHeight: 360 }} key={`${String(plot.title || plot.kind || 'plot')}-${index}`}><div className="plot-group-item-head"><b>{String(plot.title || `Plot ${index + 1}`)}</b><span>{plotSubtitle(plot)}</span><button className="tiny-action icon-action" type="button" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(plot, index)}><Download size={12}/></button>{onAddToBoard && <button className="tiny-action icon-action" type="button" title="افزودن همین نمودار به برد" aria-label="افزودن همین نمودار به برد" onClick={() => onAddToBoard(plot, index)}><Pin size={12}/></button>}</div><OutputRenderer output={plot} onAddToBoard={onAddToBoard} collectionMode eager={eagerCharts}/></div>)}</div>
    </div>
  );
}

function ImmediateOutput({ output, onAddToBoard, onInteractiveTableChange, collectionMode, fillContainer }: RendererProps) {
  const kind = String(output.kind || 'json');
  const anomalyRole = String(output.output_role || '');
  if (['thresholds', 'anomalies', 'counts'].includes(anomalyRole) && kind !== 'table') return <WorkflowErrorCard problem={{ code: 'ANOMALY_OUTPUT_CONTRACT_MISMATCH', message: `خروجی ${anomalyRole} باید جدول باشد، اما ${kind} دریافت شد.`, responsibility: 'application', node_id: output.node_id, port: output.source_handle, expected: 'table', actual: kind, suggested_fix: 'بک‌اند و فرانت‌اند را از همین نسخه اجرا کنید و سرویس‌ها را دوباره بسازید.' }} />;
  if (kind === 'interactive_table') return <InteractiveTableOutput output={output} onStateChange={(state) => onInteractiveTableChange?.(String(output.node_id || ''), state)} />;
  if (kind === 'table' && output.interactive_table_result === true) return <LinkedInteractiveResultTable output={output} />;
  if (kind === 'table') return <OutputTable rows={(output.rows as Record<string, unknown>[] | undefined) || []} columns={output.columns as string[] | undefined} columnLabels={output.column_labels as Record<string, string> | undefined} />;
  if (kind === 'metrics') return <MetricsOutput metrics={(output.metrics as Record<string, unknown> | undefined) || {}} />;
  if (kind === 'plot_group') return <PlotGroupOutput output={output} onAddToBoard={onAddToBoard} eagerCharts={Boolean(fillContainer)} />;
  if (CHART_KINDS.has(kind)) return <ChartOutput output={output} collectionMode={collectionMode} fillContainer={fillContainer} />;
  return <pre>{JSON.stringify(output.value ?? output, null, 2)}</pre>;
}

type RendererProps = {
  output: Output;
  onAddToBoard?: (output: Output, index: number) => void;
  onInteractiveTableChange?: (nodeId: string, state: InteractiveTableState) => void;
  collectionMode?: boolean;
  active?: boolean;
  fillContainer?: boolean;
  eager?: boolean;
};

export const OutputRenderer = memo(function OutputRenderer({ output, onAddToBoard, onInteractiveTableChange, collectionMode = false, active = true, fillContainer = false, eager = false }: RendererProps) {
  const { elementRef, visible } = useOutputVisibility<HTMLDivElement>(active && !fillContainer && !eager);
  const kind = String(output.kind || 'json');
  const minHeight = CHART_KINDS.has(kind) ? (collectionMode ? 280 : chartHeight(output)) : kind === 'table' ? 230 : 80;
  return <div ref={elementRef} className={`output-viewport ${fillContainer ? 'output-viewport-fill' : ''}`} style={{ minHeight: fillContainer ? 0 : minHeight }}>{fillContainer || eager || visible ? <OutputErrorBoundary output={output}><ImmediateOutput output={output} onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange} collectionMode={collectionMode} fillContainer={fillContainer}/></OutputErrorBoundary> : <div className="output-suspended-placeholder" aria-hidden="true" />}</div>;
});
