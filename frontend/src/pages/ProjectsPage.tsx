import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Database, Filter, FolderOpen, GitBranch, PlusCircle, RefreshCw, Save, Search, Trash2, Upload, UserCircle } from 'lucide-react';
import { api } from '../api';
import { AppTopNav } from '../components/AppTopNav';
import { DatasetUploader } from '../components/DatasetUploader';
import { ProjectForm, ProjectPriorityBadge, ProjectStatus } from '../components/ProjectForm';
import type { Dataset, Project, ProjectPayload, ProjectPriority, ProjectState, UserProfile, Workflow } from '../types';
import { DEFAULT_PROJECT_COLOR, formatDate, messageFromError, payloadFromProject, type UiMessage } from '../utils/appShared';

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

export function ProjectsPanel({
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

  const refresh = useCallback(async () => setProjects(await api.projects()), []);

  useEffect(() => {
    refresh().catch((error) => setMessage(messageFromError(error, 'دریافت پروژه‌ها ناموفق بود')));
  }, [refresh]);

  const filtered = useMemo(() => projects.filter((project) => projectMatchesFilters(project, filters)), [projects, filters]);
  const hasActiveFilters = filters.query || filters.state !== 'all' || filters.priority !== 'all' || filters.dateFrom || filters.dateTo;

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
              <div className="project-filter-search"><Search size={14} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="جستجو بر اساس نام، مدیر، توضیح" /></div>
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
                  <button key={project.id} className="project-card project-card-reference" style={{ ['--project-color' as string]: project.color || DEFAULT_PROJECT_COLOR }} type="button" onClick={() => onOpenProject(project)}>
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

export function ProjectDetailPanel({
  user,
  project,
  onBack,
  onOpenEditor,
  onProjectUpdated,
  onProfile,
  onLogout
}: {
  user: UserProfile;
  project: Project;
  onBack: () => void;
  onOpenEditor: (workflowId: number | null) => void;
  onProjectUpdated: (project: Project) => void;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<ProjectPayload>(() => payloadFromProject(project));
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextProject, datasetList, workflowList] = await Promise.all([api.getProject(project.id), api.datasets(project.id), api.workflows(project.id)]);
    onProjectUpdated(nextProject);
    setDatasets(datasetList);
    setWorkflows(workflowList);
  }, [onProjectUpdated, project.id]);

  useEffect(() => {
    setDraft(payloadFromProject(project));
    refresh().catch((error) => setMessage(messageFromError(error, 'دریافت جزئیات پروژه ناموفق بود')));
  }, [project.id, refresh]);

  const saveProject = async () => {
    if (!draft.name.trim()) {
      setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const saved = await api.updateProject(project.id, { ...draft, name: draft.name.trim() });
      onProjectUpdated(saved);
      setMessage({ text: 'اطلاعات پروژه ذخیره شد', tone: 'success' });
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error, 'ذخیره ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    const ok = window.confirm('آیا از حذف این پروژه مطمئن هستید؟ این کار قابل بازگشت نیست.');
    if (!ok) return;

    setBusy(true);
    setMessage({ text: 'در حال حذف پروژه...', tone: 'info' });
    try {
      await api.deleteProject(project.id);
      setMessage({ text: 'پروژه حذف شد', tone: 'success' });
      onBack();
    } catch (error) {
      setMessage(messageFromError(error, 'حذف پروژه ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  const uploadDataset = async (file: File) => {
    setMessage({ text: 'در حال آپلود دیتاست...', tone: 'info' });
    try {
      await api.uploadDataset(file, project.id);
      await refresh();
      setMessage({ text: 'دیتاست آپلود شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'آپلود ناموفق بود'));
    }
  };

  const deleteDataset = async (id: number) => {
    setMessage({ text: 'در حال حذف دیتاست...', tone: 'info' });
    try {
      await api.deleteDataset(id);
      await refresh();
      setMessage({ text: 'دیتاست حذف شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'حذف دیتاست ناموفق بود'));
    }
  };

  return (
    <div className="app-shell manager-shell">
      <AppTopNav user={user} title={project.name} subtitle="جزئیات پروژه، داده‌ها و جریان‌های ذخیره‌شده" onBack={onBack} onProfile={onProfile} onLogout={onLogout} />

      <main className="manager-page project-detail-reference-page iota-minimal-page">
        {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}

        <div className="reference-back-row">
          <button className="icon-button" type="button" onClick={onBack}>بازگشت به پروژه‌ها</button>
        </div>

        <section className="project-detail-reference-layout">
          <aside className="manager-panel project-info-panel project-info-reference">
            <div className="reference-card-head">
              <div className="reference-step-title">
                <span className="project-card-icon-reference"><FolderOpen size={18} /></span>
                <div><b>اطلاعات پروژه</b><span>ویرایش و ذخیره مشخصات پروژه</span></div>
              </div>
            </div>

            <ProjectForm value={draft} onChange={setDraft} />
            <div className="project-edit-actions project-edit-actions-reference">
              <button className="primary" type="button" disabled={busy} onClick={saveProject}>{busy ? <RefreshCw size={15} className="spin" /> : <Save size={15} />} ذخیره اطلاعات</button>
              <button className="danger" type="button" disabled={busy} onClick={deleteProject}><Trash2 size={15} /> حذف پروژه</button>
            </div>
          </aside>

          <section className="detail-main-stack detail-main-stack-reference">
            <article className="manager-panel project-data-card project-data-reference">
              <div className="reference-card-head"><div className="reference-step-title"><Upload size={16} /><div><b>داده‌های پروژه</b><span>دیتاست‌های CSV پروژه</span></div></div></div>
              <DatasetUploader datasets={datasets} onUpload={uploadDataset} onDelete={deleteDataset} />
            </article>

            <article className="manager-panel workflows-reference-card">
              <div className="reference-card-head workflow-reference-head">
                <div><b>جریان‌های پروژه</b><span>هر جریان، داده و اجرای خودش را داخل همین پروژه نگه می‌دارد.</span></div>
                <button className="primary" type="button" onClick={() => onOpenEditor(null)}><PlusCircle size={15} /> جریان جدید</button>
              </div>
              <div className="workflow-card-grid workflow-card-grid-reference">
                {workflows.map((workflow) => (
                  <button key={workflow.id} className="workflow-card workflow-card-reference" type="button" onClick={() => onOpenEditor(workflow.id)}>
                    <WorkflowIcon />
                    <div><b>{workflow.name}</b><span>آخرین تغییر: {formatDate(workflow.updated_at)}</span></div>
                  </button>
                ))}
                {workflows.length === 0 && <div className="empty-manager">هنوز جریانی برای این پروژه ذخیره نشده است.</div>}
              </div>
            </article>
          </section>
        </section>
      </main>
    </div>
  );
}

function WorkflowIcon() {
  return <span className="workflow-icon"><GitBranch size={15} /></span>;
}
