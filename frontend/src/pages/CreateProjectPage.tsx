import { useCallback, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, FolderOpen, GitBranch, Info, PlusCircle, RefreshCw, Save, Upload } from 'lucide-react';
import { api } from '../api';
import { AppTopNav } from '../components/AppTopNav';
import { DatasetUploader } from '../components/DatasetUploader';
import { ProjectForm } from '../components/ProjectForm';
import type { Dataset, Project, ProjectPayload, UserProfile, Workflow } from '../types';
import { formatDate, messageFromError, defaultProjectPayload, payloadFromProject, type UiMessage } from '../utils/appShared';

export function CreateProjectPage({
  user,
  onBack,
  onCreated,
  onOpenProject,
  onOpenEditor,
  onProfile,
  onLogout
}: {
  user: UserProfile;
  onBack: () => void;
  onCreated: (project: Project) => void;
  onOpenProject: (project: Project) => void;
  onOpenEditor: (project: Project, workflowId: number | null) => void;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<ProjectPayload>(() => defaultProjectPayload(user));
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowName, setWorkflowName] = useState('جریان IOTA ML');
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

  const refreshProjectAssets = useCallback(async (projectId: number) => {
    const [datasetList, workflowList] = await Promise.all([api.datasets(projectId), api.workflows(projectId)]);
    setDatasets(datasetList);
    setWorkflows(workflowList);
  }, []);

  const setActiveProject = useCallback((project: Project) => {
    setCreatedProject(project);
    setDraft(payloadFromProject(project));
    onCreated(project);
  }, [onCreated]);

  const ensureProject = async () => {
    if (createdProject) return createdProject;

    if (!draft.name.trim()) {
      setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' });
      return null;
    }

    const project = await api.createProject({ ...draft, name: draft.name.trim() });
    setActiveProject(project);
    await refreshProjectAssets(project.id);
    return project;
  };

  const saveProject = async () => {
    if (!draft.name.trim()) {
      setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' });
      return;
    }

    setBusy(true);
    try {
      if (createdProject) {
        const saved = await api.updateProject(createdProject.id, { ...draft, name: draft.name.trim() });
        setActiveProject(saved);
        await refreshProjectAssets(saved.id);
        setMessage({ text: 'اطلاعات پروژه ذخیره شد', tone: 'success' });
        return;
      }

      const project = await ensureProject();
      if (project) setMessage({ text: 'پروژه ساخته شد. حالا می‌توانید داده آپلود کنید یا جریان کاری بسازید.', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, createdProject ? 'ذخیره ناموفق بود' : 'ساخت پروژه ناموفق بود'));
    } finally {
      setBusy(false);
    }
  };

  const uploadDataset = async (file: File) => {
    setUploading(true);
    setMessage({ text: createdProject ? 'در حال آپلود دیتاست...' : 'در حال ساخت پروژه و آپلود دیتاست...', tone: 'info' });
    try {
      const project = await ensureProject();
      if (!project) return;

      await api.uploadDataset(file, project.id);
      await refreshProjectAssets(project.id);
      setMessage({ text: 'دیتاست آپلود شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'آپلود ناموفق بود'));
    } finally {
      setUploading(false);
    }
  };

  const deleteDataset = async (id: number) => {
    if (!createdProject) return;

    setMessage({ text: 'در حال حذف دیتاست...', tone: 'info' });
    try {
      await api.deleteDataset(id);
      await refreshProjectAssets(createdProject.id);
      setMessage({ text: 'دیتاست حذف شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'حذف دیتاست ناموفق بود'));
    }
  };

  const createWorkflow = async () => {
    if (!workflowName.trim()) {
      setMessage({ text: 'نام جریان کاری را وارد کنید', tone: 'error' });
      return;
    }

    setCreatingWorkflow(true);
    setMessage({ text: createdProject ? 'در حال ساخت جریان کاری...' : 'در حال ساخت پروژه و جریان کاری...', tone: 'info' });
    try {
      const project = await ensureProject();
      if (!project) return;

      const workflow = await api.createWorkflow({
        name: workflowName.trim(),
        project_id: project.id,
        graph: { nodes: [], edges: [], meta: { datasetId: datasets[0]?.id ?? null, targetColumn: 'target', taskType: 'auto' } }
      });
      await refreshProjectAssets(project.id);
      setMessage({ text: 'جریان کاری ساخته شد', tone: 'success' });
      onOpenEditor(project, workflow.id);
    } catch (error) {
      setMessage(messageFromError(error, 'ایجاد جریان کاری ناموفق بود'));
    } finally {
      setCreatingWorkflow(false);
    }
  };

  const openWorkflow = (workflow: Workflow) => {
    if (!createdProject) return;
    onOpenEditor(createdProject, workflow.id);
  };

  return (
    <div className="app-shell manager-shell">
      <AppTopNav
        user={user}
        title={createdProject ? createdProject.name : 'ایجاد پروژه جدید'}
        subtitle="اطلاعات پایه، داده و جریان کاری پروژه را ثبت کنید"
        onBack={onBack}
        onProfile={onProfile}
        onLogout={onLogout}
      />

      <main className="manager-page create-project-page create-reference-page iota-minimal-page">
        {message && <div className={`manager-toast ${message.tone}`}>{message.text}</div>}

        <div className="reference-back-row">
          <button className="icon-button" type="button" onClick={onBack}><ArrowRight size={15} /> بازگشت به پروژه‌ها</button>
        </div>

        <section className="project-create-reference-layout">
          <aside className="manager-panel project-create-info-reference">
            <div className="reference-card-head">
              <div className="reference-step-title">
                <span className={`step-number-ai ${createdProject ? 'done' : ''}`}>{createdProject ? <Check size={13} /> : '۱'}</span>
                <div><b>اطلاعات پروژه</b><span>ابتدا پروژه را بسازید، سپس داده و جریان اضافه کنید</span></div>
              </div>
            </div>

            {createdProject ? (
              <div className="create-created-reference">
                <div className="success-note-reference"><CheckCircle2 size={16} /> پروژه ساخته شد. می‌توانید مشخصات را ویرایش کنید.</div>
                <ProjectForm value={draft} onChange={setDraft} />
                <button className="primary full-width" type="button" disabled={busy} onClick={saveProject}>
                  {busy ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                  ذخیره اطلاعات
                </button>
                <button className="icon-button full-width" type="button" onClick={() => onOpenProject(createdProject)}><FolderOpen size={15} /> رفتن به صفحه پروژه</button>
              </div>
            ) : (
              <>
                <ProjectForm value={draft} onChange={setDraft} />
                <button className="primary full-width" type="button" disabled={busy} onClick={saveProject}>
                  {busy ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                  ساخت پروژه
                </button>
              </>
            )}
          </aside>

          <section className="project-create-main-reference">
            <article className="manager-panel project-create-card-reference">
              <div className="reference-card-head">
                <div className="reference-step-title">
                  <span className={`step-number-ai ${createdProject || datasets.length ? 'active' : ''}`}>۲</span>
                  <div><b>داده‌های پروژه</b><span>دیتاست‌های CSV پروژه</span></div>
                </div>
              </div>
              {!createdProject && <div className="info-note-reference"><Info size={15} /> اگر پروژه هنوز ساخته نشده باشد، قبل از آپلود خودکار ساخته می‌شود.</div>}
              {uploading && <div className="empty-state small">در حال آپلود...</div>}
              <DatasetUploader datasets={datasets} onUpload={uploadDataset} onDelete={deleteDataset} />
            </article>

            <article className="manager-panel project-create-card-reference">
              <div className="reference-card-head workflow-reference-head">
                <div className="reference-step-title">
                  <span className={`step-number-ai ${workflows.length ? 'done' : createdProject ? 'active' : ''}`}>{workflows.length ? <Check size={13} /> : '۳'}</span>
                  <div><b>جریان‌های پروژه</b><span>بعد از ساخت پروژه، یک workflow اولیه بسازید.</span></div>
                </div>
                <button className="primary" type="button" disabled={creatingWorkflow} onClick={createWorkflow}>
                  {creatingWorkflow ? <RefreshCw size={15} className="spin" /> : <PlusCircle size={15} />}
                  جریان جدید
                </button>
              </div>

              <div className="workflow-name-reference">
                <label>نام جریان کاری<input value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="مثلاً جریان IOTA ML" /></label>
                {!createdProject && <div className="info-note-reference"><Info size={15} /> با کلیک روی «جریان جدید»، پروژه ابتدا ساخته می‌شود و سپس Workflow ایجاد می‌شود.</div>}
              </div>

              <div className="workflow-card-grid workflow-card-grid-ai workflow-grid-reference">
                {workflows.map((workflow) => (
                  <button key={workflow.id} className="workflow-card workflow-card-ai" type="button" onClick={() => openWorkflow(workflow)}>
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
