import { DynamicToggle } from '../../../features/workflow/parameter-editors/DynamicToggle';
import { farsiSettingLabel, isDynamic, shouldShowParam, staticValue } from '../../../features/workflow/parameter-editors/parameterModel';
import type { NodeParam } from '../../../shared/types';
import type { ParamEditorProps } from '../ParamEditor';
import { ParamBasicField } from './ParamBasicField';
import { ParamComplexField } from './ParamComplexField';
import type { useParamEditorModel } from './useParamEditorModel';
const complex = new Set(['data_file', 'file', 'multiselect', 'row_values', 'series_colors', 'replacement_blocks', 'imputation_blocks', 'normalization_blocks', 'scatter_blocks', 'columns']);
export function ParamField({ param, p, m }: {
    param: NodeParam;
    p: ParamEditorProps;
    m: ReturnType<typeof useParamEditorModel>;
}) { if (!shouldShowParam(m.registryId, param.name, m.params) || param.type === 'interactive_table_state')
    return null; const raw = m.params[param.name]; const dyn = isDynamic(raw); const value = staticValue(raw, param.default); const supports = param.supportsDynamic !== false && m.registryNode?.supportsDynamicParameters !== false; const label = <div className="field-row"><span>{farsiSettingLabel(param.label)}</span><DynamicToggle enabled={supports} active={dyn} onMode={(mode) => m.setMode(param, mode)}/></div>; if (dyn)
    return <div className="field dynamic-field">{label}<textarea className="expression-editor workflow-shell-card" dir="ltr" value={raw.expression || ''} placeholder="{{ $json.column }}" onChange={(e) => m.update(param.name, { mode: 'dynamic', expression: e.target.value })}/><small>{param.help || 'Examples: {{ $json.X }}, {{ $node.LoadData.output.row_count }}, {{ $execution.id }}'}</small></div>; return complex.has(param.type) ? <ParamComplexField param={param} value={value} label={label} p={p} m={m}/> : <ParamBasicField param={param} value={value} label={label} p={p} m={m}/>; }
