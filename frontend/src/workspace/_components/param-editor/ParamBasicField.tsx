import { Code2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Select as CustomSelect } from '../../../shared/ui';
import { readThemeColor } from '../../../shared/lib/theme';
import type { NodeParam } from '../../../shared/types';
import { isIdColumnParameter } from '../../_model/parameterModel';
import { normalizeNumber, selectOptions } from '../../../features/workflow/parameter-editors/parameterModel';
import type { ParamEditorProps } from '../ParamEditor';
import type { useParamEditorModel } from './useParamEditorModel';
export function ParamBasicField({ param, value, label, p, m }: {
    param: NodeParam;
    value: unknown;
    label: ReactNode;
    p: ParamEditorProps;
    m: ReturnType<typeof useParamEditorModel>;
}) { if (param.type === 'boolean')
    return <div className="field">{label}<CustomSelect value={Boolean(value) ? 'true' : 'false'} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(v) => m.update(param.name, v === 'true')} ariaLabel={param.label}/></div>; if (param.type === 'select')
    return <div className="field">{label}<CustomSelect value={value === null ? 'null' : String(value)} options={selectOptions(param.options || [])} onChange={(v) => m.update(param.name, v === 'null' ? null : v)} ariaLabel={param.label}/></div>; if (param.type === 'dataset')
    return <div className="field">{label}<CustomSelect value={String(value || '')} options={[{ value: '', label: 'انتخاب دیتاست' }, ...p.datasets.map((d) => ({ value: String(d.id), label: d.name }))]} onChange={(v) => m.update(param.name, Number(v) || null)} ariaLabel={param.label}/></div>; if (param.type === 'input_dataframe')
    return <div className="field">{label}<CustomSelect value={String(value || '')} options={[{ value: '', label: 'انتخاب دیتافریم متصل' }, ...(p.inputDataframes || [])]} onChange={(v) => m.update(param.name, v)} ariaLabel={param.label}/>{(p.inputDataframes?.length || 0) < 2 && <small>دو نود دارای خروجی دیتافریم را به این نود وصل کنید.</small>}</div>; if (param.type === 'column') {
    const isId = isIdColumnParameter(param.name);
    const cols = isId ? m.columns.idColumns : m.columns.calculationColumns;
    const effective = isId && !String(value || '').trim() ? p.inheritedIdColumn : value;
    return <div className="field">{label}<CustomSelect value={String(effective || '')} options={[{ value: '', label: 'انتخاب ستون' }, ...cols.map((c) => ({ value: c, label: c }))]} onChange={(v) => m.update(param.name, v || null)} ariaLabel={param.label}/></div>;
} if (param.type === 'color')
    return <label className="field color-field">{label}<input type="color" value={String(value || readThemeColor('--theme-plot-default'))} onChange={(e) => m.update(param.name, e.target.value)}/></label>; if (['number', 'integer', 'float'].includes(param.type))
    return <label className="field">{label}<input type="number" step={param.type === 'integer' ? 1 : 'any'} value={value === null ? '' : String(value)} onChange={(e) => m.update(param.name, normalizeNumber(e.target.value, param))}/></label>; if (param.type === 'textarea' || param.type === 'code')
    return <label className={`field ${param.type === 'code' ? 'code-field' : ''}`}>{label}<textarea dir="ltr" rows={param.type === 'code' ? 10 : 4} value={String(value ?? '')} onChange={(e) => m.update(param.name, e.target.value)} placeholder={param.type === 'code' ? 'return input_data' : ''}/>{param.type === 'code' && <small><Code2 size={11}/> {'input_data = [{"json": {...}, "metadata": {...}}]'}</small>}</label>; return <label className="field">{label}<input type="text" value={value === null ? '' : String(value)} onChange={(e) => m.update(param.name, e.target.value)}/></label>; }
