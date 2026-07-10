import { ArrowRight, LayoutDashboard, LogOut, UserCircle, Cpu } from 'lucide-react';
import type { UserProfile } from '../types';
import { ThemeToggle } from './ThemeToggle';

export function AppTopNav({
  user,
  title,
  subtitle,
  onProfile,
  onLogout,
  onBack,
  onProjects
}: {
  user: UserProfile;
  title: string;
  subtitle?: string;
  onProfile: () => void;
  onLogout: () => void;
  onBack?: () => void;
  onProjects?: () => void;
}) {
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  return (
    <header className="topbar app-main-topbar iota-ai-topbar">
      <div className="iota-nav-brand-cluster">
        {onBack && (
          <button className="icon-button iota-nav-icon" type="button" onClick={onBack} title="بازگشت">
            <ArrowRight size={16} />
          </button>
        )}
        <button className="iota-brand-mark" type="button" onClick={onProjects} title="IOTA">
                      <div className="workflow-logo-title">
              <img src="/iota.png" alt="IOTA" />
              <h2>IOTA ML</h2>
            </div>
        </button>
        <span className="iota-nav-divider" />
        <div className="brand-block app-brand-with-back iota-page-title-block">
          <h1>{title}</h1>
          {/* {subtitle && <p>{subtitle}</p>} */}
        </div>
      </div>

      <div className="run-controls profile-controls iota-nav-actions">
        {onProjects && (
          <button className="icon-button profile-button" type="button" onClick={onProjects} title="پنل پروژه‌ها">
            <LayoutDashboard size={16} />
            <span>پروژه‌ها</span>
          </button>
        )}
        <button className="icon-button profile-button profile-icon-only" type="button" onClick={onProfile} title="پروفایل" aria-label="پروفایل">
          <UserCircle size={16} />
        </button>
        <ThemeToggle />
        <button className="icon-button iota-user-chip" type="button" onClick={onProfile} title={displayName}>
          <span>{displayName.slice(0, 1)}</span>
          <b>{displayName}</b>
        </button>
        <button className="icon-button iota-nav-icon danger-nav" type="button" onClick={onLogout} title="خروج">
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
