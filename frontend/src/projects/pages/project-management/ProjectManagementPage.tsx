import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Database, Filter, FolderOpen, GitBranch, PlusCircle, RefreshCw, Search, UserCircle } from 'lucide-react';
import { projectsApi } from '../../_service/projectsApi';
import { AppTopNav } from '../../../shared/_components/AppTopNav';
import { ProjectPriorityBadge, ProjectStatus } from '../../_components/ProjectForm';
import type { Project, ProjectPriority, ProjectState, UserProfile } from '../../../shared/_types';
import { formatDate, getDefaultProjectColor, messageFromError, type UiMessage } from '../../../shared/_utils/appShared';

type ProjectFilters = {
  query: string;
  state: 'all' | ProjectState;
  priority: 'all' | ProjectPriority;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: ProjectFilters = {
  query: '',
  state: 'all',
  priority: 'all',
  dateFrom: '',
  dateTo: ''
};

const dateTime = (value?: string | null) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const projectFilterDate = (project: Project) => project.start_date || project.created_at;

function projectMatchesFilters(project: Project, filters: ProjectFilters) {
  const search = filters.query.trim().toLowerCase();
  if (search && !`${project.name} ${project.description} ${project.project_manager}`.toLowerCase().includes(search)) return false;
  if (filters.state !== 'all' && project.state !== filters.state) return false;
  if (filters.priority !== 'all' && project.priority !== filters.priority) return false;

  const projectDate = dateTime(projectFilterDate(project));
  if (filters.dateFrom && projectDate < dateTime(filters.dateFrom)) return false;
  if (filters.dateTo && projectDate > dateTime(filters.dateTo) + 86_399_999) return false;
  return true;
}

export function ProjectManagementPage({
  user,
  onOpenProject,
  onCreateProject,
  onProfile,
  onLogout
}: {
  user: UserProfile;
  onOpenProject: (project: Project) => void;
  onCreateProject: () => void;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState<UiMessage>(null);
  const [filters, setFilters] = useState<ProjectFilters>(emptyFilters);

  const refresh = useCallback(async () => setProjects(await projectsApi.list()), []);

  useEffect(() => {
    refresh().catch((error) => setMessage(messageFromError(error, 'دریافت پروژه‌ها ناموفق بود')));
  }, [refresh]);

  const filtered = useMemo(() => projects.filter((project) => projectMatchesFilters(project, filters)), [projects, filters]);
  const hasActiveFilters = filters.query || filters.state !== 'all' || filters.priority !== 'all' || filters.dateFrom || filters.dateTo;

  const defaultProjectColor = getDefaultProjectColor();

  return (
    <div className="app-shell manager-shell">
      <AppTopNav user={user} title="مدیریت پروژه‌ها" subtitle="پروژه‌ها، دیتاست‌ها و جریان‌های کاری را قابل کنترل نگه دارید" onProfile={onProfile} onLogout={onLogout} />

      <main className="manager-page projects-reference-page iota-minimal-page">
        {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}

        <section className="projects-reference-layout">
          <aside className="manager-panel project-filter-panel project-filter-panel-reference">
            <div className="project-filter-head">
              <div><b><Filter size={15} /> فیلتر پروژه‌ها</b><span>{filtered.length.toLocaleString('fa-IR')} از {projects.length.toLocaleString('fa-IR')}</span></div>
            </div>

            <label className="project-filter-field">
              نام پروژه
              <div className="project-filter-search"><Search size={17}/><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="جستجو بر اساس نام، مدیر، توضیح" /></div>
            </label>

            <label className="project-filter-field">
              وضعیت
              <select value={filters.state} onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value as ProjectFilters['state'] }))}>
                <option value="all">همه</option>
                <option value="open">باز</option>
                <option value="closed">بسته</option>
              </select>
            </label>

            <label className="project-filter-field">
              اولویت
              <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as ProjectFilters['priority'] }))}>
                <option value="all">همه</option>
                <option value="low">کم</option>
                <option value="medium">متوسط</option>
                <option value="high">زیاد</option>
              </select>
            </label>

            <div className="project-filter-date-grid">
              <label className="project-filter-field">از تاریخ<input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
              <label className="project-filter-field">تا تاریخ<input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
            </div>

            <button className="icon-button full-width" type="button" disabled={!hasActiveFilters} onClick={() => setFilters(emptyFilters)}>پاک کردن فیلترها</button>
          </aside>

          <section className="manager-panel projects-list-panel projects-list-reference">
            <div className="manager-list-head projects-list-toolbar projects-toolbar-reference">
              <div><b>لیست پروژه‌ها</b><span>{filtered.length.toLocaleString('fa-IR')} پروژه نمایش داده می‌شود</span></div>
              <div className="projects-list-actions">
                <button className="primary" type="button" onClick={onCreateProject}><PlusCircle size={15} /> ایجاد پروژه</button>
                <button className="icon-button" type="button" onClick={() => refresh().catch((error) => setMessage(messageFromError(error, 'به‌روزرسانی ناموفق بود')))}><RefreshCw size={15} /> بروزرسانی</button>
              </div>
            </div>

            <div className="projects-list-scroll-reference">
              <div className="project-card-grid project-card-grid-reference">
                {filtered.map((project) => (
                  <button key={project.id} className="project-card project-card-reference" style={{ ['--project-color' as string]: project.color || defaultProjectColor }} type="button" onClick={() => onOpenProject(project)}>
                    <div className="project-card-top project-card-top-reference">
                      <span className="project-card-icon-reference"><FolderOpen size={18} /></span>
                      <div className="project-card-badges"><ProjectPriorityBadge priority={project.priority} /><ProjectStatus state={project.state} /></div>
                    </div>
                    <h3>{project.name}</h3>
                    <p>{project.description || 'بدون توضیحات'}</p>
                    <div className="project-meta project-meta-reference">
                      <span><CalendarDays size={13} /> {formatDate(project.start_date)} تا {formatDate(project.due_date)}</span>
                      <span><UserCircle size={13} /> {project.project_manager || 'بدون مدیر'}</span>
                    </div>
                    <div className="project-stats project-stats-reference">
                      <span><GitBranch size={13} /> {project.workflow_count} جریان</span>
                      <span><Database size={13} /> {project.dataset_count} دیتاست</span>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="empty-manager projects-empty-reference">پروژه‌ای پیدا نشد.</div>}
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
