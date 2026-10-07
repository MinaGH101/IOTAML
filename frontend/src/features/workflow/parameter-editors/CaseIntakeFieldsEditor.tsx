import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Select } from '../../../shared/ui';

type IntakeField = { id: string; label: string; type: 'text' | 'number'; value: string | number | null };

function fieldsFrom(value: unknown): IntakeField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IntakeField => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
}

export function CaseIntakeFieldsEditor({ value, onChange, mode = 'static' }: { value: unknown; onChange: (fields: IntakeField[]) => void; mode?: 'static' | 'dynamic' }) {
  const fields = fieldsFrom(value);
  const [expanded, setExpanded] = useState(0);
  const update = (index: number, patch: Partial<IntakeField>) => onChange(fields.map((field, position) => position === index ? { ...field, ...patch } : field));
  const add = () => {
    const id = `custom_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    setExpanded(fields.length);
    onChange([...fields, { id, label: `فیلد جدید ${fields.length + 1}`, type: 'text', value: '' }]);
  };
  return <div className="case-intake-fields" dir="rtl">
    <p>{mode === 'static' ? 'نام، نوع و مقدار هر فیلد را تعیین کنید؛ شناسه اتصال با تغییر نام ثابت می‌ماند.' : 'فیلدهای فرم را تعریف کنید. کاربران بعد از ارجاع، مقدارها را در فرم وارد می‌کنند.'}</p>
    {fields.map((field, index) => <div className={`case-intake-field workflow-shell-card ${expanded === index ? 'case-intake-field-open' : ''}`} key={field.id}>
      <div className="case-intake-field-head"><button type="button" className="case-intake-field-toggle" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? -1 : index)}><strong>{index + 1}. {field.label || 'فیلد بدون نام'}</strong><small>{field.type === 'number' ? 'عدد' : 'متن'}{mode === 'static' && field.value !== null && field.value !== '' ? ` · ${String(field.value).slice(0, 45)}` : ''}</small></button>
        <button type="button" className="tiny-action icon-only" title="حذف فیلد" aria-label={`حذف ${field.label || `فیلد ${index + 1}`}`} onClick={() => { onChange(fields.filter((_, position) => position !== index)); setExpanded(expanded === index ? -1 : expanded > index ? expanded - 1 : expanded); }}><Trash2 size={14} /></button></div>
      {expanded === index && <><div className="case-intake-field-grid">
        <label className="field"><span>نام فیلد</span><input value={field.label || ''} maxLength={120} onChange={(event) => update(index, { label: event.target.value })} /></label>
        <div className="field"><span>نوع</span><Select value={field.type} options={[{ value: 'text', label: 'متن' }, { value: 'number', label: 'عدد' }]}
          onChange={(next) => update(index, { type: next as IntakeField['type'], value: next === 'number' ? null : String(field.value ?? '') })}
          ariaLabel={`نوع ${field.label || `فیلد ${index + 1}`}`} /></div>
        {mode === 'static' && <label className="field case-intake-field-value"><span>مقدار</span>
          <input type={field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined}
            value={String(field.value ?? '')} onChange={(event) => update(index, { value: field.type === 'number' ? event.target.value || null : event.target.value })}
            placeholder={field.id === 'project_code' ? 'خالی بگذارید تا کد خودکار ساخته شود' : undefined} /></label>}
      </div><small>شناسه ثابت: <code>{field.id}</code></small></>}
    </div>)}
    <button type="button" className="primary add-replacement-block" disabled={fields.length >= 60} onClick={add}><Plus size={14} /> افزودن فیلد</button>
  </div>;
}
