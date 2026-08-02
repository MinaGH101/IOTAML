import { readThemeColor } from '../../../shared/_utils/appShared';
import { friendlyOptionLabel, toggleItem } from './parameterModel';

export function PillPicker({ items, selected, onChange, empty }: { items: string[]; selected: string[]; onChange: (items: string[]) => void; empty?: string }) {
  if (items.length === 0) return <div className="empty-state small">{empty || 'گزینه‌ای برای انتخاب وجود ندارد.'}</div>;
  return <div className="pill-picker workflow-shell-card">{items.map((item) => <button type="button" key={item} className={`choice-pill ${selected.includes(item) ? 'active' : ''}`} onClick={() => onChange(toggleItem(selected, item))}>{friendlyOptionLabel(item, item)}</button>)}</div>;
}

function seriesColorMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, color]) => [key, String(color || '')]));
}

export function SeriesColorsEditor({ rows, value, onChange }: { rows: string[]; value: unknown; onChange: (colors: Record<string, string>) => void }) {
  const colors = seriesColorMap(value);
  const fallbacks = ['--theme-plot-default', '--theme-secondary', '--theme-success', '--theme-warning', '--theme-danger', '--theme-primary'].map(readThemeColor);
  if (!rows.length) return <div className="empty-state small">ابتدا یک یا چند ردیف Y را انتخاب کنید.</div>;
  return <div className="series-colors-editor workflow-shell-card">{rows.map((row, index) => (
    <label className="series-color-row" key={row}>
      <span dir="ltr">{row}</span>
      <input type="color" value={colors[row] || fallbacks[index % fallbacks.length]} onChange={(event) => onChange({ ...colors, [row]: event.target.value })} />
    </label>
  ))}</div>;
}
