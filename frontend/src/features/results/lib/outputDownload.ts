import type { Output } from '../../../workspace/_model/output';

export function rowsToCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {});
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [cols.map(escapeCell).join(','), ...rows.map((row) => cols.map((column) => escapeCell(row[column])).join(','))].join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadOutput(output: Output, index: number) {
  const title = String(output.title || `output-${index}`).replace(/[\\/:*?"<>|\s]+/g, '-');
  const rows = output.rows as Record<string, unknown>[] | undefined;
  const columns = output.columns as string[] | undefined;
  if (Array.isArray(rows)) return downloadText(`${title}.csv`, rowsToCsv(rows, columns), 'text/csv;charset=utf-8');
  if (Array.isArray(output.points)) return downloadText(`${title}.csv`, rowsToCsv(output.points as Record<string, unknown>[]), 'text/csv;charset=utf-8');
  if (Array.isArray(output.plots)) return downloadText(`${title}.json`, JSON.stringify(output.plots, null, 2), 'application/json;charset=utf-8');
  return downloadText(`${title}.json`, JSON.stringify(output, null, 2), 'application/json;charset=utf-8');
}
