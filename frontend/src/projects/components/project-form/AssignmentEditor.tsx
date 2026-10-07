import { Eye, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AssignableUser, ProjectAssignmentAccess, ProjectPayload } from '../../../shared/types';
import { SearchField } from '../../../shared/ui';

export function AssignmentEditor({ value, users, setAssignments }: {
  value: ProjectPayload; users: AssignableUser[];
  setAssignments: (next: ProjectPayload['assignments']) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedIds = new Set(value.assignments.map((item) => item.user_id));
  const byId = new Map(users.map((user) => [user.id, user]));
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fa');
    if (!term) return [];
    return users.filter((user) => !selectedIds.has(user.id)
      && `${user.display_name} ${user.username}`.toLocaleLowerCase('fa').includes(term)).slice(0, 8);
  }, [query, users, value.assignments]);
  const add = (user: AssignableUser) => {
    setAssignments([...value.assignments, { user_id: user.id, access_type: user.role === 'guest' ? 'view' : 'edit' }]);
    setQuery('');
  };
  const access = (userId: number, access_type: ProjectAssignmentAccess) => setAssignments(
    value.assignments.map((item) => item.user_id === userId ? { ...item, access_type } : item));
  const remove = (userId: number) => setAssignments(value.assignments.filter((item) => item.user_id !== userId));
  return <section className="project-assignment-editor">
    <div className="assignment-editor-title"><Users size={18} /><div><b>اعضای تیم</b><span>نام یا ایمیل کاربر را جستجو کنید و سطح دسترسی او را تعیین کنید.</span></div></div>
    <SearchField containerClassName="team-member-search" leading={<Search size={16} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام یا ایمیل کاربر..." aria-label="جستجوی عضو تیم" />
    {matches.length > 0 && <div className="team-search-results">{matches.map((user) => <button type="button" key={user.id} onClick={() => add(user)}>
      <span className="team-avatar">{user.display_name.slice(0, 1)}</span><span><b>{user.display_name}</b><small>{user.username}</small></span><UserPlus size={16} />
    </button>)}</div>}
    {query.trim() && matches.length === 0 && <p className="team-search-empty">کاربر دیگری با این نام پیدا نشد.</p>}
    <div className="team-member-list">{value.assignments.map((item) => {
      const user = byId.get(item.user_id); if (!user) return null;
      return <article key={item.user_id}><span className="team-avatar">{user.display_name.slice(0, 1)}</span><div className="team-member-identity"><b>{user.display_name}</b><small>{user.username}</small></div>
        <div className="team-access-switch" role="group" aria-label={`دسترسی ${user.display_name}`}>
          <button type="button" className={item.access_type === 'view' ? 'active' : ''} onClick={() => access(item.user_id, 'view')}><Eye size={14} /> مشاهده</button>
          <button type="button" disabled={user.role === 'guest'} className={item.access_type === 'edit' ? 'active' : ''} onClick={() => access(item.user_id, 'edit')}><Pencil size={14} /> ویرایش</button>
        </div><button className="team-member-remove" type="button" aria-label={`حذف ${user.display_name}`} onClick={() => remove(item.user_id)}><Trash2 size={15} /></button>
      </article>;
    })}{value.assignments.length === 0 && <div className="team-members-empty"><Users size={22} /><span>هنوز عضوی اضافه نشده است.</span></div>}</div>
  </section>;
}
