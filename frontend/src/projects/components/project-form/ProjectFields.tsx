import type { Project, ProjectPayload, ProjectPriority } from '../../../shared/types';
import { Field, Input, Select, Textarea } from '../../../shared/ui';
import { getDefaultProjectColor, getProjectColors } from '../../../shared/lib/theme';
import { PRIORITY_OPTIONS } from './constants';

type Props = { value: ProjectPayload; readOnly: boolean; setField: <K extends keyof ProjectPayload>(key: K, value: ProjectPayload[K]) => void };

export function ProjectFields({ value, readOnly, setField }: Props) {
  const colors = getProjectColors();
  return <>
    <div className="project-form-primary-grid">
      <Field label="نام پروژه"><Input disabled={readOnly} value={value.name} onChange={(e) => setField('name', e.target.value)} placeholder="مثلاً تحلیل فروش معدن" /></Field>
      <Field label="مدیر پروژه"><Input disabled={readOnly} value={value.project_manager} onChange={(e) => setField('project_manager', e.target.value)} placeholder="نام مدیر پروژه" /></Field>
    </div>
    <div className="form-grid-2">
      <Field label="تاریخ شروع"><Input disabled={readOnly} type="date" value={value.start_date || ''} onChange={(e) => setField('start_date', e.target.value || null)} /></Field>
      <Field label="تاریخ تحویل"><Input disabled={readOnly} type="date" value={value.due_date || ''} onChange={(e) => setField('due_date', e.target.value || null)} /></Field>
    </div>
    <div className="form-grid-2 project-state-color-row">
      <Field label="وضعیت"><Select ariaLabel="وضعیت" disabled={readOnly} value={value.state} onChange={(next) => setField('state', next as Project['state'])} options={[{ value: 'open', label: 'باز' }, { value: 'closed', label: 'بسته' }]} /></Field>
      <Field label="اولویت"><Select ariaLabel="اولویت" disabled={readOnly} value={value.priority} onChange={(next) => setField('priority', next as ProjectPriority)} options={PRIORITY_OPTIONS} /></Field>
    </div>
    <Field label="رنگ پروژه"><div className="project-color-control"><input disabled={readOnly} type="color" value={value.color || getDefaultProjectColor()} onChange={(e) => setField('color', e.target.value)} aria-label="رنگ پروژه" /><div className="project-color-swatches">{colors.map((color) => <button disabled={readOnly} key={color} type="button" className={value.color === color ? 'active' : ''} style={{ ['--swatch' as string]: color }} onClick={() => setField('color', color)} aria-label={`انتخاب رنگ ${color}`} />)}</div></div></Field>
    <Field label="توضیحات"><Textarea disabled={readOnly} value={value.description} onChange={(e) => setField('description', e.target.value)} placeholder="هدف پروژه، دامنه داده‌ها، توضیحات مدیریتی..." /></Field>
  </>;
}
