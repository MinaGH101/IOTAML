import { Download, Maximize2, PanelRightClose, PanelRightOpen, Pin, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Run } from '../types';

export type Output = Record<string, unknown> & { kind?: string; title?: string; node_id?: string; source_label?: string; branch?: string };
type EChartsType = any;

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
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--text').trim() || '#eaf2ff',
    muted: styles.getPropertyValue('--muted').trim() || '#94a3b8',
    purple: styles.getPropertyValue('--iota-purple').trim() || '#7257f2',
    blue: styles.getPropertyValue('--iota-blue').trim() || '#4c8df7',
    cyan: styles.getPropertyValue('--iota-cyan').trim() || '#31cde3',
    panel: styles.getPropertyValue('--panel').trim() || 'rgba(255,255,255,.04)',
    line: styles.getPropertyValue('--line-strong').trim() || 'rgba(49,205,227,.32)'
  };
}

function loadECharts(): Promise<EChartsType> {
  const w = window as unknown as { echarts?: EChartsType };
  if (w.echarts) return Promise.resolve(w.echarts);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-echarts="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(w.echarts));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js';
    script.async = true;
    script.dataset.echarts = 'true';
    script.onload = () => resolve(w.echarts);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function baseChartOption() {
  const c = plotColors();
  return {
    backgroundColor: 'transparent',
    color: [c.cyan, c.blue, c.purple],
    textStyle: { fontFamily: 'Tahoma, sans-serif', fontSize: 11, color: c.text },
    tooltip: { trigger: 'item', backgroundColor: c.panel, borderColor: c.line, textStyle: { color: c.text } },
    legend: { top: 0, textStyle: { color: c.muted, fontSize: 10 } },
    grid: { left: 48, right: 18, top: 42, bottom: 42, containLabel: true },
    xAxis: { axisLine: { lineStyle: { color: c.line } }, splitLine: { lineStyle: { color: c.line } }, axisLabel: { color: c.muted, fontSize: 10 }, nameTextStyle: { color: c.muted } },
    yAxis: { axisLine: { lineStyle: { color: c.line } }, splitLine: { lineStyle: { color: c.line } }, axisLabel: { color: c.muted, fontSize: 10 }, nameTextStyle: { color: c.muted } }
  };
}


function axisValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function chartSettings(output: Output) {
  return {
    color: String(output.color || ''),
    xMin: axisValue(output.x_min),
    xMax: axisValue(output.x_max),
    yMin: axisValue(output.y_min),
    yMax: axisValue(output.y_max)
  };
}

function applyAxisSettings(option: Record<string, any>, output: Output) {
  const settings = chartSettings(output);
  if (settings.color) option.color = [settings.color, ...(Array.isArray(option.color) ? option.color : [])];
  option.xAxis = { ...(option.xAxis || {}), ...(settings.xMin !== undefined ? { min: settings.xMin } : {}), ...(settings.xMax !== undefined ? { max: settings.xMax } : {}) };
  option.yAxis = { ...(option.yAxis || {}), ...(settings.yMin !== undefined ? { min: settings.yMin } : {}), ...(settings.yMax !== undefined ? { max: settings.yMax } : {}) };
  return option;
}

function EChart({ option, height = 260 }: { option: Record<string, unknown>; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    setFailed(false);

    loadECharts()
      .then((echarts) => {
        if (!alive || !ref.current || !echarts) return;
        chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' });
        setReady(true);
        resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(() => chartRef.current?.resize());
        }) : null;
        if (resizeObserver && ref.current) resizeObserver.observe(ref.current);
      })
      .catch(() => setFailed(true));

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
    window.requestAnimationFrame(() => chartRef.current?.resize());
  }, [ready, option]);

  if (failed) return <div className="empty-state">بارگذاری نمودار ناموفق بود. اتصال اینترنت را بررسی کنید.</div>;
  return <div className="echarts-box" style={{ height }} ref={ref} />;
}

function TableView({ rows, columns }: { rows: Record<string, unknown>[]; columns?: string[] }) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {});
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map((key) => <th key={key}>{key}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{cols.map((key) => <td key={key}>{fmt(row[key])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function MetricsView({ metrics }: { metrics: Record<string, unknown> }) {
  return <div className="metric-grid">{Object.entries(metrics).map(([key, value]) => <div className="metric-card workflow-shell-card" key={key}><span>{key}</span><b>{fmt(value)}</b></div>)}</div>;
}

function ScatterView({ output, points, xKey, yKey, label }: { output: Output; points: Record<string, unknown>[]; xKey: string; yKey: string; label?: string }) {
  const clean = points.map((p) => ({ x: Number(p[xKey]), y: Number(p[yKey]) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return <div className="empty-state">داده‌ای برای رسم نمودار وجود ندارد.</div>;
  const option = {
    ...baseChartOption(),
    tooltip: { ...baseChartOption().tooltip, trigger: 'axis' },
    xAxis: { ...baseChartOption().xAxis, type: 'value', name: xKey },
    yAxis: { ...baseChartOption().yAxis, type: 'value', name: yKey },
    series: [{ type: 'scatter', name: label || yKey, data: clean.map((p) => [p.x, p.y]), symbolSize: Number(output.point_size || 7), emphasis: { focus: 'series' } }]
  };
  return <EChart option={applyAxisSettings(option, output)} />;
}

function BarView({ output, rows, xKey, yKey }: { output: Output; rows: Record<string, unknown>[]; xKey: string; yKey: string }) {
  const limited = rows.slice(0, 35);
  if (limited.length === 0) return <div className="empty-state">داده‌ای برای نمایش وجود ندارد.</div>;
  const option = {
    ...baseChartOption(),
    grid: { left: 130, right: 18, top: 24, bottom: 32, containLabel: true },
    tooltip: { ...baseChartOption().tooltip, trigger: 'axis' },
    xAxis: { ...baseChartOption().xAxis, type: 'value' },
    yAxis: { ...baseChartOption().yAxis, type: 'category', data: limited.map((r) => String(r[xKey])) },
    series: [{ type: 'bar', name: yKey, data: limited.map((r) => Number(r[yKey] ?? 0)), barMaxWidth: 18 }]
  };
  return <EChart option={applyAxisSettings(option, output)} height={Math.max(260, Math.min(520, limited.length * 22 + 70))} />;
}

function HistogramView({ output }: { output: Output }) {
  const counts = (output.counts as number[] | undefined) || [];
  const edges = (output.edges as number[] | undefined) || [];
  const labels = counts.map((_, index) => edges.length > index + 1 ? `${fmt(edges[index])} - ${fmt(edges[index + 1])}` : String(index + 1));
  const option = {
    ...baseChartOption(),
    tooltip: { ...baseChartOption().tooltip, trigger: 'axis' },
    xAxis: { ...baseChartOption().xAxis, type: 'category', name: String(output.column || 'bin'), data: labels, axisLabel: { ...baseChartOption().xAxis.axisLabel, rotate: 35 } },
    yAxis: { ...baseChartOption().yAxis, type: 'value', name: 'count' },
    series: [{ type: 'bar', name: String(output.column || 'histogram'), data: counts, barMaxWidth: 22 }]
  };
  return <EChart option={applyAxisSettings(option, output)} />;
}

function LineView({ output }: { output: Output }) {
  const xs = (output.train_sizes as number[] | undefined) || [];
  const train = (output.train_score_mean as number[] | undefined) || [];
  const test = (output.test_score_mean as number[] | undefined) || [];
  const option = {
    ...baseChartOption(),
    tooltip: { ...baseChartOption().tooltip, trigger: 'axis' },
    xAxis: { ...baseChartOption().xAxis, type: 'category', name: 'train size', data: xs.map(String) },
    yAxis: { ...baseChartOption().yAxis, type: 'value', name: 'score' },
    series: [
      { type: 'line', name: 'train', data: train, smooth: true, symbolSize: 7 },
      { type: 'line', name: 'test', data: test, smooth: true, symbolSize: 7 }
    ]
  };
  return <EChart option={applyAxisSettings(option, output)} />;
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

    if (!labels.length && objectRows.length) {
      labels = Object.keys(objectRows[0]).filter((key) => key !== 'column' && key !== 'index');
    }

    matrix = objectRows.map((row) => labels.map((label) => Number(row[label])));
  }

  if (!labels.length && matrix.length) {
    labels = matrix.map((_, index) => String(index));
  }

  const data = matrix.flatMap((row, y) =>
    row.map((value, x) => [x, y, Number.isFinite(value) ? value : 0])
  );

  if (!labels.length || data.length === 0) {
    return <div className="empty-state">داده‌ای برای نمایش ماتریس وجود ندارد.</div>;
  }

  const values = data.map((item) => Number(item[2])).filter(Number.isFinite);
  const min = Math.min(...values, -1);
  const max = Math.max(...values, 1);
  const crowded = labels.length > 12;
  const c = plotColors();

  const option = {
    ...baseChartOption(),
    tooltip: {
      ...baseChartOption().tooltip,
      position: 'top',
      formatter: (params: any) => {
        const value = params?.value || [];
        return `${labels[value[0]]} × ${labels[value[1]]}<br/>${fmt(value[2])}`;
      }
    },
    grid: { left: 110, right: 24, top: 36, bottom: crowded ? 112 : 82, containLabel: true },
    xAxis: {
      ...baseChartOption().xAxis,
      type: 'category',
      name: 'columns',
      data: labels,
      axisLabel: { ...baseChartOption().xAxis.axisLabel, interval: 0, rotate: crowded ? 50 : 35, fontSize: crowded ? 8 : 10 },
    },
    yAxis: {
      ...baseChartOption().yAxis,
      type: 'category',
      name: 'columns',
      data: labels,
      axisLabel: { ...baseChartOption().yAxis.axisLabel, fontSize: crowded ? 8 : 10 },
    },
    dataZoom: crowded ? [
      { type: 'slider', xAxisIndex: 0, bottom: 42, height: 18, textStyle: { color: c.muted } },
      { type: 'slider', yAxisIndex: 0, right: 0, width: 16, textStyle: { color: c.muted } },
      { type: 'inside', xAxisIndex: 0 },
      { type: 'inside', yAxisIndex: 0 },
    ] : [],
    visualMap: {
      min,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: c.muted },
      inRange: { color: [c.purple, c.blue, c.cyan] },
    },
    series: [
      {
        type: 'heatmap',
        name: 'matrix',
        data,
        label: { show: labels.length <= 10, color: c.text, fontSize: 9 },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      },
    ],
  };

  return <EChart option={option} height={Math.max(340, Math.min(720, labels.length * 28 + 150))} />;
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
              <button className="tiny-action" type="button" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(plot, index)}><Download size={12} /></button>
              {onAddToBoard && <button className="tiny-action" type="button" title="افزودن همین نمودار به برد" aria-label="افزودن همین نمودار به برد" onClick={() => onAddToBoard(plot, index)}><Pin size={12} /></button>}
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
            <button className="modal-close" title="بستن" onClick={() => setFocused(false)}><X size={16}/></button>
            <div className="output-fullscreen-head">
              <h3>{String(output.title || title || 'نمایش کامل')}</h3>
              <button className="tiny-action" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(output, index)}><Download size={13}/></button>
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
        <button className="tiny-action" type="button" onClick={onToggle} title="کوچک کردن خروجی نود" aria-label="کوچک کردن خروجی نود"><PanelRightClose size={13} /></button>
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
