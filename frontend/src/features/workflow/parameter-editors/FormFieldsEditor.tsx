import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Select } from '../../../shared/ui';

type FormField = { id: string; label: string; type: string; required: boolean; min?: number; max?: number; choices?: string[]; value?: string | number | boolean | null };
const types = [
  { value: 'text', label: 'متن کوتاه' }, { value: 'long_text', label: 'متن بلند' },
  { value: 'number', label: 'عدد' }, { value: 'score', label: 'امتیاز / معیار' }, { value: 'date', label: 'تاریخ' },
  { value: 'choice', label: 'انتخابی' }, { value: 'boolean', label: 'بله / خیر' },
  { value: 'file', label: 'فایل' },
];

function parse(value: unknown): FormField[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object') as FormField[];
  if (typeof value === 'string' && value.trim()) {
    try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parse(parsed) : []; } catch { return []; }
  }
  return [];
}

export function FormFieldsEditor({ value, onChange, optional = false, mode = 'dynamic', showRequired = true }: { value: unknown; onChange: (fields: FormField[]) => void; optional?: boolean; mode?: 'static' | 'dynamic'; showRequired?: boolean }) {
  const fields = parse(value);
  const [expanded, setExpanded] = useState(0);
  const update = (index: number, patch: Partial<FormField>) => onChange(fields.map((field, i) => i === index ? { ...field, ...patch } : field));
  const add = () => {
    let index = fields.length + 1;
    while (fields.some((field) => field.id === `field_${index}`)) index += 1;
    setExpanded(fields.length);
    onChange([...fields, { id: `field_${index}`, label: '', type: 'text', required: true }]);
  };
  return <div className="review-form-fields" dir="rtl">
    {fields.length === 0 && <div className="empty-state small">{optional ? 'استخراج فیلد اختیاری است.' : 'هنوز فیلدی تعریف نشده است.'}</div>}
    {fields.map((field, index) => <div className={`review-form-field workflow-shell-card ${expanded === index ? 'review-form-field-open' : ''}`} key={field.id || index}>
      <div className="review-form-field-head"><button type="button" className="review-form-field-toggle" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? -1 : index)}><b>{field.label || `فیلد ${index + 1}`}</b><small dir="ltr">{field.id || 'new_field'} · {types.find((item) => item.value === field.type)?.label || field.type}</small></button><button type="button" className="tiny-action icon-only" aria-label={`حذف ${field.label || `فیلد ${index + 1}`}`} onClick={() => { onChange(fields.filter((_, i) => i !== index)); setExpanded(expanded === index ? -1 : expanded > index ? expanded - 1 : expanded); }}><Trash2 size={14} /></button></div>
      {expanded === index && <div className="review-form-field-grid">
        <label className="field"><span>عنوان نمایشی</span><input value={field.label || ''} onChange={(e) => update(index, { label: e.target.value })} placeholder="عنوان پروژه" /></label>
        <div className="field"><span>نوع پاسخ</span><Select value={field.type || 'text'} options={types} onChange={(next) => update(index, { type: next })} ariaLabel="نوع پاسخ" /></div>
        {showRequired && <label className="review-form-required pretty-checkbox"><input type="checkbox" checked={Boolean(field.required)} onChange={(e) => update(index, { required: e.target.checked })} /><span className="checkmark" aria-hidden="true" /><span>پاسخ الزامی است</span></label>}
        {(field.type === 'number' || field.type === 'score') && <>
          <label className="field"><span>کمینه</span><input type="number" value={field.min ?? ''} onChange={(e) => update(index, { min: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
          <label className="field"><span>بیشینه / وزن</span><input type="number" value={field.max ?? ''} onChange={(e) => update(index, { max: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        </>}
        {field.type === 'choice' && <label className="field"><span>گزینه‌ها (هر خط یک گزینه)</span><textarea rows={3} value={(field.choices || []).join('\n')} onChange={(e) => update(index, { choices: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></label>}
        {mode === 'static' && <label className="field review-form-static-value"><span>مقدار ثبت‌شده</span>
          {field.type === 'long_text' ? <textarea rows={3} value={String(field.value ?? '')} onChange={(e) => update(index, { value: e.target.value })} />
            : field.type === 'choice' ? <select value={String(field.value ?? '')} onChange={(e) => update(index, { value: e.target.value || null })}><option value="">انتخاب کنید</option>{(field.choices || []).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select>
              : field.type === 'boolean' ? <select value={field.value === true ? 'true' : field.value === false ? 'false' : ''} onChange={(e) => update(index, { value: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">انتخاب کنید</option><option value="true">بله</option><option value="false">خیر</option></select>
                : field.type === 'file' ? <small>فایل را در حالت پویا از فرم کاربر دریافت کنید.</small>
                  : <input type={field.type === 'number' || field.type === 'score' ? 'number' : field.type === 'date' ? 'date' : 'text'} min={field.min} max={field.max} value={String(field.value ?? '')} onChange={(e) => update(index, { value: field.type === 'number' || field.type === 'score' ? e.target.value === '' ? null : Number(e.target.value) : e.target.value })} />}
        </label>}
        <details className="review-form-advanced"><summary>شناسه اتصال (پیشرفته)</summary><label className="field"><span>شناسه ثابت</span><input dir="ltr" value={field.id || ''} onChange={(e) => update(index, { id: e.target.value })} placeholder="project_title" pattern="[a-z][a-z0-9_]*" /><small>حروف کوچک انگلیسی، عدد و _؛ پس از ثبت پاسخ تغییر ندهید.</small></label></details>
      </div>}
    </div>)}
    <button type="button" className="primary add-replacement-block" onClick={add}><Plus size={13} /> افزودن فیلد</button>
  </div>;
}
