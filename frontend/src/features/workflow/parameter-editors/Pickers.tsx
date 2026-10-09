import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { readThemeColor } from '../../../shared/_utils/appShared';
import { SearchField } from '../../../shared/ui';
import { friendlyOptionLabel } from './parameterModel';

export function PillPicker({ items, selected, onChange, empty, maxSelected }: { items: string[]; selected: string[]; onChange: (items: string[]) => void; empty?: string; maxSelected?: number }) {
  return <MultiSelect options={items.map((item) => ({ value: item, label: friendlyOptionLabel(item, item) }))} selected={selected} onChange={onChange} empty={empty} maxSelected={maxSelected} />;
}

export type MultiSelectOption = { value: string; label: string; description?: string };

export function MultiSelect({ options, selected, onChange, empty, maxSelected }: { options: MultiSelectOption[]; selected: string[]; onChange: (items: string[]) => void; empty?: string; maxSelected?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const optionByValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const allSelected = options.length > 0 && options.every((option) => selectedSet.has(option.value));
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fa');
    return term ? options.filter((option) => `${option.label} ${option.description || ''}`.toLocaleLowerCase('fa').includes(term)) : options;
  }, [options, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const remove = (value: string) => onChange(selected.filter((item) => item !== value));
  const toggleAll = () => onChange(allSelected ? [] : options.slice(0, maxSelected).map((option) => option.value));
  const toggle = (value: string) => {
    if (selectedSet.has(value)) { remove(value); return; }
    if (maxSelected !== undefined && selected.length >= maxSelected) return;
    onChange([...selected, value]);
  };
  if (options.length === 0) return <div className="empty-state small">{empty || 'گزینه‌ای برای انتخاب وجود ندارد.'}</div>;
  return <div className={`multi-select${open ? ' is-open' : ''}`} ref={rootRef} dir="rtl">
    <div className="multi-select-control">
      <div className="multi-select-values">
        {selected.length === 0 && <span className="multi-select-placeholder">انتخاب گزینه‌ها</span>}
        {selected.map((value) => { const option = optionByValue.get(value); const label = option?.label || value; return <button className="multi-select-pill" type="button" key={value} onClick={() => remove(value)} title={`حذف ${label}`} aria-label={`حذف ${label}`}><span dir="auto">{label}</span><X size={13} /></button>; })}
      </div>
      <button className="multi-select-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="listbox" aria-label="انتخاب گزینه‌ها"><ChevronDown size={16} /></button>
    </div>
    {open && <div className="multi-select-menu">
      <div className="multi-select-menu-head"><small>{selected.length.toLocaleString('fa-IR')} مورد انتخاب شده{maxSelected !== undefined ? ` از ${maxSelected.toLocaleString('fa-IR')}` : ''}</small><button type="button" onClick={toggleAll}>{allSelected ? 'پاک کردن همه' : 'انتخاب همه'}</button></div>
      <SearchField containerClassName="multi-select-search" leading={<Search size={14} />} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی گزینه‌ها..." aria-label="جستجوی گزینه‌ها" />
      <div className="multi-select-options" role="listbox" aria-multiselectable="true">{filteredOptions.map((option) => {
        const isSelected = selectedSet.has(option.value);
        const disabled = !isSelected && maxSelected !== undefined && selected.length >= maxSelected;
        return <button type="button" role="option" aria-selected={isSelected} className={isSelected ? 'is-selected' : ''} key={option.value} onClick={() => toggle(option.value)} disabled={disabled}><span className="multi-select-check">{isSelected && <Check size={13} />}</span><span className="multi-select-option-text" dir="auto"><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span></button>;
      })}{filteredOptions.length === 0 && <p className="multi-select-empty">گزینه‌ای پیدا نشد.</p>}</div>
    </div>}
  </div>;
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
