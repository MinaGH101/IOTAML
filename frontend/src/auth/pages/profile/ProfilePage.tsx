import { useState } from 'react';
import { Bell, Building2, Clock3, Mail, Phone, RefreshCw, Save, ShieldCheck, Upload, User, UserCircle } from 'lucide-react';
import { authApi } from '../../_service/authApi';
import { AppTopNav } from '../../../shared/_components/AppTopNav';
import type { UserProfile } from '../../../shared/_types';
import { mediaSrc, messageFromError, type UiMessage } from '../../../shared/_utils/appShared';

export function ProfilePage({
  user,
  onBack,
  onProjects,
  onSaved,
  onAdmin,
  onLogout
}: {
  user: UserProfile;
  onBack: () => void;
  onProjects: () => void;
  onSaved: (user: UserProfile) => void;
  onAdmin: () => void;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<UserProfile>(user);
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
      const saved = await authApi.updateProfile(draft);
      onSaved(saved);
      setDraft(saved);
      setMessage({ text: 'پروفایل ذخیره شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'ذخیره پروفایل ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || newPassword.length < 10) {
      setMessage({ text: 'رمز جدید باید حداقل ۱۰ کاراکتر باشد', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(''); setNewPassword('');
      setMessage({ text: 'رمز عبور تغییر کرد. برای امنیت، دوباره وارد شوید.', tone: 'success' });
      onLogout();
    } catch (error) {
      setMessage(messageFromError(error, 'تغییر رمز عبور ناموفق بود'));
    } finally { setBusy(false); }
  };

  const uploadProfileImage = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage({ text: 'در حال آپلود تصویر پروفایل...', tone: 'info' });
    try {
      const saved = await authApi.uploadProfileImage(file);
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
    <div className="app-shell manager-shell iota-reference-shell">
      <AppTopNav
        user={user}
        title="پروفایل کاربر"
        subtitle="اطلاعات کاربری، فعالیت‌ها و اعلان‌ها"
        onBack={onBack}
        onProjects={onProjects}
        onProfile={() => {}}
        onAdmin={onAdmin}
        onLogout={onLogout}
      />

      <main className="manager-page profile-page profile-reference-page iota-minimal-page">
        {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}

        <section className="profile-layout-reference">
          <div className="profile-primary-stack-reference">
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
              </div>
            </div>

            <div className="profile-form-grid-reference">
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">نام</span>
                <div className="input-with-icon-reference"><User size={17}/><input value={draft.first_name || ''} placeholder="نام" onChange={(event) => setField('first_name', event.target.value)} /></div>
              </label>
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">نام خانوادگی</span>
                <input value={draft.last_name || ''} placeholder="نام خانوادگی" onChange={(event) => setField('last_name', event.target.value)} />
              </label>
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">ایمیل</span>
                <div className="input-with-icon-reference"><Mail size={17}/><input value={draft.email || ''} placeholder="ایمیل" onChange={(event) => setField('email', event.target.value)} /></div>
              </label>
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">شماره تماس</span>
                <div className="input-with-icon-reference"><Phone size={17}/><input value={draft.phone_number || ''} placeholder="شماره تماس" onChange={(event) => setField('phone_number', event.target.value)} /></div>
              </label>
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">عنوان</span>
                <input value={draft.title || ''} placeholder="عنوان" onChange={(event) => setField('title', event.target.value)} />
              </label>
              <label className="profile-field-reference">
                <span className="profile-field-label-reference">واحد</span>
                <div className="input-with-icon-reference"><Building2 size={17}/><input value={draft.department || ''} placeholder="واحد" onChange={(event) => setField('department', event.target.value)} /></div>
              </label>
            </div>

            <div className="profile-actions-reference">
              <button className="primary profile-save-reference" type="button" onClick={save} disabled={busy}>
                {busy ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                ذخیره پروفایل
              </button>
            </div>
          </article>

          <section className="manager-panel profile-password-card">
            <div className="panel-heading"><ShieldCheck size={16} /><div><b>تغییر رمز عبور</b><span>رمز جدید باید حداقل ۱۰ کاراکتر باشد.</span></div></div>
            <div className="profile-password-fields-reference">
              <label><span>رمز فعلی</span><input type="password" placeholder="رمز فعلی" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
              <label><span>رمز جدید</span><input type="password" placeholder="حداقل ۱۰ کاراکتر" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
              <button className="secondary profile-password-save-reference" type="button" disabled={busy} onClick={() => void savePassword()}>ذخیره رمز جدید</button>
            </div>
          </section>
          </div>

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
