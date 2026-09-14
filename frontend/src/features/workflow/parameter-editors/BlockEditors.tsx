import { Plus, Trash2 } from 'lucide-react';
import { CustomSelect } from '../../../shared/_components/CustomSelect';
import { readThemeColor } from '../../../shared/_utils/appShared';
import { SelectionToggleButton } from '../../../workspace/_components/SelectionToggleButton';
import { PillPicker } from './Pickers';

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

export function ReplacementBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ReplacementBlock[]) => void }) {
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
              <b>بلوک {index + 1}</b>
              <button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button>
            </div>
            <div className="field compact-field">
              <span>ستون‌ها</span>
              <SelectionToggleButton items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} />
              <PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." />
            </div>
            <div className="replacement-grid">
              <label className="field"><span>روش جستجو</span><CustomSelect value={findMode} options={[{ value: 'value', label: 'مقدار' }, { value: 'type', label: 'نوع مقدار' }]} onChange={(next) => updateBlock(index, { find_mode: next as 'value' | 'type' })} /></label>
              {findMode === 'value' ? <>
                <label className="field"><span>شرط</span><CustomSelect value={block.condition || 'match'} options={[
                  { value: 'match', label: 'مطابقت' }, { value: 'include', label: 'شامل باشد' }, { value: 'starts_with', label: 'شروع شود با' }, { value: 'ends_with', label: 'پایان یابد با' }, { value: 'regex', label: 'عبارت منظم' },
                  { value: '>', label: '>' }, { value: '>=', label: '>=' }, { value: '<', label: '<' }, { value: '<=', label: '<=' },
                ]} onChange={(next) => updateBlock(index, { condition: next })} /></label>
                <label className="field"><span>مقدار جستجو</span><input dir="ltr" value={String(block.find_value ?? '')} onChange={(event) => updateBlock(index, { find_value: event.target.value })} placeholder="<0.1" /></label>
              </> : <label className="field"><span>نوع مقدار</span><CustomSelect value={block.value_type || 'string'} options={[
                { value: 'string', label: 'متن' }, { value: 'numeric', label: 'عددی' }, { value: 'int', label: 'عدد صحیح' }, { value: 'float', label: 'عدد اعشاری' }, { value: 'missing', label: 'خالی / بدون مقدار' },
              ]} onChange={(next) => updateBlock(index, { value_type: next })} /></label>}
              <label className="field"><span>جایگزینی</span><CustomSelect value={replacementMode} options={[{ value: 'value', label: 'مقدار واردشده' }, { value: 'none', label: 'خالی / بدون مقدار' }]} onChange={(next) => updateBlock(index, { replacement_mode: next as 'value' | 'none' })} /></label>
              {replacementMode === 'value' && <label className="field"><span>مقدار جایگزین</span><input dir="ltr" value={String(block.replacement_value ?? '')} onChange={(event) => updateBlock(index, { replacement_value: event.target.value })} /></label>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> افزودن بلوک جایگزینی</button>
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

export function ImputationBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ImputationBlock[]) => void }) {
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
            <div className="replacement-block-head"><b>بلوک {index + 1}</b><button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button></div>
            <div className="field compact-field"><span>ستون‌ها</span><SelectionToggleButton items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} /><PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." /></div>
            <div className="replacement-grid">
              <label className="field"><span>روش</span><CustomSelect value={method} options={[{value:'mean',label:'میانگین'}, {value:'median',label:'میانه'}, {value:'constant',label:'مقدار ثابت'}, {value:'interpolate',label:'درون‌یابی'}, {value:'knn',label:'KNN'}]} onChange={(next) => updateBlock(index, { method: next })} /></label>
              {method === 'constant' && <label className="field"><span>مقدار ثابت</span><input dir="ltr" value={String(block.constant_value ?? '')} onChange={(event) => updateBlock(index, { constant_value: event.target.value })} /></label>}
              {method === 'interpolate' && <><label className="field"><span>روش درون‌یابی</span><CustomSelect value={block.interpolation_method || 'linear'} options={[{value:'linear',label:'خطی'}, {value:'nearest',label:'نزدیک‌ترین'}, {value:'zero',label:'صفر'}, {value:'slinear',label:'خطی مرتبه اول'}]} onChange={(next) => updateBlock(index, { interpolation_method: next })} /></label><label className="field"><span>جهت محدودیت</span><CustomSelect value={block.limit_direction || 'both'} options={[{value:'both',label:'هر دو'}, {value:'forward',label:'رو به جلو'}, {value:'backward',label:'رو به عقب'}]} onChange={(next) => updateBlock(index, { limit_direction: next })} /></label></>}
              {method === 'knn' && <><label className="field"><span>تعداد همسایه‌ها</span><input type="number" min={1} value={Number(block.n_neighbors || 5)} onChange={(event) => updateBlock(index, { n_neighbors: Number(event.target.value) })} /></label><label className="field"><span>وزن‌دهی</span><CustomSelect value={block.weights || 'uniform'} options={[{value:'uniform',label:'یکنواخت'}, {value:'distance',label:'فاصله'}]} onChange={(next) => updateBlock(index, { weights: next })} /></label></>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> افزودن بلوک جایگذاری</button>
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

export function NormalizationBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: NormalizationBlock[]) => void }) {
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
            <div className="replacement-block-head"><b>بلوک {index + 1}</b><button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button></div>
            <div className="field compact-field"><span>ستون‌ها</span><SelectionToggleButton items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} /><PillPicker items={columns} selected={(block.columns || []).map(String)} onChange={(next) => updateBlock(index, { columns: next })} empty="ابتدا نود را به داده وصل کنید." /></div>
            <div className="replacement-grid">
              <label className="field"><span>روش</span><CustomSelect value={method} options={[{value:'ln',label:'Ln'}, {value:'log10',label:'Log10'}, {value:'sqrt',label:'Sqrt'}, {value:'boxcox',label:'Box-Cox'}, {value:'yeo_johnson',label:'Yeo-Johnson'}, {value:'quantile_normal',label:'نرمال‌سازی چندکی'}, {value:'l1',label:'L1'}, {value:'l2',label:'L2'}, {value:'max',label:'بیشینه'}]} onChange={(next) => updateBlock(index, { method: next })} /></label>
              {['ln','log10','sqrt','boxcox'].includes(method) && <label className="field"><span>مقدار انتقال</span><input type="number" step="any" value={Number(block.offset || 0)} onChange={(event) => updateBlock(index, { offset: Number(event.target.value) })} /></label>}
              {['boxcox','yeo_johnson'].includes(method) && <label className="field checkbox pretty-checkbox"><span>استانداردسازی</span><input type="checkbox" checked={block.standardize !== false} onChange={(event) => updateBlock(index, { standardize: event.target.checked })} /><span className="checkmark" /></label>}
              {method === 'quantile_normal' && <><label className="field"><span>تعداد چندک‌ها</span><input type="number" min={2} value={Number(block.n_quantiles || 1000)} onChange={(event) => updateBlock(index, { n_quantiles: Number(event.target.value) })} /></label><label className="field"><span>حالت تصادفی</span><input type="number" value={Number(block.random_state || 42)} onChange={(event) => updateBlock(index, { random_state: Number(event.target.value) })} /></label></>}
            </div>
          </div>
        );
      })}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> افزودن بلوک نرمال‌سازی</button>
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

export function ScatterBlocksEditor({ value, columns, onChange }: { value: unknown; columns: string[]; onChange: (blocks: ScatterBlock[]) => void }) {
  const blocks = scatterBlocks(value);
  const plotColor = readThemeColor('--theme-plot-default');
  const nextBlock = (): ScatterBlock => ({ title: '', x_column: columns[0] || '', y_column: columns[1] || columns[0] || '', color: plotColor, x_min: null, x_max: null, y_min: null, y_max: null, point_size: 7, max_points: 1000 });
  const updateBlock = (index: number, patch: Partial<ScatterBlock>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));
  const columnOptions = [{ value: '', label: 'انتخاب ستون' }, ...columns.map((column) => ({ value: column, label: column }))];
  const numericValue = (value: unknown) => value === null || value === undefined ? '' : String(value);
  const parseOptionalNumber = (raw: string) => raw === '' ? null : Number(raw);

  return (
    <div className="replacement-blocks scatter-blocks-editor">
      {blocks.length === 0 && <div className="empty-state small">هیچ بلوک پراکندگی تعریف نشده است. هر بلوک یک نمودار مستقل می‌سازد.</div>}
      {blocks.map((block, index) => (
        <div className="replacement-block workflow-shell-card scatter-block" key={index}>
          <div className="replacement-block-head">
            <b>بلوک پراکندگی {index + 1}</b>
            <button type="button" className="tiny-action icon-only" title="حذف" aria-label="حذف" onClick={() => removeBlock(index)}><Trash2 size={12} /></button>
          </div>
          <label className="field"><span>عنوان نمودار</span><input dir="ltr" value={String(block.title || '')} placeholder="Fe vs Cu" onChange={(event) => updateBlock(index, { title: event.target.value })} /></label>
          <div className="replacement-grid">
            <label className="field"><span>ستون محور X</span><CustomSelect value={String(block.x_column || '')} options={columnOptions} onChange={(next) => updateBlock(index, { x_column: next })} /></label>
            <label className="field"><span>ستون محور Y</span><CustomSelect value={String(block.y_column || '')} options={columnOptions} onChange={(next) => updateBlock(index, { y_column: next })} /></label>
            <label className="field color-field"><span>رنگ</span><input type="color" value={String(block.color || plotColor)} onChange={(event) => updateBlock(index, { color: event.target.value })} /></label>
            <label className="field"><span>اندازه نقاط</span><input type="number" min={2} max={30} value={Number(block.point_size || 7)} onChange={(event) => updateBlock(index, { point_size: Number(event.target.value) })} /></label>
            <label className="field"><span>کمینه X</span><input type="number" step="any" value={numericValue(block.x_min)} onChange={(event) => updateBlock(index, { x_min: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>بیشینه X</span><input type="number" step="any" value={numericValue(block.x_max)} onChange={(event) => updateBlock(index, { x_max: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>کمینه Y</span><input type="number" step="any" value={numericValue(block.y_min)} onChange={(event) => updateBlock(index, { y_min: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>بیشینه Y</span><input type="number" step="any" value={numericValue(block.y_max)} onChange={(event) => updateBlock(index, { y_max: parseOptionalNumber(event.target.value) })} /></label>
            <label className="field"><span>حداکثر تعداد نقاط</span><input type="number" min={10} max={10000} value={Number(block.max_points || 1000)} onChange={(event) => updateBlock(index, { max_points: Number(event.target.value) })} /></label>
          </div>
        </div>
      ))}
      <button type="button" className="primary add-replacement-block" onClick={() => onChange([...blocks, nextBlock()])}><Plus size={13} /> افزودن بلوک پراکندگی</button>
    </div>
  );
}
