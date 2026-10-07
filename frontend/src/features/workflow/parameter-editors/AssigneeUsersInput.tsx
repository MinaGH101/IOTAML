import { useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { request } from '../../../shared/api/httpClient';
import { MultiSelect } from './Pickers';

type Assignee = { username: string; display_name: string; role: string };

export function AssigneeUsersInput({ value, onChange }: { value: unknown; onChange: (users: string) => void }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<Assignee[]>([]);
  const [error, setError] = useState('');
  const projectId = Number(window.location.pathname.match(/^\/projects\/(\d+)\//)?.[1] || 0);
  const selected = String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  useEffect(() => {
    let active = true;
    if (!projectId) {
      setUsers(user ? [{ username: user.username, display_name: `${user.first_name} ${user.last_name}`.trim() || user.username, role: user.role }] : []);
      return () => { active = false; };
    }
    request<Assignee[]>(`/api/projects/${projectId}/review-assignees`)
      .then((items) => { if (active) { setUsers(items); setError(''); } })
      .catch((exc: unknown) => { if (active) setError(exc instanceof Error ? exc.message : 'فهرست کاربران بارگذاری نشد.'); });
    return () => { active = false; };
  }, [projectId, user]);
  return <div className="assignee-picker" dir="rtl">
    <p>افراد دارای دسترسی به پروژه را انتخاب کنید. هر نفر وظیفه مستقل دریافت می‌کند.</p>
    <MultiSelect options={users.map((candidate) => ({ value: candidate.username.toLowerCase(), label: candidate.display_name, description: `${candidate.username} · ${candidate.role}` }))} selected={selected} onChange={(next) => onChange(next.join(', '))} empty="کاربر قابل تخصیصی پیدا نشد." />
    {selected.filter((name) => !users.some((candidate) => candidate.username.toLowerCase() === name)).map((name) =>
      <small className="data-file-error assignee-missing" key={name}>{name}: دسترسی به این پروژه یافت نشد.</small>)}
    {error && <small className="data-file-error">{error}</small>}
  </div>;
}
