import { Eye, Pencil, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AssignableUser, ProjectPayload } from '../../../shared/types';
import { Button } from '../../../shared/ui';
import { AssignmentPicker } from './AssignmentPicker';
import type { AssignmentMode } from './constants';

export function AssignmentEditor({ value, users, setAssignments }: { value: ProjectPayload; users: AssignableUser[]; setAssignments: (next: ProjectPayload['assignments']) => void }) {
  const edit = value.assignments.find((item) => item.access_type === 'edit');
  const [mode, setMode] = useState<AssignmentMode>(edit ? 'edit' : 'view');
  const viewers = value.assignments.filter((item) => item.access_type === 'view').map((item) => item.user_id);
  const editorUsers = useMemo(() => users.filter((user) => user.role === 'expert'), [users]);
  const viewerUsers = useMemo(() => users.filter((user) => user.role !== 'admin' && user.id !== edit?.user_id), [edit?.user_id, users]);
  const setEditor = (userId: number | null) => {
    const views = value.assignments.filter((item) => item.access_type === 'view' && item.user_id !== userId);
    setAssignments(userId ? [{ user_id: userId, access_type: 'edit' }, ...views] : views);
  };
  const setViewers = (ids: number[]) => {
    const edits = value.assignments.filter((item) => item.access_type === 'edit' && !ids.includes(item.user_id));
    setAssignments([...edits, ...ids.map((user_id) => ({ user_id, access_type: 'view' as const }))]);
  };
  return <section className="project-assignment-editor">
    <div className="assignment-editor-title"><UserRoundCheck size={16} /><div><b>دسترسی کاربران</b><span>نوع دسترسی را انتخاب کنید، سپس کاربر را از فهرست مشخص کنید.</span></div></div>
    <div className="assignment-mode-switch" role="tablist" aria-label="نوع دسترسی">
      <Button size="sm" variant={mode === 'view' ? 'primary' : 'ghost'} onClick={() => setMode('view')} leadingIcon={<Eye size={14} />}>مشاهده</Button>
      <Button size="sm" variant={mode === 'edit' ? 'primary' : 'ghost'} onClick={() => setMode('edit')} leadingIcon={<Pencil size={14} />}>ویرایش</Button>
    </div>
    <AssignmentPicker mode={mode} users={mode === 'edit' ? editorUsers : viewerUsers} selectedIds={mode === 'edit' && edit ? [edit.user_id] : mode === 'view' ? viewers : []} onChange={(ids) => mode === 'edit' ? setEditor(ids[0] || null) : setViewers(ids)} />
  </section>;
}
