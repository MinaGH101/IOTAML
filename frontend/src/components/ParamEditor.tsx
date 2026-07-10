import type { Node } from '@xyflow/react';
import { CheckSquare, Code2, Plus, Trash2, Wand2 } from 'lucide-react';
import { CustomSelect, type SelectOption } from './CustomSelect';
import type { Dataset, NodeParam, RegistryNode } from '../types';

type ParamEditorProps = {
  selectedNode: Node;
  registry: RegistryNode[];
  datasets: Dataset[];
  availableColumns: string[];
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  onRename?: (nodeId: string, label: string) => void;
};


const LEGACY_NODE_ALIASES: Record<string, string> = {
  data_csv: 'DI-002',
  data_demo: 'DI-002',
  data_demo_iris: 'DI-002',
  data_demo_wine: 'DI-002',
  data_demo_breast_cancer: 'DI-002',
  data_select_target_features: 'MP-002',
  data_select_features: 'MP-002',
  data_select_target: 'MP-002',
  data_train_test_split: 'MP-001',
  data_kfold_split: 'MP-004',
  data_filter_rows: 'CL-007',
  data_sort_rows: 'CL-007',
  data_sample_rows: 'CL-006',
  transform_drop_columns: 'CL-006',
  transform_simple_imputer: 'CL-009',
  transform_replace_values: 'CL-008',
  transform_standard_scaler: 'TR-020',
  transform_minmax_scaler: 'TR-020',
  transform_robust_scaler: 'TR-020',
  transform_scaler: 'TR-020',
  transform_imputer: 'CL-009',
  transform_normalization: 'TR-021',
  feature_mutual_info: 'MP-021',
  feature_f_regression: 'MP-022',
  transform_one_hot: 'MP-005',
  transform_ordinal: 'MP-005',
  transform_pca: 'TR-010',
  transform_select_k_best: 'MP-001',
  transform_variance_threshold: 'MP-001',
  analysis_summary: 'IN-003',
  analysis_missing: 'IN-004',
  analysis_correlation: 'IN-006',
  analysis_histogram: 'VZ-002',
  analysis_scatter: 'VZ-003',
  analysis_boxplot: 'VZ-004',
  analysis_class_balance: 'IN-003',
  analysis_outliers: 'AD-001',
  analysis_feature_distribution: 'VZ-002',
  analysis_pairwise_sample: 'VZ-003',
  analysis_only: 'IN-003',
  model_logistic_regression: 'MC-001',
  model_random_forest_classifier: 'MC-003',
  model_gradient_boosting_classifier: 'MC-005',
  model_svc: 'MC-008',
  model_knn_classifier: 'MC-007',
  model_decision_tree_classifier: 'MC-002',
  model_linear_regression: 'MR-001',
  model_ridge: 'MR-002',
  model_random_forest_regressor: 'MR-006',
  model_gradient_boosting_regressor: 'MR-008',
  model_extra_trees_classifier: 'MC-004',
  model_adaboost_classifier: 'MT-005',
  model_hist_gradient_boosting_classifier: 'MC-006',
  model_gaussian_nb: 'MC-010',
  model_mlp_classifier: 'MT-009',
  model_decision_tree_regressor: 'MR-005',
  model_knn_regressor: 'MR-010',
  model_svr: 'MT-006',
  model_extra_trees_regressor: 'MR-007',
  model_adaboost_regressor: 'MT-005',
  model_hist_gradient_boosting_regressor: 'MR-009',
  model_lasso: 'MR-003',
  model_elastic_net: 'MR-004',
  model_mlp_regressor: 'MT-009',
  model_metrics: 'MA-003',
  model_confusion_matrix: 'MA-004',
  model_roc_auc: 'MA-003',
  model_feature_importance: 'MA-006',
  model_permutation_importance: 'MA-007',
  model_shap_summary: 'MA-007',
  model_learning_curve: 'MA-009',
  model_residual_plot: 'MA-005',
  model_prediction_preview: 'MA-001',
  model_prediction_plot: 'MA-001',
  model_compare: 'MA-010'
};

function resolveRegistryId(id: unknown) {
  const value = String(id || '');
  return LEGACY_NODE_ALIASES[value] || value;
}

function uniq(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function parseArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : String(value || '').split(',').map((v) => v.trim()).filter(Boolean); }
function isDynamic(value: unknown): value is { mode: 'dynamic'; expression: string } { return Boolean(value && typeof value === 'object' && (value as { mode?: string }).mode === 'dynamic'); }
function staticValue(value: unknown, fallback: unknown) { return isDynamic(value) ? fallback : value ?? fallback ?? ''; }
function selectOptions(options: unknown[]): SelectOption[] { return options.map((option, index) => ({ value: option === null ? 'null' : String(option), label: option === null ? 'None' : String(option || `گزینه ${index + 1}`) })); }
function normalizeNumber(value: string, param: NodeParam) { if (value === '') return null; const n = Number(value); return param.type === 'integer' ? Math.round(n) : n; }
function toggleItem(items: string[], item: string) { return items.includes(item) ? items.filter((value) => value !== item) : uniq([...items, item]); }


function shouldShowParam(registryId: string, paramName: string, params: Record<string, unknown>) {
  if (registryId === 'TR-020') {
    const method = String(params.method || 'standard');
    if (['columns', 'method', 'max_output_rows'].includes(paramName)) return true;
    if (['standard_mode'].includes(paramName)) return method === 'standard';
    if (['feature_min', 'feature_max'].includes(paramName)) return method === 'minmax';
    if (['quantile_min', 'quantile_max', 'robust_mode'].includes(paramName)) return method === 'robust';
    if (['with_mean', 'with_std', 'with_centering', 'with_scaling'].includes(paramName)) return false;
  }
  return true;
}

function PillPicker({ items, selected, onChange, empty }: { items: string[]; selected: string[]; onChange: (items: string[]) => void; empty?: string }) {
  if (items.length === 0) return <div className="empty-state small">{empty || 'گزینه‌ای برای انتخاب وجود ندارد.'}</div>;
  return <div className="pill-picker workflow-shell-card">{items.map((item) => <button type="button" key={item} className={`choice-pill ${selected.includes(item) ? 'active' : ''}`} onClick={() => onChange(toggleItem(selected, item))}>{item}</button>)}</div>;
}



type ReplacementBlock = {
  columns?: string[];
  find_mode?: 'value' | 'type';
  find_value?: string;
  condition?: string;
  value_type?: string;
  replacement_mode?: 'value' | 'none';
  replacement_value?: string;
};

function replacementBlocks(value: unknown): ReplacementBlock[] {
  if (Array.isArray(value)) return value as ReplacementBlock[];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as ReplacementBlock[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function ReplacementBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ReplacementBlock[]) => void }) {
  const blocks = replacementBlocks(value);
  const nextBlock = (): ReplacementBlock => ({ columns: [], find_mode: 'value', condition: 'match', find_value: '', value_type: 'string', replacement_mode: 'value', replacement_value: '' });
  const updateBlock = (index: number, patch: Partial<ReplacementBlock>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  return (
    <div className="replacement-blocks">
      {blocks.length === 0 && <div className="empty-state small">هیچ بلوک جایگزینی تعریف نشده است.</div>}
      {blocks.map((block, index) => {
        const findMode = block.find_mode || 'value';
        const replacementMode = block.replacement_mode || 'value';
        return (
          <div className="replacement-block workflow-shell-card" key={index}>
            <div className="replacement-block-head">
              <b>Block {index + 1}</b>
              <button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button>
            </div>
            <div className="field compact-field">
              <span>Columns</span>
              <button type="button" className="tiny-action" onClick={() => updateBlock(index, { columns })}>انتخاب همه</button>
              <PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." />
            </div>
            <div className="replacement-grid">
              <label className="field"><span>Find By</span><CustomSelect value={findMode} options={[{ value: 'value', label: 'Value' }, { value: 'type', label: 'Value Type' }]} onChange={(next) => updateBlock(index, { find_mode: next as 'value' | 'type' })} /></label>
              {findMode === 'value' ? <>
                <label className="field"><span>Condition</span><CustomSelect value={block.condition || 'match'} options={[
                  { value: 'match', label: 'Match' }, { value: 'include', label: 'Include' }, { value: 'starts_with', label: 'Starts with' }, { value: 'ends_with', label: 'Ends with' }, { value: 'regex', label: 'Regex' },
                  { value: '>', label: '>' }, { value: '>=', label: '>=' }, { value: '<', label: '<' }, { value: '<=', label: '<=' },
                ]} onChange={(next) => updateBlock(index, { condition: next })} /></label>
                <label className="field"><span>Find Value</span><input dir="ltr" value={String(block.find_value ?? '')} onChange={(event) => updateBlock(index, { find_value: event.target.value })} placeholder="<0.1" /></label>
              </> : <label className="field"><span>Value Type</span><CustomSelect value={block.value_type || 'string'} options={[
                { value: 'string', label: 'String' }, { value: 'numeric', label: 'Numeric' }, { value: 'int', label: 'Integer' }, { value: 'float', label: 'Float' }, { value: 'missing', label: 'Missing/None' },
              ]} onChange={(next) => updateBlock(index, { value_type: next })} /></label>}
              <label className="field"><span>Replacement</span><CustomSelect value={replacementMode} options={[{ value: 'value', label: 'Entered value' }, { value: 'none', label: 'None / missing' }]} onChange={(next) => updateBlock(index, { replacement_mode: next as 'value' | 'none' })} /></label>
              {replacementMode === 'value' && <label className="field"><span>Replacement Value</span><input dir="ltr" value={String(block.replacement_value ?? '')} onChange={(event) => updateBlock(index, { replacement_value: event.target.value })} /></label>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> Add replacement block</button>
    </div>
  );
}


type ImputationBlock = {
  columns?: string[];
  method?: string;
  constant_value?: string;
  interpolation_method?: string;
  limit_direction?: string;
  n_neighbors?: number;
  weights?: string;
};

function imputationBlocks(value: unknown): ImputationBlock[] {
  if (Array.isArray(value)) return value as ImputationBlock[];
  if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as ImputationBlock[] : []; } catch { return []; }
  }
  return [];
}

function ImputationBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ImputationBlock[]) => void }) {
  const blocks = imputationBlocks(value);
  const nextBlock = (): ImputationBlock => ({ columns: [], method: 'mean', constant_value: '', interpolation_method: 'linear', limit_direction: 'both', n_neighbors: 5, weights: 'uniform' });
  const updateBlock = (index: number, patch: Partial<ImputationBlock>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  return (
    <div className="replacement-blocks">
      {blocks.length === 0 && <div className="empty-state small">هیچ بلوک ایمپیوت تعریف نشده است.</div>}
      {blocks.map((block, index) => {
        const method = block.method || 'mean';
        return (
          <div className="replacement-block workflow-shell-card" key={index}>
            <div className="replacement-block-head"><b>Block {index + 1}</b><button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button></div>
            <div className="field compact-field"><span>Columns</span><button type="button" className="tiny-action" onClick={() => updateBlock(index, { columns })}>انتخاب همه</button><PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." /></div>
            <div className="replacement-grid">
              <label className="field"><span>Method</span><CustomSelect value={method} options={[{value:'mean',label:'Mean'}, {value:'median',label:'Median'}, {value:'constant',label:'Constant value'}, {value:'interpolate',label:'Interpolate'}, {value:'knn',label:'KNN'}]} onChange={(next) => updateBlock(index, { method: next })} /></label>
              {method === 'constant' && <label className="field"><span>Constant Value</span><input dir="ltr" value={String(block.constant_value ?? '')} onChange={(event) => updateBlock(index, { constant_value: event.target.value })} /></label>}
              {method === 'interpolate' && <><label className="field"><span>Interpolation Method</span><CustomSelect value={block.interpolation_method || 'linear'} options={[{value:'linear',label:'Linear'}, {value:'nearest',label:'Nearest'}, {value:'zero',label:'Zero'}, {value:'slinear',label:'SLinear'}]} onChange={(next) => updateBlock(index, { interpolation_method: next })} /></label><label className="field"><span>Limit Direction</span><CustomSelect value={block.limit_direction || 'both'} options={[{value:'both',label:'Both'}, {value:'forward',label:'Forward'}, {value:'backward',label:'Backward'}]} onChange={(next) => updateBlock(index, { limit_direction: next })} /></label></>}
              {method === 'knn' && <><label className="field"><span>Neighbors</span><input type="number" min={1} value={Number(block.n_neighbors || 5)} onChange={(event) => updateBlock(index, { n_neighbors: Number(event.target.value) })} /></label><label className="field"><span>Weights</span><CustomSelect value={block.weights || 'uniform'} options={[{value:'uniform',label:'Uniform'}, {value:'distance',label:'Distance'}]} onChange={(next) => updateBlock(index, { weights: next })} /></label></>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> Add imputation block</button>
    </div>
  );
}

type NormalizationBlock = {
  columns?: string[];
  method?: string;
  offset?: number;
  standardize?: boolean;
  n_quantiles?: number;
  random_state?: number;
};

function normalizationBlocks(value: unknown): NormalizationBlock[] {
  if (Array.isArray(value)) return value as NormalizationBlock[];
  if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as NormalizationBlock[] : []; } catch { return []; }
  }
  return [];
}

function NormalizationBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: NormalizationBlock[]) => void }) {
  const blocks = normalizationBlocks(value);
  const nextBlock = (): NormalizationBlock => ({ columns: [], method: 'ln', offset: 0, standardize: true, n_quantiles: 1000, random_state: 42 });
  const updateBlock = (index: number, patch: Partial<NormalizationBlock>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  return (
    <div className="replacement-blocks">
      {blocks.length === 0 && <div className="empty-state small">هیچ بلوک نرمال‌سازی تعریف نشده است.</div>}
      {blocks.map((block, index) => {
        const method = block.method || 'ln';
        return (
          <div className="replacement-block workflow-shell-card" key={index}>
            <div className="replacement-block-head"><b>Block {index + 1}</b><button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button></div>
            <div className="field compact-field"><span>Columns</span><button type="button" className="tiny-action" onClick={() => updateBlock(index, { columns })}>انتخاب همه</button><PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." /></div>
            <div className="replacement-grid">
              <label className="field"><span>Method</span><CustomSelect value={method} options={[{value:'ln',label:'Ln'}, {value:'log10',label:'Log10'}, {value:'sqrt',label:'Sqrt'}, {value:'boxcox',label:'Box-Cox'}, {value:'yeo_johnson',label:'Yeo-Johnson'}, {value:'quantile_normal',label:'Quantile Normal'}, {value:'l1',label:'L1'}, {value:'l2',label:'L2'}, {value:'max',label:'Max'}]} onChange={(next) => updateBlock(index, { method: next })} /></label>
              {['ln','log10','sqrt','boxcox'].includes(method) && <label className="field"><span>Offset</span><input type="number" step="any" value={Number(block.offset || 0)} onChange={(event) => updateBlock(index, { offset: Number(event.target.value) })} /></label>}
              {['boxcox','yeo_johnson'].includes(method) && <label className="field checkbox pretty-checkbox"><span>Standardize</span><input type="checkbox" checked={block.standardize !== false} onChange={(event) => updateBlock(index, { standardize: event.target.checked })} /><span className="checkmark" /></label>}
              {method === 'quantile_normal' && <><label className="field"><span>Quantiles</span><input type="number" min={2} value={Number(block.n_quantiles || 1000)} onChange={(event) => updateBlock(index, { n_quantiles: Number(event.target.value) })} /></label><label className="field"><span>Random State</span><input type="number" value={Number(block.random_state || 42)} onChange={(event) => updateBlock(index, { random_state: Number(event.target.value) })} /></label></>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> Add normalization block</button>
    </div>
  );
}


type ScatterBlock = {
  title?: string;
  x_column?: string;
  y_column?: string;
  color?: string;
  x_min?: number | null;
  x_max?: number | null;
  y_min?: number | null;
  y_max?: number | null;
  point_size?: number;
  max_points?: number;
};

function scatterBlocks(value: unknown): ScatterBlock[] {
  if (Array.isArray(value)) return value as ScatterBlock[];
  if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as ScatterBlock[] : []; } catch { return []; }
  }
  return [];
}

function ScatterBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ScatterBlock[]) => void }) {
  const blocks = scatterBlocks(value);
  const nextBlock = (): ScatterBlock => ({ title: '', x_column: columns[0] || '', y_column: columns[1] || columns[0] || '', color: '#31cde3', x_min: null, x_max: null, y_min: null, y_max: null, point_size: 7, max_points: 1000 });
  const updateBlock = (index: number, patch: Partial<ScatterBlock>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));
  const columnOptions = [{ value: '', label: 'انتخاب ستون' }, ...columns.map((column) => ({ value: column, label: column }))];
  const numericValue = (value: unknown) => value === null || value === undefined ? '' : String(value);
  const parseOptionalNumber = (raw: string) => raw === '' ? null : Number(raw);

  return (
    <div className="replacement-blocks scatter-blocks-editor">
      {blocks.length === 0 && <div className="empty-state small">هیچ Scatter block تعریف نشده است. هر block یک نمودار مستقل می‌سازد.</div>}
      {blocks.map((block, index) => (
        <div className="replacement-block workflow-shell-card scatter-block" key={index}>
          <div className="replacement-block-head">
            <b>Scatter block {index + 1}</b>
            <button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button>
          </div>
          <label className="field"><span>Plot title</span><input dir="ltr" value={String(block.title || '')} placeholder="Fe vs Cu" onChange={(event) => updateBlock(index, { title: event.target.value })} /></label>
          <div className="replacement-grid">
            <label className="field"><span>X Column</span><CustomSelect value={String(block.x_column || '')} options={columnOptions} onChange={(next) => updateBlock(index, { x_column: next })} /></label>
            <label className="field"><span>Y Column</span><CustomSelect value={String(block.y_column || '')} options={columnOptions} onChange={(next) => updateBlock(index, { y_column: next })} /></label>
            <label className="field color-field"><span>Color</span><input type="color" value={String(block.color || '#31cde3')} onChange={(event) => updateBlock(index, { color: event.target.value })} /></label>
            <label className="field"><span>Point Size</span><input type="number" min={2} max={30} value={Number(block.point_size || 7)} onChange={(event) => updateBlock(index, { point_size: Number(event.target.value) })} /></label>
            <label className="field"><span>X Min</span><input type="number" step="any" value={numericValue(block.x_min)} onChange={(event) => updateBlock(index, { x_min: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>X Max</span><input type="number" step="any" value={numericValue(block.x_max)} onChange={(event) => updateBlock(index, { x_max: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>Y Min</span><input type="number" step="any" value={numericValue(block.y_min)} onChange={(event) => updateBlock(index, { y_min: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>Y Max</span><input type="number" step="any" value={numericValue(block.y_max)} onChange={(event) => updateBlock(index, { y_max: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>Max Points</span><input type="number" min={10} max={10000} value={Number(block.max_points || 1000)} onChange={(event) => updateBlock(index, { max_points: Number(event.target.value) })} /></label>
          </div>
        </div>
      ))}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> Add scatter block</button>
    </div>
  );
}

function DynamicToggle({ enabled, active, onMode }: { enabled: boolean; active: boolean; onMode: (dynamic: boolean) => void }) {
  if (!enabled) return null;
  return (
    <div className="dynamic-toggle workflow-shell-card" dir="ltr">
      <button type="button" className={!active ? 'active' : ''} onClick={() => onMode(false)}>Static</button>
      <button type="button" className={active ? 'active' : ''} onClick={() => onMode(true)}><Wand2 size={11} /> Dynamic</button>
    </div>
  );
}

export function ParamEditor({ selectedNode, registry, datasets, availableColumns, onParamsChange, onRename }: ParamEditorProps) {
  const registryId = resolveRegistryId(selectedNode.data.catalogId || selectedNode.data.registryId);
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
  const schema = hasPlotOutput && !normalizedSchema.some((param) => param.name === 'color')
    ? [...normalizedSchema, { name: 'color', label: 'Color', type: 'color', default: '#31cde3', required: false, options: [], supportsDynamic: false, help: 'Plot color.' } as NodeParam]
    : normalizedSchema;
  const isCsvNode = registryId === 'DI-002';
  const selectedDatasetId = Number(params.dataset_id || 0);
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const csvColumns = selectedDataset ? selectedDataset.columns.map((column) => column.name) : availableColumns;
  const allColumns = uniq(isCsvNode ? csvColumns : availableColumns);
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

        const raw = params[param.name];
        const dyn = isDynamic(raw);
        const value = staticValue(raw, param.default);
        const supportsDynamic = param.supportsDynamic !== false && registryNode?.supportsDynamicParameters !== false;

        const dynamicEditor = dyn ? (
          <textarea className="expression-editor workflow-shell-card" dir="ltr" value={raw.expression || ''} placeholder="{{ $json.column }}" onChange={(event) => update(param.name, { mode: 'dynamic', expression: event.target.value })} />
        ) : null;

        const label = <div className="field-row"><span>{param.label}</span><DynamicToggle enabled={supportsDynamic} active={dyn} onMode={(mode) => setMode(param, mode)} /></div>;
        if (dyn) return <div className="field dynamic-field" key={param.name}>{label}{dynamicEditor}<small>{param.help || 'Examples: {{ $json.X }}, {{ $node.LoadData.output.row_count }}, {{ $execution.id }}'}</small></div>;

        if (param.type === 'boolean') {
          return <div className="field" key={param.name}>{label}<CustomSelect value={Boolean(value) ? 'true' : 'false'} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(next) => update(param.name, next === 'true')} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'select') {
          return <div className="field" key={param.name}>{label}<CustomSelect value={value === null ? 'null' : String(value)} options={selectOptions(param.options || [])} onChange={(next) => update(param.name, next === 'null' ? null : next)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'multiselect') {
          const selected = parseArray(value);
          const items = (param.options || []).map(String);
          return <div className="field" key={param.name}>{label}<button type="button" className="tiny-action icon-only" title="انتخاب همه" aria-label="انتخاب همه" onClick={() => update(param.name, items)}><CheckSquare size={12} /></button><PillPicker items={items} selected={selected} onChange={(next) => update(param.name, next)} /></div>;
        }
        if (param.type === 'replacement_blocks') {
          return <div className="field" key={param.name}>{label}<ReplacementBlocksEditor value={value} columns={allColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'imputation_blocks') {
          return <div className="field" key={param.name}>{label}<ImputationBlocksEditor value={value} columns={allColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'normalization_blocks') {
          return <div className="field" key={param.name}>{label}<NormalizationBlocksEditor value={value} columns={allColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'scatter_blocks') {
          return <div className="field" key={param.name}>{label}<ScatterBlocksEditor value={value} columns={allColumns} onChange={(next) => update(param.name, next)} />{param.help && <small>{param.help}</small>}</div>;
        }
        if (param.type === 'dataset') {
          const options = [{ value: '', label: 'انتخاب دیتاست' }, ...datasets.map((dataset) => ({ value: String(dataset.id), label: dataset.name }))];
          return <div className="field" key={param.name}>{label}<CustomSelect value={String(value || '')} options={options} onChange={(next) => update(param.name, Number(next) || null)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'column') {
          const options = [{ value: '', label: 'انتخاب ستون' }, ...allColumns.map((column) => ({ value: column, label: column }))];
          return <div className="field" key={param.name}>{label}<CustomSelect value={String(value || '')} options={options} onChange={(next) => update(param.name, next || null)} ariaLabel={param.label} /></div>;
        }
        if (param.type === 'columns') {
          const selected = parseArray(value);
          const target = String(params.target_column || '');
          const featureColumns = allColumns.filter((column) => column !== target);
          return <div className="field" key={param.name}>{label}<button type="button" className="tiny-action icon-only" title="انتخاب همه" aria-label="انتخاب همه" onClick={() => update(param.name, featureColumns)}><CheckSquare size={12} /></button><PillPicker items={featureColumns} selected={selected} onChange={(next) => update(param.name, next)} empty="ستونی برای انتخاب پیدا نشد." /></div>;
        }
        if (param.type === 'color') {
          return <label className="field color-field" key={param.name}>{label}<input type="color" value={String(value || '#31cde3')} onChange={(event) => update(param.name, event.target.value)} /></label>;
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
