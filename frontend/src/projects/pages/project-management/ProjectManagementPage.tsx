import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Eye, Filter, FolderOpen, GitBranch, Pencil, PlusCircle, RefreshCw, Search, Sparkles, UserRoundCheck } from 'lucide-react';
import { projectsApi } from '../../_service/projectsApi';
import { AppTopNav } from '../../../shared/_components/AppTopNav';
import { ProjectPriorityBadge, ProjectStatus } from '../../_components/ProjectForm';
import type { Project, ProjectPriority, ProjectState, UserProfile } from '../../../shared/_types';
import { formatDate, messageFromError, type UiMessage } from '../../../shared/_utils/appShared';

type AccessFilter = 'all' | 'owned' | 'assigned' | 'edit' | 'view' | 'new';
type ProjectFilters = { query: string; state: 'all' | ProjectState; priority: 'all' | ProjectPriority; access: AccessFilter };
const emptyFilters: ProjectFilters = { query: '', state: 'all', priority: 'all', access: 'all' };
const accessLabel = (project: Project) => project.effective_access === 'owner' ? 'مالک' : project.effective_access === 'edit' ? 'دسترسی ویرایش' : project.effective_access === 'admin' ? 'مدیریت کامل' : 'فقط مشاهده';

function matches(project: Project, filters: ProjectFilters) {
  const search = filters.query.trim().toLowerCase();
  const assignmentText = project.assignments.map((item) => `${item.display_name} ${item.username}`).join(' ');
  if (search && !`${project.name} ${project.description} ${project.project_manager} ${project.owner_display_name} ${assignmentText}`.toLowerCase().includes(search)) return false;
  if (filters.state !== 'all' && project.state !== filters.state) return false;
  if (filters.priority !== 'all' && project.priority !== filters.priority) return false;
  if (filters.access === 'owned' && project.access_source !== 'owned' && project.effective_access !== 'admin') return false;
  if (filters.access === 'assigned' && project.access_source !== 'assigned') return false;
  if (filters.access === 'edit' && project.effective_access !== 'edit') return false;
  if (filters.access === 'view' && project.effective_access !== 'view') return false;
  if (filters.access === 'new' && !project.is_new_assignment) return false;
  return true;
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  const assigned = project.assignments.map((item) => item.display_name).join('، ');
  return <button className={`project-reference-card access-${project.effective_access} ${project.is_new_assignment ? 'is-new-assignment' : ''}`} type="button" onClick={() => onOpen(project)}>
    <span className="project-color-strip" style={{ background: project.color }} />
    <div className="project-reference-card-head">
      <span className="project-card-icon-reference"><FolderOpen size={18} /></span>
      <div><b>{project.name}</b><small>{project.description || 'بدون توضیحات'}</small></div>
      {project.is_new_assignment && <span className="new-assignment-badge"><Sparkles size={12} /> تخصیص جدید</span>}
    </div>
    <div className="project-access-line"><span className={`access-badge access-${project.effective_access}`}>{project.effective_access === 'view' ? <Eye size={12} /> : <Pencil size={12} />}{accessLabel(project)}</span><ProjectStatus state={project.state} /><ProjectPriorityBadge priority={project.priority} /></div>
    <div className="project-people-line"><span><b>مالک:</b> {project.owner_display_name || project.owner_username}</span>{assigned && <span><b>تخصیص:</b> {assigned}</span>}</div>
    <div className="project-reference-card-meta"><span><GitBranch size={13} /> {project.workflow_count.toLocaleString('fa-IR')} جریان</span><span><Database size={13} /> {project.dataset_count.toLocaleString('fa-IR')} دیتاست</span><span>بروزرسانی {formatDate(project.updated_at)}</span></div>
  </button>;
}

export function ProjectManagementPage({ user, onOpenProject, onCreateProject, onProfile, onAdmin, onLogout }: { user: UserProfile; onOpenProject: (project: Project) => void; onCreateProject: () => void; onProfile: () => void; onAdmin: () => void; onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState<UiMessage>(null);
  const [filters, setFilters] = useState<ProjectFilters>(emptyFilters);
  const refresh = useCallback(async () => setProjects(await projectsApi.list()), []);
  useEffect(() => { refresh().catch((error) => setMessage(messageFromError(error, 'دریافت پروژه‌ها ناموفق بود'))); }, [refresh]);

  const filtered = useMemo(() => projects.filter((project) => matches(project, filters)), [filters, projects]);
  const newAssigned = filtered.filter((project) => project.is_new_assignment);
  const owned = filtered.filter((project) => !project.is_new_assignment && (project.access_source === 'owned' || project.effective_access === 'admin'));
  const accessible = filtered.filter((project) => !project.is_new_assignment && project.access_source !== 'owned' && project.effective_access !== 'admin');
  const openProject = async (project: Project) => {
    if (project.is_new_assignment) void projectsApi.acknowledge(project.id).catch(() => undefined);
    onOpenProject(project);
  };

  return <div className="app-shell manager-shell">
    <AppTopNav user={user} title="پروژه‌ها" onProfile={onProfile} onAdmin={onAdmin} onLogout={onLogout} />
    <main className="manager-page projects-reference-page iota-minimal-page">
      {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}
      <section className="projects-toolbar manager-panel">
        <div className="project-filter-search"><Search size={17} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="جستجو در نام، مالک، کاربران و توضیحات" /></div>
        <select value={filters.access} onChange={(event) => setFilters((current) => ({ ...current, access: event.target.value as AccessFilter }))}><option value="all">همه دسترسی‌ها</option><option value="owned">پروژه‌های مالکیتی</option><option value="assigned">پروژه‌های تخصیص‌یافته</option><option value="edit">قابل ویرایش</option><option value="view">فقط مشاهده</option><option value="new">تخصیص جدید</option></select>
        <select value={filters.state} onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value as ProjectFilters['state'] }))}><option value="all">همه وضعیت‌ها</option><option value="open">باز</option><option value="closed">بسته</option></select>
        <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as ProjectFilters['priority'] }))}><option value="all">همه اولویت‌ها</option><option value="high">زیاد</option><option value="medium">متوسط</option><option value="low">کم</option></select>
        <button className="icon-button" type="button" onClick={() => void refresh()}><RefreshCw size={15} /> بروزرسانی</button>
        {user.role !== 'guest' && <button className="primary" type="button" onClick={onCreateProject}><PlusCircle size={15} /> پروژه جدید</button>}
      </section>

      {newAssigned.length > 0 && <section className="project-access-section new-assignment-section"><div className="project-section-heading"><span><Sparkles size={17} /><b>پروژه‌های تازه تخصیص‌یافته</b></span><small>{newAssigned.length.toLocaleString('fa-IR')} پروژه جدید</small></div><div className="project-reference-grid">{newAssigned.map((project) => <ProjectCard key={project.id} project={project} onOpen={(item) => void openProject(item)} />)}</div></section>}
      <section className="project-access-section"><div className="project-section-heading"><span><FolderOpen size={17} /><b>پروژه‌های من</b></span><small>پروژه‌هایی که مالک آن‌ها هستید</small></div><div className="project-reference-grid">{owned.map((project) => <ProjectCard key={project.id} project={project} onOpen={(item) => void openProject(item)} />)}{owned.length === 0 && <div className="empty-manager">پروژه مالکیتی مطابق فیلترها وجود ندارد.</div>}</div></section>
      <section className="project-access-section view-projects-section"><div className="project-section-heading"><span><UserRoundCheck size={17} /><b>پروژه‌های قابل دسترسی</b></span><small>تخصیص ویرایش، مشاهده یا دسترسی سراسری مدیر</small></div><div className="project-reference-grid">{accessible.map((project) => <ProjectCard key={project.id} project={project} onOpen={(item) => void openProject(item)} />)}{accessible.length === 0 && <div className="empty-manager">پروژه قابل دسترسی مطابق فیلترها وجود ندارد.</div>}</div></section>
    </main>
  </div>;
}
