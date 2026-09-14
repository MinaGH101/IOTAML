import type { ReactNode } from 'react';
import type { NodeParam } from '../../../shared/types';
import { DataFileInput } from '../../../features/workflow/parameter-editors/DataFileInput';
import { ImputationBlocksEditor, NormalizationBlocksEditor, ReplacementBlocksEditor, ScatterBlocksEditor } from '../../../features/workflow/parameter-editors/BlockEditors';
import { PillPicker, SeriesColorsEditor } from '../../../features/workflow/parameter-editors/Pickers';
import { parseArray, uniq } from '../../../features/workflow/parameter-editors/parameterModel';
import { SelectionToggleButton } from '../SelectionToggleButton';
import type { ParamEditorProps } from '../ParamEditor';
import type { useParamEditorModel } from './useParamEditorModel';
export function ParamComplexField({ param, value, label, p, m }: {
    param: NodeParam;
    value: unknown;
    label: ReactNode;
    p: ParamEditorProps;
    m: ReturnType<typeof useParamEditorModel>;
}) { if (param.type === 'data_file')
    return <div className="field">{label}<DataFileInput value={value} onChange={(v) => m.update(param.name, v)} help={param.help}/></div>; if (param.type === 'file')
    return <label className="field">{label}<input type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (!file)
        return; const r = new FileReader(); r.onload = () => m.update(param.name, String(r.result || '')); r.readAsText(file); }}/>{value ? <small>CSV file loaded.</small> : <small>Select the detection-limit CSV file.</small>}</label>; if (param.type === 'multiselect') {
    const selected = parseArray(value);
    const items = (param.options || []).map(String);
    return <div className="field">{label}<SelectionToggleButton items={items} selected={selected} onChange={(v) => m.update(param.name, v)}/><PillPicker items={items} selected={selected} onChange={(v) => m.update(param.name, v)}/></div>;
} if (param.type === 'row_values') {
    const selected = parseArray(value);
    const first = p.availableRows?.[0] || {};
    const index = Object.keys(first)[0] || '';
    const items = index ? uniq((p.availableRows || []).map((row) => String(row[index] ?? '').trim()).filter(Boolean)) : [];
    return <div className="field">{label}<small>{index ? `شاخص ردیف: ${index} (اولین ستون ورودی)` : 'اولین ستون ورودی به‌صورت خودکار شاخص ردیف است.'}</small><SelectionToggleButton items={items} selected={selected} onChange={(v) => m.update(param.name, v)}/><PillPicker items={items} selected={selected} onChange={(v) => m.update(param.name, v)} empty="ابتدا نود قبلی را اجرا کنید تا ردیف‌ها از خروجی انتخاب‌شده خوانده شوند."/></div>;
} if (param.type === 'series_colors')
    return <div className="field">{label}<SeriesColorsEditor rows={parseArray(m.params.selected_rows)} value={value} onChange={(v) => m.update(param.name, v)}/></div>; if (param.type === 'replacement_blocks')
    return <div className="field">{label}<ReplacementBlocksEditor value={value} columns={m.columns.calculationColumns} onChange={(v) => m.update(param.name, v)}/></div>; if (param.type === 'imputation_blocks')
    return <div className="field">{label}<ImputationBlocksEditor value={value} columns={m.columns.calculationColumns} onChange={(v) => m.update(param.name, v)}/></div>; if (param.type === 'normalization_blocks')
    return <div className="field">{label}<NormalizationBlocksEditor value={value} columns={m.columns.calculationColumns} onChange={(v) => m.update(param.name, v)}/></div>; if (param.type === 'scatter_blocks')
    return <div className="field">{label}<ScatterBlocksEditor value={value} columns={m.columns.calculationColumns} onChange={(v) => m.update(param.name, v)}/></div>; if (param.type === 'columns') {
    const selected = parseArray(value).filter((c) => c !== m.columns.configuredIdColumn);
    const target = String(m.params.target_column || '');
    const cols = m.registryId === 'VZ-005' ? m.columns.calculationColumns.slice(1) : m.columns.calculationColumns.filter((c) => c !== target);
    return <div className="field">{label}<SelectionToggleButton items={cols} selected={selected} onChange={(v) => m.update(param.name, v)}/><PillPicker items={cols} selected={selected} onChange={(v) => m.update(param.name, v)} empty="ستونی برای انتخاب پیدا نشد."/></div>;
} return null; }
