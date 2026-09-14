import { FolderOpen, Sparkles, UserRoundCheck } from 'lucide-react';
import type { Project, UserProfile } from '../../../shared/types';
import { AppTopNav } from '../../../shared/components';
import { ProjectMessage } from '../../components/ProjectMessage';
import { ProjectFiltersBar } from './_components/ProjectFiltersBar';
import { ProjectSection } from './_components/ProjectSection';
import { useProjectsList } from './_hooks/useProjectsList';

export function ProjectManagementPage({ user, onOpenProject, onCreateProject, onProfile, onAdmin, onLogout }: { user: UserProfile; onOpenProject: (project: Project) => void; onCreateProject: () => void; onProfile: () => void; onAdmin: () => void; onLogout: () => void }) {
  const c = useProjectsList(onOpenProject);
  const totalProjects = c.groups.newAssigned.length + c.groups.owned.length + c.groups.accessible.length;
  return <div className="app-shell manager-shell iota-reference-shell">
    <AppTopNav user={user} title="پروژه‌ها" onProfile={onProfile} onAdmin={onAdmin} onLogout={onLogout} />
    <main className="manager-page projects-reference-page iota-minimal-page">
      <ProjectMessage message={c.message} />
      <header className="projects-page-heading">
        <div>
          <h2>پروژه‌های من</h2>
          <p>
            {totalProjects.toLocaleString('fa-IR')} پروژه · {c.groups.owned.length.toLocaleString('fa-IR')} مالکیتی
          </p>
        </div>
      </header>
      <ProjectFiltersBar user={user} filters={c.filters} fetching={c.fetching} onChange={c.setFilters} onRefresh={c.refresh} onCreate={onCreateProject} />
      {c.groups.newAssigned.length > 0 && <ProjectSection className="new-assignment-section" icon={<Sparkles size={17} />} title="پروژه‌های تازه تخصیص‌یافته" subtitle={`${c.groups.newAssigned.length.toLocaleString('fa-IR')} پروژه جدید`} projects={c.groups.newAssigned} emptyText="" onOpen={c.open} />}
      <ProjectSection icon={<FolderOpen size={17} />} title="پروژه‌های من" projects={c.groups.owned} emptyText="پروژه مالکیتی مطابق فیلترها وجود ندارد." onOpen={c.open} />
      <ProjectSection className="view-projects-section" icon={<UserRoundCheck size={17} />} title="پروژه‌های قابل دسترسی" projects={c.groups.accessible} emptyText="پروژه قابل دسترسی مطابق فیلترها وجود ندارد." onOpen={c.open} />
    </main>
  </div>;
}
