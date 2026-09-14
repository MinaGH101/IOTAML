import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import type { AdminUser, AdminUserPayload, UserProfile, UserRole } from '../../shared/_types';
import { AppTopNav } from '../../shared/_components/AppTopNav';
import { formatDate, messageFromError, type UiMessage } from '../../shared/_utils/appShared';
import { adminApi, type AdminUserDetail } from '../_service/adminApi';

const emptyDraft: AdminUserPayload = { username: '', email: '', password: '', first_name: '', last_name: '', phone_number: '', title: '', department: '', role: 'expert', is_active: true };
const roleLabel = (role: UserRole) => ({ admin: 'مدیر سیستم', manager: 'مدیر', expert: 'کارشناس', guest: 'مهمان' }[role]);

export function AdminPage({ user, onBack, onProjects, onProfile, onLogout }: { user: UserProfile; onBack: () => void; onProjects: () => void; onProfile: () => void; onLogout: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<AdminUserPayload>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  const refresh = useCallback(async () => setUsers(await adminApi.users()), []);
  useEffect(() => { refresh().catch((error) => setMessage(messageFromError(error, 'دریافت کاربران ناموفق بود'))); }, [refresh]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? users.filter((item) => `${item.first_name} ${item.last_name} ${item.username} ${item.email} ${item.role}`.toLowerCase().includes(value)) : users;
  }, [query, users]);

  const openUser = async (item: AdminUser) => {
    setCreating(false); setBusy(true);
    try {
      const detail = await adminApi.user(item.id); setSelected(detail);
      setDraft({ username: detail.user.username, email: detail.user.email, password: '', first_name: detail.user.first_name, last_name: detail.user.last_name, phone_number: detail.user.phone_number, title: detail.user.title, department: detail.user.department, role: detail.user.role, is_active: detail.user.is_active });
    } catch (error) { setMessage(messageFromError(error, 'دریافت پروفایل کاربر ناموفق بود')); }
    finally { setBusy(false); }
  };
  const beginCreate = () => { setCreating(true); setSelected(null); setDraft(emptyDraft); };
  const save = async () => {
    if (!draft.username.trim() || (creating && !draft.password)) { setMessage({ text: 'نام کاربری و رمز عبور الزامی است', tone: 'error' }); return; }
    setBusy(true);
    try {
      if (creating) await adminApi.createUser({ ...draft, password: draft.password || '' });
      else if (selected) await adminApi.updateUser(selected.user.id, { ...draft, password: draft.password || undefined });
      await refresh(); setMessage({ text: creating ? 'کاربر ساخته شد' : 'پروفایل کاربر ذخیره شد', tone: 'success' });
      if (selected && !creating) await openUser({ ...selected.user, ...draft } as AdminUser); else { setCreating(false); setDraft(emptyDraft); }
    } catch (error) { setMessage(messageFromError(error, 'ذخیره کاربر ناموفق بود')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`کاربر «${selected.user.username}» حذف شود؟`)) return;
    setBusy(true);
    try { await adminApi.deleteUser(selected.user.id); setSelected(null); setDraft(emptyDraft); await refresh(); setMessage({ text: 'کاربر حذف شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'حذف کاربر ناموفق بود')); }
    finally { setBusy(false); }
  };
  const setField = <K extends keyof AdminUserPayload>(key: K, value: AdminUserPayload[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return <div className="app-shell manager-shell iota-reference-shell">
    <AppTopNav user={user} title="پنل مدیریت" onBack={onBack} onProjects={onProjects} onProfile={onProfile} onLogout={onLogout} />
    <main className="manager-page admin-page iota-minimal-page">
      {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}
      <header className="admin-page-heading">
        <div>
          <h2>مدیریت کاربران</h2>
          <p>{users.length.toLocaleString('fa-IR')} حساب کاربری · نقش‌ها و دسترسی پروژه‌ها</p>
        </div>
      </header>
      <section className="admin-layout">
        <aside className="manager-panel admin-users-panel">
          <div className="admin-panel-head"><div><ShieldCheck size={18} /><span><b>کاربران</b><small>{users.length.toLocaleString('fa-IR')} حساب</small></span></div><button className="primary" type="button" onClick={beginCreate}><Plus size={15} /> کاربر جدید</button></div>
          <div className="project-filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام، ایمیل یا نقش" /></div>
          <div className="admin-user-list">{filtered.map((item) => <button key={item.id} className={`admin-user-row ${selected?.user.id === item.id ? 'active' : ''}`} type="button" onClick={() => void openUser(item)}><span className="admin-user-avatar"><UserRound size={16} /></span><span><b>{`${item.first_name} ${item.last_name}`.trim() || item.username}</b><small>{item.username}</small></span><span className={`role-badge role-${item.role}`}>{roleLabel(item.role)}</span><small>{item.owned_project_count + item.assigned_project_count} پروژه</small></button>)}</div>
        </aside>
        <section className="manager-panel admin-editor-panel">
          {!creating && !selected ? <div className="admin-empty"><UserRound size={28} /><b>یک کاربر را انتخاب کنید</b><span>پروفایل، نقش و دسترسی پروژه‌های او اینجا نمایش داده می‌شود.</span></div> : <>
            <div className="admin-editor-head"><div><b>{creating ? 'ایجاد کاربر' : 'ویرایش کاربر'}</b><span>{creating ? 'اطلاعات حساب و نقش را ثبت کنید' : `آخرین بروزرسانی: ${formatDate(selected?.user.updated_at)}`}</span></div><button className="tiny-icon" type="button" onClick={() => { setCreating(false); setSelected(null); }}><X size={15} /></button></div>
            <div className="admin-user-form">
              <div className="form-grid-2"><label>نام<input value={draft.first_name} onChange={(e) => setField('first_name', e.target.value)} /></label><label>نام خانوادگی<input value={draft.last_name} onChange={(e) => setField('last_name', e.target.value)} /></label></div>
              <div className="form-grid-2"><label>ایمیل<input value={draft.email} onChange={(e) => setField('email', e.target.value)} /></label><label>نام کاربری<input disabled={!creating} value={draft.username} onChange={(e) => setField('username', e.target.value)} />{!creating && <small>نام کاربری پس از ایجاد ثابت است.</small>}</label></div>
              <div className="form-grid-2"><label>نقش<select value={draft.role} onChange={(e) => setField('role', e.target.value as UserRole)}><option value="admin">مدیر سیستم</option><option value="manager">مدیر</option><option value="expert">کارشناس</option><option value="guest">مهمان</option></select></label><label>{creating ? 'رمز عبور' : 'رمز جدید (اختیاری)'}<input type="password" value={draft.password || ''} onChange={(e) => setField('password', e.target.value)} /></label></div>
              <div className="form-grid-2"><label>عنوان<input value={draft.title} onChange={(e) => setField('title', e.target.value)} /></label><label>واحد<input value={draft.department} onChange={(e) => setField('department', e.target.value)} /></label></div>
              <label className="admin-active-toggle"><input type="checkbox" checked={draft.is_active} onChange={(e) => setField('is_active', e.target.checked)} /> حساب فعال باشد</label>
            </div>
            <div className="admin-editor-actions"><button className="primary" disabled={busy} type="button" onClick={() => void save()}>{busy ? <RefreshCw className="spin" size={15} /> : <Save size={15} />} ذخیره</button>{selected && <button className="danger" disabled={busy || selected.user.id === user.id} type="button" onClick={() => void remove()}><Trash2 size={15} /> حذف کاربر</button>}</div>
            {selected && <section className="admin-project-access"><div className="admin-access-head"><FolderKanban size={16} /><div><b>پروژه‌ها و نوع دسترسی</b><span>مالکیت و پروژه‌های تخصیص داده‌شده</span></div></div><div className="admin-project-list">{selected.projects.map((project) => <div key={`${project.id}-${project.access_type}`} className="admin-project-row"><span><b>{project.name}</b><small>مالک: {project.owner_username}</small></span><span className={`access-badge access-${project.access_type}`}>{project.access_type === 'owner' ? 'مالک' : project.access_type === 'edit' ? 'ویرایش' : 'مشاهده'}</span></div>)}{selected.projects.length === 0 && <div className="empty-state small">این کاربر هنوز پروژه‌ای ندارد.</div>}</div></section>}
          </>}
        </section>
      </section>
    </main>
  </div>;
}
