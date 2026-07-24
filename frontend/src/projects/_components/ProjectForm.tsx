import type { Project, ProjectPayload, ProjectPriority } from '../../shared/_types';
import { getDefaultProjectColor, getProjectColors } from '../../shared/_utils/appShared';

const PRIORITY_OPTIONS: Array<{ value: ProjectPriority; label: string }> = [
  { value: 'low', label: 'کم' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'زیاد' }
];

export function ProjectPriorityBadge({ priority }: { priority?: ProjectPriority }) {
  const value = priority || 'medium';
  const label = PRIORITY_OPTIONS.find((option) => option.value === value)?.label || 'متوسط';
  return <span className={`project-priority ${value}`}>{label}</span>;
}

export function ProjectStatus({ state }: { state: Project['state'] }) {
  return <span className={`project-state ${state}`}>{state === 'open' ? 'باز' : 'بسته'}</span>;
}

export function ProjectForm({ value, onChange, compact = false }: { value: ProjectPayload; onChange: (next: ProjectPayload) => void; compact?: boolean }) {
  const setField = <K extends keyof ProjectPayload>(key: K, fieldValue: ProjectPayload[K]) => onChange({ ...value, [key]: fieldValue });
  const projectColors = getProjectColors();
  const defaultProjectColor = getDefaultProjectColor();

  return (
    <div className={`project-form ${compact ? 'compact' : ''}`}>
      <label>
        نام پروژه
        <input value={value.name} onChange={(event) => setField('name', event.target.value)} placeholder="مثلاً تحلیل فروش معدن" />
      </label>

      <label>
        مدیر پروژه
        <input value={value.project_manager} onChange={(event) => setField('project_manager', event.target.value)} placeholder="نام مدیر پروژه" />
      </label>

      <div className="form-grid-2">
        <label>
          تاریخ شروع
          <input type="date" value={value.start_date || ''} onChange={(event) => setField('start_date', event.target.value || null)} />
        </label>
        <label>
          تاریخ تحویل
          <input type="date" value={value.due_date || ''} onChange={(event) => setField('due_date', event.target.value || null)} />
        </label>
      </div>

      <div className="form-grid-2 project-state-color-row">
        <label>
          وضعیت
          <select value={value.state} onChange={(event) => setField('state', event.target.value as Project['state'])}>
            <option value="open">باز</option>
            <option value="closed">بسته</option>
          </select>
        </label>
        <label>
          اولویت
          <select value={value.priority} onChange={(event) => setField('priority', event.target.value as ProjectPriority)}>
            {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <label>
        رنگ پروژه
        <div className="project-color-control">
          <input type="color" value={value.color || defaultProjectColor} onChange={(event) => setField('color', event.target.value)} aria-label="رنگ پروژه" />
          <div className="project-color-swatches">
            {projectColors.map((color) => (
              <button
                key={color}
                type="button"
                className={value.color === color ? 'active' : ''}
                style={{ ['--swatch' as string]: color }}
                onClick={() => setField('color', color)}
                aria-label={`انتخاب رنگ ${color}`}
              />
            ))}
          </div>
        </div>
      </label>

      <label>
        توضیحات
        <textarea value={value.description} onChange={(event) => setField('description', event.target.value)} placeholder="هدف پروژه، دامنه داده‌ها، توضیحات مدیریتی..." />
      </label>
    </div>
  );
}
