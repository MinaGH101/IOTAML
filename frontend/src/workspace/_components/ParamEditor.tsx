import type { Node } from '@xyflow/react';
import { Code2 } from 'lucide-react';
import { CustomSelect, type SelectOption } from '../../shared/_components/CustomSelect';
import type { Dataset, NodeParam, RegistryNode } from '../../shared/_types';
import { readThemeColor } from '../../shared/_utils/appShared';
import { resolveRegistryId } from '../_model/catalog';
import { isIdColumnParameter, resolveParameterColumns } from '../_model/parameterModel';
import { SelectionToggleButton } from './SelectionToggleButton';
import { DataFileInput } from '../../features/workflow/parameter-editors/DataFileInput';
import { DynamicToggle } from '../../features/workflow/parameter-editors/DynamicToggle';
import { ImputationBlocksEditor, NormalizationBlocksEditor, ReplacementBlocksEditor, ScatterBlocksEditor } from '../../features/workflow/parameter-editors/BlockEditors';
import { PillPicker, SeriesColorsEditor } from '../../features/workflow/parameter-editors/Pickers';
import { farsiSettingLabel, isDynamic, normalizeNumber, parseArray, selectOptions, shouldShowParam, staticValue, uniq } from '../../features/workflow/parameter-editors/parameterModel';

export type ParamEditorProps = {
  selectedNode: Node;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  datasets: Dataset[];
  availableColumns: string[];
  availableIdColumns?: string[];
  inheritedIdColumn?: string | null;
  availableRows?: Record<string, unknown>[];
  inputDataframes?: SelectOption[];
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  onRename?: (nodeId: string, label: string) => void;
};


export function ParamEditor({ selectedNode, registry, aliases, datasets, availableColumns, availableIdColumns = [], inheritedIdColumn = null, availableRows = [], inputDataframes = [], onParamsChange, onRename }: ParamEditorProps) {
  const registryId = resolveRegistryId(selectedNode.data.catalogId || selectedNode.data.registryId, aliases);
  const registryNode = registry.find((item) => item.id === registryId);
  const baseSchema = registryNode?.settingsSchema?.length ? registryNode.settingsSchema : registryNode?.params || [];
  const params = (selectedNode.data.params || {}) as Record<string, unknown>;
  const normalizedSchema = baseSchema.map((param) => {
    if ((registryId === 'VZ-002' || registryId === 'VZ-004') && param.name === 'column') {
      return { ...param, name: 'columns', label: 'Columns', type: 'columns', default: [] } as NodeParam;
    }
    return param;
  });
  const hasPlotOutput = Boolean(registryNode?.outputs?.some((port) => ['plot', 'metrics'].includes(String(port.type)))) || ['VZ-002', 'VZ-003', 'VZ-004', 'MA-001', 'MA-006'].includes(registryId);
  const schema = hasPlotOutput && registryId !== 'VZ-005' && !normalizedSchema.some((param) => param.name === 'color')
    ? [...normalizedSchema, { name: 'color', label: 'Color', type: 'color', default: readThemeColor('--theme-plot-default'), required: false, options: [], supportsDynamic: false, help: 'Plot color.' } as NodeParam]
    : normalizedSchema;
  const isCsvNode = registryId === 'DI-002';
  const selectedDatasetId = Number(params.dataset_id || 0);
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const csvColumns = selectedDataset ? selectedDataset.columns.map((column) => column.name) : availableColumns;
  const { idColumns, configuredIdColumn, calculationColumns } = resolveParameterColumns({
    isCsvNode,
    csvColumns,
    availableColumns,
    availableIdColumns,
    inheritedIdColumn,
    params,
  });
  const update = (key: string, value: unknown) => onParamsChange(selectedNode.id, { ...params, [key]: value });
  const setMode = (param: NodeParam, dynamic: boolean) => {
    const current = params[param.name];
    update(param.name, dynamic ? { mode: 'dynamic', expression: isDynamic(current) ? current.expression : '{{ $json.value }}' } : staticValue(current, param.default));
  };

  return (
    <div className="param-editor workflow-shell-editor">
      <label className="field">
        <span>نام نود</span>
        <input className="node-name-input" dir="ltr" value={String(selectedNode.data.label || '')} onChange={(event) => onRename?.(selectedNode.id, event.target.value)} />
      </label>

      {registryNode?.comingSoon && <div className="node-warning workflow-shell-card">این نود در رجیستری وجود دارد اما اجرای کامل آن هنوز Stub است.</div>}
      {schema.length === 0 && <div className="empty-state">این نود تنظیم خاصی ندارد.</div>}

      {schema.map((param) => {
        if (!shouldShowParam(registryId, param.name, params)) return null;
        if (param.type === 'interactive_table_state') return null;

        const raw = params[param.name];
        const dyn = isDynamic(raw);
        const value = staticValue(raw, param.default);
        const supportsDynamic = param.supportsDynamic !== false && registryNode?.supportsDynamicParameters !== false;

        const dynamicEditor = dyn ? (
          <textarea className="expression-editor workflow-shell-card" dir="ltr" value={raw.expression || ''} placeholder="{{ $json.column }}" onChange={(event) => update(param.name, { mode: 'dynamic', expression: event.target.value })} />
        ) : null;

        const translatedLabel = farsiSettingLabel(param.label);
        const label = <div className="field-row"><span>{translatedLabel}</span><DynamicToggle enabled={supportsDynamic} active={dyn} onMode={(mode) => setMode(param, mode)} /></div>;
        if (dyn) return <div className="field dynamic-field" key={param.name}>{label}{dynamicEditor}<small>{param.help || 'Examples: {{ $json.X }}, {{ $node.LoadData.output.row_count }}, {{ $execution.id }}'}</small></div>;

        if (param.type === 'data_file') {
          return <div className="field" key={param.name}>{label}<DataFileInput value={value} onChange={(next) => update(param.name, next)} help={param.help} /></div>;
        }

        if (param.type === 'file') {
          return (
            <label className="field" key={param.name}>
              {label}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.onload = () => update(param.name, String(reader.result || ''));
                  reader.readAsText(file);
                }}
              />
              {value ? <small>CSV file loaded.</small> : <small>Select the detection-limit CSV file.</small>}
            </label>
          );
        }


        if (param.type === 'boolean') {
          return <div className="field" key={param.name}>{label}<CustomSelect value={Boolean(value) ? 'true' : 'false'} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(next) => update(param.name, next === 'true')} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'select') {
          return <div className="field" key={param.name}>{label}<CustomSelect value={value === null ? 'null' : String(value)} options={selectOptions(param.options || [])} onChange={(next) => update(param.name, next === 'null' ? null : next)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'multiselect') {
          const selected = parseArray(value);
          const items = (param.options || []).map(String);
          return <div className="field" key={param.name}>{label}<SelectionToggleButton items={items} selected={selected} onChange={(next) => update(param.name, next)} /><PillPicker items={items} selected={selected} onChange={(next) => update(param.name, next)} /></div>;
        }
        if (param.type === 'row_values') {
          const selected = parseArray(value);
          const firstRow = availableRows[0] || {};
          const indexColumn = Object.keys(firstRow)[0] || '';
          const items = indexColumn ? uniq(availableRows.map((row) => String(row[indexColumn] ?? '').trim()).filter(Boolean)) : [];
          return <div className="field" key={param.name}>{label}<small>{indexColumn ? `شاخص ردیف: ${indexColumn} (اولین ستون ورودی)` : 'اولین ستون ورودی به‌صورت خودکار شاخص ردیف است.'}</small><SelectionToggleButton items={items} selected={selected} onChange={(next) => update(param.name, next)} /><PillPicker items={items} selected={selected} onChange={(next) => update(param.name, next)} empty="ابتدا نود قبلی را اجرا کنید تا ردیف‌ها از خروجی انتخاب‌شده خوانده شوند." />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'series_colors') {
          const rows = parseArray(params.selected_rows);
          return <div className="field" key={param.name}>{label}<SeriesColorsEditor rows={rows} value={value} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'replacement_blocks') {
          return <div className="field" key={param.name}>{label}<ReplacementBlocksEditor value={value} columns={calculationColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'imputation_blocks') {
          return <div className="field" key={param.name}>{label}<ImputationBlocksEditor value={value} columns={calculationColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'normalization_blocks') {
          return <div className="field" key={param.name}>{label}<NormalizationBlocksEditor value={value} columns={calculationColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'scatter_blocks') {
          return <div className="field" key={param.name}>{label}<ScatterBlocksEditor value={value} columns={calculationColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'dataset') {
          const options = [{ value: '', label: 'انتخاب دیتاست' }, ...datasets.map((dataset) => ({ value: String(dataset.id), label: dataset.name }))];
          return <div className="field" key={param.name}>{label}<CustomSelect value={String(value || '')} options={options} onChange={(next) => update(param.name, Number(next) || null)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'input_dataframe') {
          const options = [{ value: '', label: 'انتخاب دیتافریم متصل' }, ...inputDataframes];
          return (
            <div className="field" key={param.name}>
              {label}
              <CustomSelect value={String(value || '')} options={options} onChange={(next) => update(param.name, next)} ariaLabel={param.label} />
              {inputDataframes.length < 2 && <small>دو نود دارای خروجی دیتافریم را به این نود وصل کنید.</small>}
              {param.help && <small>{param.help}</small>}
            </div>
          );
        }
        if (param.type === 'column') {
          const isIdSelector = isIdColumnParameter(param.name);
          const selectableColumns = isIdSelector ? idColumns : calculationColumns;
          const effectiveValue = isIdSelector && !String(value || '').trim() ? inheritedIdColumn : value;
          const options = [{ value: '', label: 'انتخاب ستون' }, ...selectableColumns.map((column) => ({ value: column, label: column }))];
          return <div className="field" key={param.name}>{label}<CustomSelect value={String(effectiveValue || '')} options={options} onChange={(next) => update(param.name, next || null)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'columns') {
          const selected = parseArray(value).filter((column) => column !== configuredIdColumn);
          const target = String(params.target_column || '');
          const featureColumns = registryId === 'VZ-005'
            ? calculationColumns.slice(1)
            : calculationColumns.filter((column) => column !== target);
          return <div className="field" key={param.name}>{label}<SelectionToggleButton items={featureColumns} selected={selected} onChange={(next) => update(param.name, next)} /><PillPicker items={featureColumns} selected={selected} onChange={(next) => update(param.name, next)} empty="ستونی برای انتخاب پیدا نشد." /></div>;
        }
        if (param.type === 'color') {
          return <label className="field color-field" key={param.name}>{label}<input type="color" value={String(value || readThemeColor('--theme-plot-default'))} onChange={(event) => update(param.name, event.target.value)} /></label>;
        }
        if (param.type === 'number' || param.type === 'integer' || param.type === 'float') {
          return <label className="field" key={param.name}>{label}<input type="number" step={param.type === 'integer' ? 1 : 'any'} value={value === null ? '' : String(value)} onChange={(event) => update(param.name, normalizeNumber(event.target.value, param))} /></label>;
        }
        if (param.type === 'textarea' || param.type === 'code') {
          return <label className={`field ${param.type === 'code' ? 'code-field' : ''}`} key={param.name}>{label}<textarea dir="ltr" rows={param.type === 'code' ? 10 : 4} value={String(value ?? '')} onChange={(event) => update(param.name, event.target.value)} placeholder={param.type === 'code' ? 'return input_data' : ''} />{param.type === 'code' && <small><Code2 size={11} /> {'input_data = [{"json": {...}, "metadata": {...}}]'}</small>}</label>;
        }
        return <label className="field" key={param.name}>{label}<input type="text" value={value === null ? '' : String(value)} onChange={(event) => update(param.name, event.target.value)} /></label>;
      })}
    </div>
  );
}
