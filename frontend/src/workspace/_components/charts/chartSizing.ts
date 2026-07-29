import type { Output } from '../../_model/output';

export function chartHeight(output: Output) {
  const kind = String(output.kind || 'plot');
  if (kind === 'bar') {
    const rows = (output.rows as unknown[] | undefined) || [];
    return Math.max(280, Math.min(900, rows.length * 25 + 100));
  }
  if (kind === 'bar_plot' && String(output.orientation || 'vertical') === 'horizontal') {
    const categories = (output.categories as unknown[] | undefined) || [];
    return Math.max(300, Math.min(900, categories.length * 32 + 110));
  }
  if (kind === 'heatmap' || kind === 'matrix') {
    const labels = (output.labels as unknown[] | undefined) || [];
    return Math.max(300, Math.min(820, labels.length * 34 + 100));
  }
  if (kind === 'dendrogram') {
    const labels = (output.labels as unknown[] | undefined) || [];
    return Math.max(340, Math.min(1000, labels.length * 22 + 100));
  }
  if (kind === 'stair_outlier') return 330;
  if (kind === 'boxplot') return 285;
  return 300;
}

