import { Download, Maximize2, PanelRightClose, PanelRightOpen, Pin, X } from 'lucide-react';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import type { Run } from '../../shared/_types';
import type { Output } from '../_model/output';

export type { Output } from '../_model/output';

const AmChartsOutput = lazy(() => import('./charts/AmChartsOutput'));

function fmt(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('fa-IR') : value.toFixed(4);
  if (value === null || value === undefined) return '-';
  return String(value);
}

const statusLabel: Record<string, string> = { queued: 'در صف', running: 'در حال اجرا', succeeded: 'موفق', failed: 'ناموفق', cancelled: 'لغوشده', timed_out: 'پایان زمان مجاز' };

function rowsToCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {});
  const esc = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [cols.map(esc).join(','), ...rows.map((row) => cols.map((col) => esc(row[col])).join(','))].join('\n');
}

function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOutput(output: Output, index: number) {
  const title = String(output.title || `output-${index}`).replace(/[\\/:*?"<>|\s]+/g, '-');
  const rows = output.rows as Record<string, unknown>[] | undefined;
  const columns = output.columns as string[] | undefined;
  if (Array.isArray(rows)) return downloadText(`${title}.csv`, rowsToCsv(rows, columns), 'text/csv;charset=utf-8');
  if (Array.isArray(output.points)) return downloadText(`${title}.csv`, rowsToCsv(output.points as Record<string, unknown>[]), 'text/csv;charset=utf-8');
  if (Array.isArray(output.plots)) return downloadText(`${title}.json`, JSON.stringify(output.plots, null, 2), 'application/json;charset=utf-8');
  downloadText(`${title}.json`, JSON.stringify(output, null, 2), 'application/json;charset=utf-8');
}

export function normalizeOutputs(run: Run | null, selectedNodeId: string | null): Output[] {
  if (!run?.artifacts) return [];
  const artifacts = run.artifacts as Record<string, unknown>;
  const raw = artifacts.node_outputs as Record<string, Output | Output[]> | undefined;
  const outputs = raw ? Object.values(raw).flatMap((value) => Array.isArray(value) ? value : [value]) : [];
  const clean = outputs.filter((output): output is Output => Boolean(output && typeof output === 'object' && !Array.isArray(output)));
  return selectedNodeId ? clean.filter((output) => String(output.node_id || '') === selectedNodeId) : clean;
}

function plotColors() {
  // Keep table colors bound to CSS variables so theme changes remain consistent.
  return {
    text: 'var(--theme-text)',
    muted: 'var(--theme-text-muted)',
    purple: 'var(--theme-secondary)',
    blue: 'var(--theme-secondary)',
    cyan: 'var(--theme-primary)',
    success: 'var(--theme-success)',
    warning: 'var(--theme-warning)',
    panel: 'var(--theme-popup-bg, var(--theme-popup-bg))',
    line: 'var(--theme-divider)',
    lineStrong: 'var(--theme-control-border)',
    bg: 'var(--theme-popup-bg, var(--theme-popup-bg))'
  };
}

const DATA_GRID_PAGE_SIZES = [5, 10, 12, 25, 50, 100];

function initialPageSize(rowCount: number) {
  if (rowCount <= 5) return 5;
  if (rowCount <= 10) return 10;
  if (rowCount <= 12) return 12;
  return 25;
}

const TableView = memo(function TableView({ rows, columns }: { rows: Record<string, unknown>[]; columns?: string[] }) {
  const cols = useMemo(() => columns?.length ? columns : Object.keys(rows[0] || {}), [columns, rows]);
  const c = plotColors();
  const gridRows = useMemo(() => rows.map((row, index) => ({ __iota_row_id: index, ...row })), [rows]);
  const gridColumns = useMemo<GridColDef[]>(() => cols.map((field) => ({
    field,
    headerName: field,
    minWidth: 130,
    flex: 1,
    sortable: true,
    valueGetter: (_value, row) => (row as Record<string, unknown>)[field],
    valueFormatter: (value: unknown) => fmt(value),
  })), [cols]);
  const pageSize = initialPageSize(rows.length);

  return (
    <div className="mui-table-wrap">
      <DataGrid
        rows={gridRows}
        columns={gridColumns}
        getRowId={(row) => row.__iota_row_id as number}
        density="compact"
        disableRowSelectionOnClick
        pageSizeOptions={DATA_GRID_PAGE_SIZES}
        initialState={{ pagination: { paginationModel: { pageSize, page: 0 } } }}
        sx={{
          border: 0,
          color: c.text,
          fontFamily: 'inherit',
          fontSize: 11,
          direction: 'ltr',
          backgroundColor: 'var(--theme-panel-bg, transparent)',
          '--DataGrid-containerBackground': 'var(--theme-table-header, transparent)',
          '--DataGrid-t-header-background-base': 'var(--theme-table-header, transparent)',
          '--DataGrid-rowBorderColor': c.line,
          '& .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent': {
            backgroundColor: 'var(--theme-panel-bg, transparent)',
            color: `${c.text} !important`
          },
          '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': {
            borderBottom: `1px solid ${c.lineStrong}`,
            color: `${c.text} !important`,
            backgroundColor: 'var(--theme-table-header, transparent) !important'
          },
          '& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-columnHeaderTitleContainer': {
            color: `${c.text} !important`,
            fontWeight: 800
          },
          '& .MuiDataGrid-row': {
            color: `${c.text} !important`,
            borderBottom: `1px solid ${c.line}`,
            backgroundColor: 'var(--theme-table-row, transparent)'
          },
          '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'var(--theme-table-row-alt, color-mix(in srgb, var(--theme-text) 4%, transparent))' },
          '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--theme-table-row-hover, color-mix(in srgb, var(--theme-primary) 7%, transparent))' },
          '& .MuiDataGrid-cell, & .MuiDataGrid-cellContent': {
            color: `${c.text} !important`,
            borderBottom: 0,
            outline: 'none !important'
          },
          '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows, & .MuiDataGrid-footerContainer': {
            color: `${c.muted} !important`,
            borderTop: `1px solid ${c.line}`,
            backgroundColor: 'var(--theme-table-footer, var(--theme-table-header, transparent))'
          },
          '& .MuiSvgIcon-root': { color: `${c.muted} !important` }
        }}
      />
    </div>
  );
});

function MetricsView({ metrics }: { metrics: Record<string, unknown> }) {
  return <div className="metric-grid">{Object.entries(metrics).map(([key, value]) => <div className="metric-card workflow-shell-card" key={key}><span>{key}</span><b>{fmt(value)}</b></div>)}</div>;
}

function ChartLoadingPlaceholder() {
  return <div className="amchart-loading" aria-live="polite"><span/><span/><span/></div>;
}

function AmChartBody({ output, collectionMode = false }: { output: Output; collectionMode?: boolean }) {
  return (
    <Suspense fallback={<ChartLoadingPlaceholder />}>
      <AmChartsOutput output={output} collectionMode={collectionMode} />
    </Suspense>
  );
}

function plotSubtitle(plot: Output) {
  const kind = String(plot.kind || 'plot');
  if (kind === 'scatter') return `${String(plot.x || 'x')} × ${String(plot.y || 'y')}`;
  if (['histogram', 'boxplot', 'pp_plot', 'stair_outlier'].includes(kind)) return String(plot.column || kind);
  if (kind === 'bar_plot') return String(plot.category_column || kind);
  return kind;
}


const LazyPlotItem = memo(function LazyPlotItem({ plot, index, onAddToBoard }: { plot: Output; index: number; onAddToBoard?: (output: Output, index: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(index < 3);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, { rootMargin: '650px 0px', threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="plot-group-item" style={{ minHeight: 360 }}>
      <div className="plot-group-item-head">
        <b>{String(plot.title || `Plot ${index + 1}`)}</b>
        <span>{plotSubtitle(plot)}</span>
        <button className="tiny-action icon-action" type="button" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(plot, index)}><Download size={12} /></button>
        {onAddToBoard && <button className="tiny-action icon-action" type="button" title="افزودن همین نمودار به برد" aria-label="افزودن همین نمودار به برد" onClick={() => onAddToBoard(plot, index)}><Pin size={12} /></button>}
      </div>
      {visible ? <OutputBody output={plot} onAddToBoard={onAddToBoard} collectionMode /> : <div className="plot-group-lazy-placeholder">نمودار نزدیک محدوده دید فعال می‌شود.</div>}
    </div>
  );
});

function PlotGroupView({ output, onAddToBoard }: { output: Output; onAddToBoard?: (output: Output, index: number) => void }) {
  const plots = Array.isArray(output.plots) ? output.plots.filter((plot): plot is Output => Boolean(plot && typeof plot === 'object' && !Array.isArray(plot))) : [];
  if (!plots.length) return <div className="empty-state">نموداری برای نمایش در این پنجره وجود ندارد.</div>;
  return (
    <div className="plot-group-window workflow-shell-card">
      <div className="plot-group-head">
        <b>{plots.length.toLocaleString('fa-IR')} نمودار در این نود</b>
        {onAddToBoard && <button className="tiny-action" type="button" onClick={() => onAddToBoard(output, 0)}><Pin size={12} />افزودن کل پنجره</button>}
      </div>
      <div className="plot-group-scroll">
        {plots.map((plot, index) => (
          <LazyPlotItem plot={plot} index={index} onAddToBoard={onAddToBoard} key={`${String(plot.title || plot.kind || 'plot')}-${index}`} />
        ))}
      </div>
    </div>
  );
}

const AMCHART_KINDS = new Set(['scatter', 'histogram', 'bar', 'line', 'heatmap', 'matrix', 'boxplot', 'bar_plot', 'pp_plot', 'stair_outlier']);

export const OutputBody = memo(function OutputBody({ output, onAddToBoard, collectionMode = false }: { output: Output; onAddToBoard?: (output: Output, index: number) => void; collectionMode?: boolean }) {
  const kind = String(output.kind || 'json');
  if (kind === 'table') return <TableView rows={(output.rows as Record<string, unknown>[] | undefined) || []} columns={output.columns as string[] | undefined} />;
  if (kind === 'metrics') return <MetricsView metrics={(output.metrics as Record<string, unknown> | undefined) || {}} />;
  if (kind === 'plot_group') return <PlotGroupView output={output} onAddToBoard={onAddToBoard} />;
  if (AMCHART_KINDS.has(kind)) return <AmChartBody output={output} collectionMode={collectionMode} />;
  return <pre>{JSON.stringify(output.value ?? output, null, 2)}</pre>;
});

export const OutputCard = memo(function OutputCard({ output, index, variant = 'panel', onAddToBoard }: { output: Output; index: number; variant?: 'panel' | 'modal'; onAddToBoard?: (output: Output, index: number) => void }) {
  const [focused, setFocused] = useState(false);
  const title = displayTitle(output, index);
  const cardClass = variant === 'modal' ? 'modal-output-card output-card workflow-shell-card' : 'output-card workflow-shell-card';

  return (
    <>
      <div className={cardClass}>
        <div className="output-head">
          <b>{title}</b>
          <span>{String(output.kind || 'json')}</span>
          <button title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(output, index)}><Download size={13}/></button>
          {onAddToBoard && <button title="افزودن به Analysis Board" aria-label="افزودن به Analysis Board" onClick={() => onAddToBoard(output, index)}><Pin size={13}/></button>}
          <button title="نمایش کامل" aria-label="نمایش کامل" onClick={() => setFocused(true)}><Maximize2 size={13}/></button>
        </div>
        <div className="output-body"><OutputBody output={output} onAddToBoard={onAddToBoard} /></div>
      </div>
      {focused && createPortal(
        <div className="modal-backdrop workflow-shell-backdrop output-fullscreen-backdrop" onClick={() => setFocused(false)}>
          <div className="modal-card workflow-shell-popup output-fullscreen-card" onClick={(event) => event.stopPropagation()}>
            <div className="output-fullscreen-head">
              <h3>{String(output.title || title || 'نمایش کامل')}</h3>
              <div className="output-fullscreen-actions">
                <button className="tiny-action icon-action" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(output, index)}><Download size={13}/></button>
                <button className="modal-close" title="بستن" aria-label="بستن" onClick={() => setFocused(false)}><X size={16}/></button>
              </div>
            </div>
            <div className="output-fullscreen-body"><OutputBody output={output} onAddToBoard={onAddToBoard} /></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

function displayTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

export const ResultsPanel = memo(function ResultsPanel({ run, selectedNodeId, collapsed, onToggle, onAddToBoard }: { run: Run | null; selectedNodeId: string | null; collapsed: boolean; onToggle: () => void; onAddToBoard?: (output: Output, index: number) => void }) {
  const comparison = (run?.artifacts?.comparison || []) as Array<Record<string, unknown>>;
  const outputs = useMemo(() => normalizeOutputs(run, selectedNodeId), [run, selectedNodeId]);

  if (collapsed) {
    return (
      <section className="results-panel results-panel-collapsed workflow-shell-panel">
        <button className="results-mini-toggle" type="button" onClick={onToggle} title="باز کردن خروجی نود" aria-label="باز کردن خروجی نود"><PanelRightOpen size={15} /></button>
      </section>
    );
  }

  return (
    <section className="results-panel workflow-shell-panel">
      <div className="panel-title results-title">
        <span>خروجی نود انتخاب‌شده</span>
        <button className="tiny-action icon-action" type="button" onClick={onToggle} title="کوچک کردن خروجی نود" aria-label="کوچک کردن خروجی نود"><PanelRightClose size={13} /></button>
      </div>
      <div className="results-scroll">
        {!selectedNodeId && <div className="empty-state">برای دیدن خروجی فقط همان نود، روی یک نود کلیک کنید.</div>}
        {selectedNodeId && !run && <div className="empty-state">جریان را اجرا کنید تا خروجی این نود نمایش داده شود.</div>}
        {run && <>
          <div className={`status ${run.status}`}>{statusLabel[run.status] ?? run.status}</div>
          <div className="run-progress-summary">
            <span>{Math.round(Number(run.progress?.percent || 0))}%</span>
            <progress max="100" value={Number(run.progress?.percent || 0)} />
            <small>{run.progress?.nodes_finished || 0}/{run.progress?.nodes_total || 0} نود · تلاش {run.attempts}/{run.max_attempts}</small>
          </div>
          {run.error && <div className="error-box">{run.error}</div>}
          {run.logs && run.logs.length > 0 && <details className="run-log-details"><summary>گزارش اجرای سیستم</summary><pre>{run.logs.slice(-50).map((entry) => `${entry.timestamp} [${entry.level}] ${entry.message}`).join('\n')}</pre></details>}
          {!selectedNodeId && comparison.length > 0 && <div className="output-card workflow-shell-card"><div className="output-head"><b>مقایسه شاخه‌ها</b><button title="دانلود" aria-label="دانلود" onClick={() => downloadText('comparison.csv', rowsToCsv(comparison), 'text/csv;charset=utf-8')}><Download size={13}/></button></div><TableView rows={comparison} /></div>}
          {selectedNodeId && outputs.length === 0 && run.status === 'succeeded' && <div className="empty-state">برای این نود خروجی قابل نمایش پیدا نشد. نود را به مسیر اجرا وصل کنید و دوباره Run بزنید.</div>}
          {outputs.map((output, index) => <OutputCard output={output} index={index} onAddToBoard={onAddToBoard} key={`${output.node_id}-${output.path_index}-${index}`} />)}
        </>}
      </div>
    </section>
  );
});
