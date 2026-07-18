import { useState } from 'react';
import { Bell, Building2, Clock3, Mail, Phone, RefreshCw, Save, ShieldCheck, Upload, User, UserCircle } from 'lucide-react';
import { api } from '../api';
import { AppTopNav } from '../components/AppTopNav';
import type { UserProfile } from '../types';
import { mediaSrc, messageFromError, type UiMessage } from '../utils/appShared';

export function ProfilePage({
  user,
  onBack,
  onProjects,
  onSaved,
  onLogout
}: {
  user: UserProfile;
  onBack: () => void;
  onProjects: () => void;
  onSaved: (user: UserProfile) => void;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<UserProfile>(user);
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);

  const activity = draft.activity || [];
  const alarms = draft.alarms || [];
  const notifications = draft.notifications || [];
  const maxActivity = Math.max(1, ...activity.map((item) => Number(item.value) || 0));
  const displayName = `${draft.first_name || ''} ${draft.last_name || ''}`.trim() || draft.username;

  const setField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft({ ...draft, [key]: value });
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.updateProfile(draft);
      onSaved(saved);
      setDraft(saved);
      setMessage({ text: 'پروفایل ذخیره شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'ذخیره پروفایل ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  const uploadProfileImage = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage({ text: 'در حال آپلود تصویر پروفایل...', tone: 'info' });
    try {
      const saved = await api.uploadProfileImage(file);
      onSaved(saved);
      setDraft(saved);
      setMessage({ text: 'تصویر پروفایل ذخیره شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'آپلود تصویر ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell manager-shell">
      <AppTopNav
        user={user}
        title="پروفایل کاربر"
        subtitle="اطلاعات کاربری، فعالیت‌ها و اعلان‌ها"
        onBack={onBack}
        onProjects={onProjects}
        onProfile={() => {}}
        onLogout={onLogout}
      />

      <main className="manager-page profile-page profile-reference-page iota-minimal-page">
        {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}

        <section className="profile-layout-reference">
          <article className="manager-panel profile-main-card-reference">
            <p className="section-label-reference">اطلاعات حساب کاربری</p>

            <div className="profile-reference-head">
              <div className="profile-avatar-column-reference">
                <div className="profile-avatar profile-avatar-reference">
                  {draft.profile_image ? <img src={mediaSrc(draft.profile_image)} alt="profile" /> : <UserCircle size={54} />}
                </div>
                <label className="profile-image-picker profile-upload-button-reference">
                  <input type="file" accept="image/*" onChange={(event) => uploadProfileImage(event.target.files?.[0] || null)} />
                  <span><Upload size={13} /> انتخاب تصویر</span>
                </label>
              </div>

              <div className="profile-reference-identity">
                <div className="profile-title-line-reference">
                  <h2>{displayName}</h2>
                  <span className="access-badge-reference"><ShieldCheck size={13} /> {draft.access_level || 'کاربر'}</span>
                </div>
                <p>{draft.title || 'کاربر IOTA'} — {draft.department || 'واحد نامشخص'}</p>

                <label className="profile-image-url-reference">
                  آدرس تصویر پروفایل
                  <input value={draft.profile_image || ''} onChange={(event) => setField('profile_image', event.target.value)} placeholder="https://... یا تصویر آپلودشده" />
                </label>
              </div>
            </div>

            <div className="profile-form-grid-reference">
              <label>
                نام
                <div className="input-with-icon-reference"><User size={17}/><input value={draft.first_name || ''} onChange={(event) => setField('first_name', event.target.value)} /></div>
              </label>
              <label>
                نام خانوادگی
                <input value={draft.last_name || ''} onChange={(event) => setField('last_name', event.target.value)} />
              </label>
              <label>
                ایمیل
                <div className="input-with-icon-reference"><Mail size={17}/><input value={draft.email || ''} onChange={(event) => setField('email', event.target.value)} /></div>
              </label>
              <label>
                شماره تماس
                <div className="input-with-icon-reference"><Phone size={17}/><input value={draft.phone_number || ''} onChange={(event) => setField('phone_number', event.target.value)} /></div>
              </label>
              <label>
                عنوان
                <input value={draft.title || ''} onChange={(event) => setField('title', event.target.value)} />
              </label>
              <label>
                واحد
                <div className="input-with-icon-reference"><Building2 size={17}/><input value={draft.department || ''} onChange={(event) => setField('department', event.target.value)} /></div>
              </label>
            </div>

            <button className="primary profile-save-reference" type="button" onClick={save} disabled={busy}>
              {busy ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
              ذخیره پروفایل
            </button>
          </article>

          <aside className="profile-side-stack-reference">
            <section className="manager-panel activity-panel activity-panel-reference">
              <div className="panel-heading"><Clock3 size={16} /><div><b>نمودار فعالیت</b><span>فعالیت هفتگی کاربر</span></div></div>
              <div className="activity-bars activity-bars-ai activity-bars-reference">
                {activity.map((item) => (
                  <div className="activity-bar" key={item.label}>
                    <span style={{ height: `${Math.max(8, (Number(item.value) / maxActivity) * 100)}%` }} />
                    <b>{item.label}</b>
                  </div>
                ))}
                {activity.length === 0 && <p className="empty-state small">فعالیتی ثبت نشده است.</p>}
              </div>
            </section>

            <section className="manager-panel notification-panel notification-panel-reference">
              <div className="panel-heading"><Bell size={16} /><div><b>هشدارها و اعلان‌ها</b><span>موارد مهم مرتبط با کاربر</span></div></div>
              <div className="notification-list">
                {alarms.map((item, index) => (
                  <div className={`notification-row alarm ${item.level || ''}`} key={`a-${index}`}>
                    <b>{item.title}</b>
                    <span>{item.message}</span>
                  </div>
                ))}
                {notifications.map((item, index) => (
                  <div className="notification-row" key={`n-${index}`}>
                    <b>{item.title}</b>
                    <span>{item.message}</span>
                    <small>{item.time}</small>
                  </div>
                ))}
                {alarms.length === 0 && notifications.length === 0 && <p className="empty-state small">اعلانی وجود ندارد.</p>}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
