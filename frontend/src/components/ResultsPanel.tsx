import { Download, Maximize2, PanelRightClose, PanelRightOpen, Pin, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import type { Run } from '../types';

export type Output = Record<string, unknown> & { kind?: string; title?: string; node_id?: string; source_label?: string; branch?: string };

type ChartPoint = { id: string | number; x: number; y: number };

function fmt(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('fa-IR') : value.toFixed(4);
  if (value === null || value === undefined) return '-';
  return String(value);
}

const statusLabel: Record<string, string> = { queued: 'در صف', running: 'در حال اجرا', succeeded: 'موفق', failed: 'ناموفق' };

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
  // Keep MUI X colors bound to CSS variables so theme changes and page refreshes
  // cannot leave charts/tables with colors captured from the previous theme.
  return {
    text: 'var(--text)',
    muted: 'var(--muted)',
    purple: 'var(--iota-purple)',
    blue: 'var(--iota-blue)',
    cyan: 'var(--iota-cyan)',
    panel: 'var(--results-surface-strong, var(--panel-solid))',
    line: 'var(--line)',
    lineStrong: 'var(--line-strong)',
    bg: 'var(--iota-popup-bg, var(--panel-solid))'
  };
}

function axisValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function chartColor(output: Output, fallbackIndex = 0) {
  const c = plotColors();
  const palette = [c.cyan, c.blue, c.purple];
  const color = String(output.color || '').trim();
  return color || palette[fallbackIndex % palette.length];
}

function chartSx() {
  const c = plotColors();
  return {
    direction: 'ltr',
    color: c.text,
    backgroundColor: 'transparent',
    '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: c.lineStrong },
    '& .MuiChartsAxis-root text, & .MuiChartsAxis-tickLabel, & .MuiChartsAxis-label, & .MuiChartsLegend-label': {
      fill: `${c.muted} !important`,
      color: `${c.muted} !important`,
      fontSize: '12px !important'
    },
    '& .MuiChartsGrid-line': { stroke: c.line, strokeDasharray: '3 3' },
    '& .MuiChartsTooltip-paper': { background: c.panel, color: c.text, border: `1px solid ${c.lineStrong}` }
  };
}

function chartMargin() {
  return { left: 64, right: 22, top: 32, bottom: 58 };
}

function MuiChartShell({ children, height = 280 }: { children: React.ReactNode; height?: number }) {
  return <div className="mui-chart-wrap" style={{ height }}>{children}</div>;
}

function TableView({ rows, columns }: { rows: Record<string, unknown>[]; columns?: string[] }) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {});
  const c = plotColors();
  const gridRows = rows.map((row, index) => ({ __iota_row_id: index, ...row }));
  const gridColumns: GridColDef[] = cols.map((field) => ({
    field,
    headerName: field,
    minWidth: 130,
    flex: 1,
    sortable: true,
    valueGetter: (_value, row) => (row as Record<string, unknown>)[field],
    valueFormatter: (value: unknown) => fmt(value)
  }));

  return (
    <div className="mui-table-wrap">
      <DataGrid
        rows={gridRows}
        columns={gridColumns}
        getRowId={(row) => row.__iota_row_id as number}
        density="compact"
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: Math.min(25, Math.max(5, rows.length || 5)), page: 0 } } }}
        sx={{
          border: 0,
          color: c.text,
          fontFamily: 'inherit',
          fontSize: 11,
          direction: 'ltr',
          backgroundColor: 'var(--results-surface, transparent)',
          '--DataGrid-containerBackground': 'var(--results-header-bg, transparent)',
          '--DataGrid-t-header-background-base': 'var(--results-header-bg, transparent)',
          '--DataGrid-rowBorderColor': c.line,
          '& .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent': {
            backgroundColor: 'var(--results-surface, transparent)',
            color: `${c.text} !important`
          },
          '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': {
            borderBottom: `1px solid ${c.lineStrong}`,
            color: `${c.text} !important`,
            backgroundColor: 'var(--results-header-bg, transparent) !important'
          },
          '& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-columnHeaderTitleContainer': {
            color: `${c.text} !important`,
            fontWeight: 800
          },
          '& .MuiDataGrid-row': {
            color: `${c.text} !important`,
            borderBottom: `1px solid ${c.line}`,
            backgroundColor: 'var(--results-row-bg, transparent)'
          },
          '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'var(--results-row-alt-bg, color-mix(in srgb, var(--text) 4%, transparent))' },
          '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--results-row-hover-bg, color-mix(in srgb, var(--iota-cyan) 7%, transparent))' },
          '& .MuiDataGrid-cell, & .MuiDataGrid-cellContent': {
            color: `${c.text} !important`,
            borderBottom: 0,
            outline: 'none !important'
          },
          '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows, & .MuiDataGrid-footerContainer': {
            color: `${c.muted} !important`,
            borderTop: `1px solid ${c.line}`,
            backgroundColor: 'var(--results-footer-bg, var(--results-header-bg, transparent))'
          },
          '& .MuiSvgIcon-root': { color: `${c.muted} !important` }
        }}
      />
    </div>
  );
}

function MetricsView({ metrics }: { metrics: Record<string, unknown> }) {
  return <div className="metric-grid">{Object.entries(metrics).map(([key, value]) => <div className="metric-card workflow-shell-card" key={key}><span>{key}</span><b>{fmt(value)}</b></div>)}</div>;
}

function ScatterView({ output, points, xKey, yKey, label }: { output: Output; points: Record<string, unknown>[]; xKey: string; yKey: string; label?: string }) {
  const clean: ChartPoint[] = points
    .map((p, index) => ({ id: index, x: Number(p[xKey]), y: Number(p[yKey]) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return <div className="empty-state">داده‌ای برای رسم نمودار وجود ندارد.</div>;

  return (
    <MuiChartShell>
      <ScatterChart
        series={[{ label: label || yKey, data: clean, color: chartColor(output), markerSize: Number(output.point_size || 7) } as any]}
        xAxis={[{ label: xKey, min: axisValue(output.x_min), max: axisValue(output.x_max) } as any]}
        yAxis={[{ label: yKey, min: axisValue(output.y_min), max: axisValue(output.y_max) } as any]}
        margin={chartMargin()}
        grid={{ vertical: true, horizontal: true }}
        sx={chartSx()}
      />
    </MuiChartShell>
  );
}

function BarView({ output, rows, xKey, yKey }: { output: Output; rows: Record<string, unknown>[]; xKey: string; yKey: string }) {
  const limited = rows.slice(0, 35);
  if (limited.length === 0) return <div className="empty-state">داده‌ای برای نمایش وجود ندارد.</div>;
  const labels = limited.map((r) => String(r[xKey]));
  const values = limited.map((r) => Number(r[yKey] ?? 0));
  const height = Math.max(280, Math.min(620, labels.length * 24 + 120));

  return (
    <MuiChartShell height={height}>
      <BarChart
        layout="horizontal"
        yAxis={[{ scaleType: 'band', data: labels, label: xKey } as any]}
        xAxis={[{ label: yKey } as any]}
        series={[{ label: yKey, data: values, color: chartColor(output) }]}
        margin={{ left: 132, right: 24, top: 28, bottom: 44 }}
        grid={{ vertical: true }}
        sx={chartSx()}
      />
    </MuiChartShell>
  );
}

function HistogramView({ output }: { output: Output }) {
  const counts = (output.counts as number[] | undefined) || [];
  const edges = (output.edges as number[] | undefined) || [];
  const labels = counts.map((_, index) => edges.length > index + 1 ? `${fmt(edges[index])} - ${fmt(edges[index + 1])}` : String(index + 1));
  if (!counts.length) return <div className="empty-state">داده‌ای برای رسم Histogram وجود ندارد.</div>;

  return (
    <MuiChartShell>
      <BarChart
        xAxis={[{ scaleType: 'band', data: labels, label: String(output.column || 'bin'), tickLabelStyle: { angle: 35, textAnchor: 'start', fontSize: 10 } } as any]}
        yAxis={[{ label: 'count' } as any]}
        series={[{ label: String(output.column || 'histogram'), data: counts, color: chartColor(output) }]}
        margin={chartMargin()}
        grid={{ horizontal: true }}
        sx={chartSx()}
      />
    </MuiChartShell>
  );
}

function LineView({ output }: { output: Output }) {
  const xs = (output.train_sizes as number[] | undefined) || [];
  const train = (output.train_score_mean as number[] | undefined) || [];
  const test = (output.test_score_mean as number[] | undefined) || [];
  if (!xs.length) return <div className="empty-state">داده‌ای برای رسم Line chart وجود ندارد.</div>;
  const c = plotColors();
  return (
    <MuiChartShell>
      <LineChart
        xAxis={[{ scaleType: 'point', data: xs.map(String), label: 'train size' } as any]}
        yAxis={[{ label: 'score', min: axisValue(output.y_min), max: axisValue(output.y_max) } as any]}
        series={[
          { label: 'train', data: train, color: chartColor(output, 0), curve: 'linear' },
          { label: 'test', data: test, color: String(output.color_secondary || '') || c.purple, curve: 'linear' }
        ] as any}
        margin={chartMargin()}
        grid={{ vertical: true, horizontal: true }}
        sx={chartSx()}
      />
    </MuiChartShell>
  );
}

function MatrixView({ output }: { output: Output }) {
  const rawMatrix = output.matrix as unknown;
  const rawRows = output.rows as unknown;
  let labels = ((output.labels as unknown[] | undefined) || []).map(String);
  let matrix: number[][] = [];

  if (Array.isArray(rawMatrix) && rawMatrix.every((row) => Array.isArray(row))) {
    matrix = rawMatrix.map((row) => (row as unknown[]).map((value) => Number(value)));
  } else {
    const objectRows =
      Array.isArray(rawMatrix) && rawMatrix.every((row) => row && typeof row === 'object' && !Array.isArray(row))
        ? rawMatrix as Record<string, unknown>[]
        : Array.isArray(rawRows) && rawRows.every((row) => row && typeof row === 'object' && !Array.isArray(row))
          ? rawRows as Record<string, unknown>[]
          : [];
    if (!labels.length && objectRows.length) labels = Object.keys(objectRows[0]).filter((key) => key !== 'column' && key !== 'index');
    matrix = objectRows.map((row) => labels.map((label) => Number(row[label])));
  }

  if (!labels.length && matrix.length) labels = matrix.map((_, index) => String(index));
  if (!labels.length || !matrix.length) return <div className="empty-state">داده‌ای برای نمایش ماتریس وجود ندارد.</div>;

  const rows = matrix.map((values, index) => ({ column: labels[index] || String(index), ...Object.fromEntries(labels.map((label, colIndex) => [label, values[colIndex]])) }));
  return <TableView rows={rows} columns={['column', ...labels]} />;
}

function BoxView({ output }: { output: Output }) {
  const q = (output.quantiles || {}) as Record<string, unknown>;
  const rows = Object.keys(q).length
    ? Object.entries(q).map(([stat, value]) => ({ stat, value }))
    : [
        { stat: 'min', value: output.min },
        { stat: 'q1', value: output.q1 },
        { stat: 'median', value: output.median },
        { stat: 'q3', value: output.q3 },
        { stat: 'max', value: output.max },
      ].filter((row) => row.value !== undefined);

  if (rows.length === 0) return <div className="empty-state">داده‌ای برای نمایش باکس‌پلات وجود ندارد.</div>;

  const values = rows.map((row) => Number(row.value));
  if (values.every(Number.isFinite)) {
    return (
      <MuiChartShell height={240}>
        <BarChart
          xAxis={[{ scaleType: 'band', data: rows.map((row) => row.stat) } as any]}
          yAxis={[{} as any]}
          series={[{ label: String(output.column || 'boxplot'), data: values, color: chartColor(output) }]}
          margin={{ left: 54, right: 18, top: 24, bottom: 38 }}
          grid={{ horizontal: true }}
          sx={chartSx()}
        />
      </MuiChartShell>
    );
  }

  return <TableView rows={rows} columns={['stat', 'value']} />;
}

function plotSubtitle(plot: Output) {
  const kind = String(plot.kind || 'plot');
  if (kind === 'scatter') return `${String(plot.x || 'x')} × ${String(plot.y || 'y')}`;
  if (kind === 'histogram' || kind === 'boxplot') return String(plot.column || kind);
  return kind;
}

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
          <div className="plot-group-item" key={`${String(plot.title || plot.kind || 'plot')}-${index}`}>
            <div className="plot-group-item-head">
              <b>{String(plot.title || `Plot ${index + 1}`)}</b>
              <span>{plotSubtitle(plot)}</span>
              <button className="tiny-action icon-action" type="button" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(plot, index)}><Download size={12} /></button>
              {onAddToBoard && <button className="tiny-action icon-action" type="button" title="افزودن همین نمودار به برد" aria-label="افزودن همین نمودار به برد" onClick={() => onAddToBoard(plot, index)}><Pin size={12} /></button>}
            </div>
            <OutputBody output={plot} onAddToBoard={onAddToBoard} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OutputBody({ output, onAddToBoard }: { output: Output; onAddToBoard?: (output: Output, index: number) => void }) {
  const kind = String(output.kind || 'json');
  if (kind === 'table') return <TableView rows={(output.rows as Record<string, unknown>[] | undefined) || []} columns={output.columns as string[] | undefined} />;
  if (kind === 'metrics') return <MetricsView metrics={(output.metrics as Record<string, unknown> | undefined) || {}} />;
  if (kind === 'scatter') return <ScatterView output={output} points={(output.points as Record<string, unknown>[] | undefined) || (output.rows as Record<string, unknown>[] | undefined) || []} xKey={String(output.x || 'x')} yKey={String(output.y || 'y')} label={String(output.source_label || output.branch || output.title || '')} />;
  if (kind === 'plot_group') return <PlotGroupView output={output} onAddToBoard={onAddToBoard} />;
  if (kind === 'histogram') return <HistogramView output={output} />;
  if (kind === 'bar') return <BarView output={output} rows={(output.rows as Record<string, unknown>[] | undefined) || []} xKey={String(output.xKey || 'feature')} yKey={String(output.yKey || 'importance')} />;
  if (kind === 'line') return <LineView output={output} />;
  if (kind === 'matrix') return <MatrixView output={output} />;
  if (kind === 'boxplot') return <BoxView output={output} />;
  return <pre>{JSON.stringify(output.value ?? output, null, 2)}</pre>;
}

export function OutputCard({ output, index, variant = 'panel', onAddToBoard }: { output: Output; index: number; variant?: 'panel' | 'modal'; onAddToBoard?: (output: Output, index: number) => void }) {
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
}

function displayTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

export function ResultsPanel({ run, selectedNodeId, collapsed, onToggle, onAddToBoard }: { run: Run | null; selectedNodeId: string | null; collapsed: boolean; onToggle: () => void; onAddToBoard?: (output: Output, index: number) => void }) {
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
          {run.error && <div className="error-box">{run.error}</div>}
          {!selectedNodeId && comparison.length > 0 && <div className="output-card workflow-shell-card"><div className="output-head"><b>مقایسه شاخه‌ها</b><button title="دانلود" aria-label="دانلود" onClick={() => downloadText('comparison.csv', rowsToCsv(comparison), 'text/csv;charset=utf-8')}><Download size={13}/></button></div><TableView rows={comparison} /></div>}
          {selectedNodeId && outputs.length === 0 && run.status === 'succeeded' && <div className="empty-state">برای این نود خروجی قابل نمایش پیدا نشد. نود را به مسیر اجرا وصل کنید و دوباره Run بزنید.</div>}
          {outputs.map((output, index) => <OutputCard output={output} index={index} onAddToBoard={onAddToBoard} key={`${output.node_id}-${output.path_index}-${index}`} />)}
        </>}
      </div>
    </section>
  );
}
