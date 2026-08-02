import { Check, ChevronDown, Eye, Pencil, Search, UserRoundCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssignableUser, Project, ProjectPayload, ProjectPriority } from '../../shared/_types';
import { getDefaultProjectColor, getProjectColors } from '../../shared/_utils/appShared';

const PRIORITY_OPTIONS: Array<{ value: ProjectPriority; label: string }> = [
  { value: 'low', label: 'کم' }, { value: 'medium', label: 'متوسط' }, { value: 'high', label: 'زیاد' }
];
const roleLabel = (role: string) => ({ admin: 'مدیر سیستم', manager: 'مدیر', expert: 'کارشناس', guest: 'مهمان' }[role] || role);

type AssignmentMode = 'view' | 'edit';

export function ProjectPriorityBadge({ priority }: { priority?: ProjectPriority }) {
  const value = priority || 'medium';
  const label = PRIORITY_OPTIONS.find((option) => option.value === value)?.label || 'متوسط';
  return <span className={`project-priority ${value}`}>{label}</span>;
}

export function ProjectStatus({ state }: { state: Project['state'] }) {
  return <span className={`project-state ${state}`}>{state === 'open' ? 'باز' : 'بسته'}</span>;
}

function AssignmentPicker({
  mode,
  users,
  selectedIds,
  onChange,
}: {
  mode: AssignmentMode;
  users: AssignableUser[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const multiple = mode === 'view';
  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    if (!normalized) return users;
    return users.filter((user) => `${user.display_name} ${user.username} ${roleLabel(user.role)}`.toLocaleLowerCase('fa').includes(normalized));
  }, [query, users]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = (userId: number) => {
    if (!multiple) {
      onChange([userId]);
      setOpen(false);
      return;
    }
    onChange(selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]);
  };

  return (
    <div className={`assignment-picker ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button className="assignment-picker-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={selectedUsers.length ? '' : 'is-placeholder'}>
          {selectedUsers.length === 0
            ? (multiple ? 'انتخاب کاربران برای مشاهده' : 'انتخاب کاربر ویرایشگر')
            : multiple
              ? `${selectedUsers.length.toLocaleString('fa-IR')} کاربر انتخاب شده`
              : selectedUsers[0].display_name}
        </span>
        <ChevronDown size={16} />
      </button>

      {selectedUsers.length > 0 && multiple && (
        <div className="assignment-selected-chips">
          {selectedUsers.map((user) => (
            <button key={user.id} type="button" onClick={() => toggle(user.id)}>
              {user.display_name}<X size={12} />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="assignment-picker-menu">
          <div className="assignment-picker-search"><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام یا نقش..." /></div>
          <div className="assignment-picker-options">
            {filteredUsers.map((user) => {
              const selected = selectedIds.includes(user.id);
              return (
                <button key={user.id} type="button" className={`assignment-picker-option ${selected ? 'is-selected' : ''}`} onClick={() => toggle(user.id)}>
                  <span className="assignment-picker-check">{selected && <Check size={14} />}</span>
                  <span className="assignment-picker-person"><b>{user.display_name}</b><small>{user.username} · {roleLabel(user.role)}</small></span>
                </button>
              );
            })}
            {filteredUsers.length === 0 && <div className="assignment-picker-empty">کاربری پیدا نشد.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectForm({
  value,
  onChange,
  compact = false,
  readOnly = false,
  canManageAssignments = false,
  assignableUsers = [],
}: {
  value: ProjectPayload;
  onChange: (next: ProjectPayload) => void;
  compact?: boolean;
  readOnly?: boolean;
  canManageAssignments?: boolean;
  assignableUsers?: AssignableUser[];
}) {
  const setField = <K extends keyof ProjectPayload>(key: K, fieldValue: ProjectPayload[K]) => onChange({ ...value, [key]: fieldValue });
  const projectColors = getProjectColors();
  const defaultProjectColor = getDefaultProjectColor();
  const editAssignment = value.assignments.find((item) => item.access_type === 'edit');
  const viewUserIds = value.assignments.filter((item) => item.access_type === 'view').map((item) => item.user_id);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(editAssignment ? 'edit' : 'view');

  const editorUsers = assignableUsers.filter((item) => item.role === 'expert');
  const viewerUsers = assignableUsers.filter((item) => item.role !== 'admin' && item.id !== editAssignment?.user_id);

  const setEditor = (userId: number | null) => {
    const views = value.assignments.filter((item) => item.access_type === 'view' && item.user_id !== userId);
    setField('assignments', userId ? [{ user_id: userId, access_type: 'edit' }, ...views] : views);
  };
  const setViewers = (userIds: number[]) => {
    const edit = value.assignments.filter((item) => item.access_type === 'edit' && !userIds.includes(item.user_id));
    setField('assignments', [...edit, ...userIds.map((userId) => ({ user_id: userId, access_type: 'view' as const }))]);
  };

  return (
    <div className={`project-form ${compact ? 'compact' : ''} ${readOnly ? 'is-readonly' : ''}`}>
      <div className="project-form-primary-grid">
        <label>نام پروژه<input disabled={readOnly} value={value.name} onChange={(event) => setField('name', event.target.value)} placeholder="مثلاً تحلیل فروش معدن" /></label>
        <label>مدیر پروژه<input disabled={readOnly} value={value.project_manager} onChange={(event) => setField('project_manager', event.target.value)} placeholder="نام مدیر پروژه" /></label>
      </div>
      <div className="form-grid-2">
        <label>تاریخ شروع<input disabled={readOnly} type="date" value={value.start_date || ''} onChange={(event) => setField('start_date', event.target.value || null)} /></label>
        <label>تاریخ تحویل<input disabled={readOnly} type="date" value={value.due_date || ''} onChange={(event) => setField('due_date', event.target.value || null)} /></label>
      </div>
      <div className="form-grid-2 project-state-color-row">
        <label>وضعیت<select disabled={readOnly} value={value.state} onChange={(event) => setField('state', event.target.value as Project['state'])}><option value="open">باز</option><option value="closed">بسته</option></select></label>
        <label>اولویت<select disabled={readOnly} value={value.priority} onChange={(event) => setField('priority', event.target.value as ProjectPriority)}>{PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <label>رنگ پروژه<div className="project-color-control"><input disabled={readOnly} type="color" value={value.color || defaultProjectColor} onChange={(event) => setField('color', event.target.value)} aria-label="رنگ پروژه" /><div className="project-color-swatches">{projectColors.map((color) => <button disabled={readOnly} key={color} type="button" className={value.color === color ? 'active' : ''} style={{ ['--swatch' as string]: color }} onClick={() => setField('color', color)} aria-label={`انتخاب رنگ ${color}`} />)}</div></div></label>
      <label>توضیحات<textarea disabled={readOnly} value={value.description} onChange={(event) => setField('description', event.target.value)} placeholder="هدف پروژه، دامنه داده‌ها، توضیحات مدیریتی..." /></label>

      {canManageAssignments && !readOnly && (
        <section className="project-assignment-editor">
          <div className="assignment-editor-title"><UserRoundCheck size={16} /><div><b>دسترسی کاربران</b><span>نوع دسترسی را انتخاب کنید، سپس کاربر را از فهرست مشخص کنید.</span></div></div>
          <div className="assignment-mode-switch" role="tablist" aria-label="نوع دسترسی">
            <button type="button" className={assignmentMode === 'view' ? 'active' : ''} onClick={() => setAssignmentMode('view')}><Eye size={14} /> مشاهده</button>
            <button type="button" className={assignmentMode === 'edit' ? 'active' : ''} onClick={() => setAssignmentMode('edit')}><Pencil size={14} /> ویرایش</button>
          </div>
          {assignmentMode === 'edit' ? (
            <AssignmentPicker mode="edit" users={editorUsers} selectedIds={editAssignment ? [editAssignment.user_id] : []} onChange={(ids) => setEditor(ids[0] || null)} />
          ) : (
            <AssignmentPicker mode="view" users={viewerUsers} selectedIds={viewUserIds} onChange={setViewers} />
          )}
        </section>
      )}
    </div>
  );
}
