import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, FolderOpen, GitBranch, HardDrive, PlusCircle, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { projectsApi } from '../../_service/projectsApi';
import { workspaceApi } from '../../../workspace/_service/workspaceApi';
import { AppTopNav } from '../../../shared/_components/AppTopNav';
import { DatasetUploader } from '../../_components/DatasetUploader';
import { ProjectForm } from '../../_components/ProjectForm';
import type { ArtifactUsage, Dataset, Project, ProjectPayload, UserProfile, Workflow } from '../../../shared/_types';
import { formatDate, messageFromError, payloadFromProject, type UiMessage } from '../../../shared/_utils/appShared';
import { readWorkflowJson } from '../../../shared/_utils/workflowJson';

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toLocaleString('fa-IR', { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
};

export function ProjectDetailPage({
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
  const [artifactUsage, setArtifactUsage] = useState<ArtifactUsage | null>(null);
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);
  const [importingWorkflow, setImportingWorkflow] = useState(false);
  const [workflowNameDrafts, setWorkflowNameDrafts] = useState<Record<number, string>>({});
  const [workflowActionId, setWorkflowActionId] = useState<number | null>(null);
  const workflowImportRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [nextProject, datasetList, workflowList, usage] = await Promise.all([
      projectsApi.get(project.id),
      projectsApi.datasets(project.id),
      workspaceApi.workflows(project.id),
      projectsApi.artifactUsage(project.id)
    ]);
    onProjectUpdated(nextProject);
    setDatasets(datasetList);
    setWorkflows(workflowList);
    setWorkflowNameDrafts((current) => Object.fromEntries(
      workflowList.map((workflow) => [workflow.id, current[workflow.id] ?? workflow.name])
    ));
    setArtifactUsage(usage);
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
      const saved = await projectsApi.update(project.id, { ...draft, name: draft.name.trim() });
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
      await projectsApi.remove(project.id);
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
      await projectsApi.uploadDataset(file, project.id);
      await refresh();
      setMessage({ text: 'دیتاست آپلود شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'آپلود ناموفق بود'));
    }
  };

  const deleteDataset = async (id: number) => {
    setMessage({ text: 'در حال حذف دیتاست...', tone: 'info' });
    try {
      await projectsApi.deleteDataset(id);
      await refresh();
      setMessage({ text: 'دیتاست حذف شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'حذف دیتاست ناموفق بود'));
    }
  };

  const importWorkflow = async (file: File) => {
    setImportingWorkflow(true);
    setMessage({ text: 'در حال وارد کردن Workflow JSON...', tone: 'info' });
    try {
      const imported = await readWorkflowJson(file);
      const graph = { ...imported.graph, meta: { ...(imported.graph.meta || {}), datasetId: (imported.graph.meta as Record<string, unknown> | undefined)?.datasetId ?? datasets[0]?.id ?? null } };
      const validation = await workspaceApi.validateWorkflow(graph as unknown as Record<string, unknown>);
      if (!validation.valid) throw new Error(validation.errors.map((item) => item.message).join(' · ') || 'Workflow JSON is not valid.');
      const workflow = await workspaceApi.createWorkflow({ name: imported.name || 'Imported Workflow', project_id: project.id, graph: graph as unknown as Record<string, unknown> });
      await refresh();
      setMessage({ text: 'Workflow JSON وارد شد', tone: 'success' });
      onOpenEditor(workflow.id);
    } catch (error) {
      setMessage(messageFromError(error, 'Import Workflow ناموفق بود'));
    } finally {
      setImportingWorkflow(false);
    }
  };

  const saveWorkflowName = async (workflow: Workflow) => {
    const name = (workflowNameDrafts[workflow.id] ?? workflow.name).trim();
    if (!name) {
      setMessage({ text: 'نام جریان نمی‌تواند خالی باشد', tone: 'error' });
      return;
    }
    if (name === workflow.name) return;

    setWorkflowActionId(workflow.id);
    try {
      const saved = await workspaceApi.renameWorkflow(workflow.id, name);
      setWorkflows((current) => current.map((item) => item.id === saved.id ? saved : item));
      setWorkflowNameDrafts((current) => ({ ...current, [saved.id]: saved.name }));
      setMessage({ text: 'نام جریان ذخیره شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'ذخیره نام جریان ناموفق بود'));
    } finally {
      setWorkflowActionId(null);
    }
  };

  const deleteWorkflow = async (workflow: Workflow) => {
    const ok = window.confirm(`جریان «${workflow.name}» حذف شود؟ تاریخچه اجراهای قبلی پروژه حفظ می‌شود.`);
    if (!ok) return;

    setWorkflowActionId(workflow.id);
    try {
      await workspaceApi.deleteWorkflow(workflow.id);
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
      setWorkflowNameDrafts((current) => {
        const next = { ...current };
        delete next[workflow.id];
        return next;
      });
      setMessage({ text: 'جریان حذف شد', tone: 'success' });
    } catch (error) {
      setMessage(messageFromError(error, 'حذف جریان ناموفق بود'));
    } finally {
      setWorkflowActionId(null);
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
              {artifactUsage && (
                <div className="artifact-usage-summary">
                  <div className="artifact-usage-head">
                    <span><HardDrive size={17}/> فضای ذخیره‌سازی پروژه</span>
                    <b>{formatBytes(artifactUsage.total_bytes)} از {formatBytes(artifactUsage.quota_bytes)}</b>
                  </div>
                  <div className="artifact-usage-track" aria-label="میزان استفاده از فضای ذخیره‌سازی">
                    <span style={{ width: `${Math.min(100, artifactUsage.quota_bytes ? (artifactUsage.total_bytes / artifactUsage.quota_bytes) * 100 : 0)}%` }} />
                  </div>
                  <small>{artifactUsage.artifact_count.toLocaleString('fa-IR')} فایل مدیریت‌شده در فضای پروژه</small>
                </div>
              )}
            </article>

            <article className="manager-panel workflows-reference-card">
              <div className="reference-card-head workflow-reference-head">
                <div><b>جریان‌های پروژه</b><span>هر جریان، داده و اجرای خودش را داخل همین پروژه نگه می‌دارد.</span></div>
                <div className="workflow-create-actions">
                  <input ref={workflowImportRef} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkflow(file); event.currentTarget.value = ''; }} />
                  <button className="icon-button" type="button" disabled={importingWorkflow} onClick={() => workflowImportRef.current?.click()}>{importingWorkflow ? <RefreshCw size={15} className="spin" /> : <FileUp size={15} />} Import JSON</button>
                  <button className="primary" type="button" onClick={() => onOpenEditor(null)}><PlusCircle size={15} /> جریان جدید</button>
                </div>
              </div>
              <div className="workflow-card-grid workflow-card-grid-reference">
                {workflows.map((workflow) => (
                  <article key={workflow.id} className="workflow-card workflow-card-reference workflow-manage-card">
                    <button className="workflow-card-open" type="button" onClick={() => onOpenEditor(workflow.id)} title="باز کردن جریان">
                      <WorkflowIcon />
                      <div><b>باز کردن جریان</b><span>آخرین تغییر: {formatDate(workflow.updated_at)}</span></div>
                    </button>
                    <div className="workflow-name-editor">
                      <input
                        value={workflowNameDrafts[workflow.id] ?? workflow.name}
                        maxLength={255}
                        aria-label={`نام جریان ${workflow.name}`}
                        onChange={(event) => setWorkflowNameDrafts((current) => ({ ...current, [workflow.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void saveWorkflowName(workflow);
                        }}
                      />
                      <button
                        className="workflow-row-action"
                        type="button"
                        disabled={workflowActionId === workflow.id || (workflowNameDrafts[workflow.id] ?? workflow.name).trim() === workflow.name}
                        onClick={() => { void saveWorkflowName(workflow); }}
                        title="ذخیره نام جریان"
                        aria-label="ذخیره نام جریان"
                      >
                        {workflowActionId === workflow.id ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                      </button>
                      <button
                        className="workflow-row-action danger-action"
                        type="button"
                        disabled={workflowActionId === workflow.id}
                        onClick={() => { void deleteWorkflow(workflow); }}
                        title="حذف جریان"
                        aria-label="حذف جریان"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
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
