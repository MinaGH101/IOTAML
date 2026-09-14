import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { AppTopNav } from '../../../shared/components';
import { Button, ConfirmDialog } from '../../../shared/ui';
import { ProjectMessage } from '../../components/ProjectMessage';
import { ProjectDataPanel } from './_components/ProjectDataPanel';
import { ProjectInfoPanel } from './_components/ProjectInfoPanel';
import { ProjectWorkflowsPanel } from './_components/ProjectWorkflowsPanel';
import { useProjectDetailController } from './_hooks/useProjectDetailController';
import type { Project, UserProfile } from '../../../shared/types';

export type ProjectDetailPageProps = { user: UserProfile; project: Project; onBack: () => void; onOpenEditor: (workflowId: number | null) => void; onProjectUpdated: (project: Project) => void; onProfile: () => void; onAdmin: () => void; onLogout: () => void };

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  const c = useProjectDetailController(props);
  const [datasetDeleteId, setDatasetDeleteId] = useState<number | null>(null);
  const datasetDeleteTarget = c.datasets.find((dataset) => dataset.id === datasetDeleteId);
  return <div className="app-shell manager-shell iota-reference-shell">
    <AppTopNav user={props.user} title={props.project.name} subtitle="جزئیات پروژه، داده‌ها و جریان‌های ذخیره‌شده" onBack={props.onBack} onProfile={props.onProfile} onAdmin={props.onAdmin} onLogout={props.onLogout} />
    <main className="manager-page project-detail-reference-page iota-minimal-page">
      <ProjectMessage message={c.message} />
      <header className="project-detail-heading">
        <div>
          <span className="project-heading-dot" style={{ background: props.project.color, color: props.project.color }} />
          <div>
            <h2>{props.project.name}</h2>
            <p>ویرایش اطلاعات، داده‌ها و جریان‌های پروژه</p>
          </div>
        </div>
        {props.project.can_edit && <div className="project-heading-actions">
          <Button variant="primary" loading={c.saving} leadingIcon={<Save size={15} />} onClick={c.save}>ذخیره تغییرات</Button>
          {props.project.can_delete && <Button variant="danger" disabled={c.saving} leadingIcon={<Trash2 size={15} />} onClick={() => c.setDeleteOpen(true)}>حذف پروژه</Button>}
        </div>}
      </header>
      <section className="project-detail-reference-layout">
        <ProjectInfoPanel project={props.project} draft={c.draft} users={c.users} onDraftChange={c.setDraft} />
        <section className="detail-main-stack detail-main-stack-reference"><ProjectDataPanel projectId={props.project.id} onImported={c.refresh} datasets={c.datasets} usage={c.artifactUsage} canEdit={props.project.can_edit} onUpload={c.uploadDataset} onDelete={setDatasetDeleteId} /><ProjectWorkflowsPanel project={props.project} workflows={c.workflows} manager={c.workflow} onOpenEditor={props.onOpenEditor} /></section>
      </section>
    </main>
    <ConfirmDialog open={c.deleteOpen} title="حذف پروژه" message="این پروژه حذف شود؟ این کار قابل بازگشت نیست." confirmLabel="حذف پروژه" danger busy={c.saving} onClose={() => c.setDeleteOpen(false)} onConfirm={c.remove} />
    <ConfirmDialog open={Boolean(datasetDeleteTarget)} title="حذف داده" message={datasetDeleteTarget ? `داده «${datasetDeleteTarget.name}» حذف شود؟ این کار قابل بازگشت نیست.` : ''} confirmLabel="حذف داده" danger onClose={() => setDatasetDeleteId(null)} onConfirm={() => { if (datasetDeleteId !== null) void c.deleteDataset(datasetDeleteId); setDatasetDeleteId(null); }} />
    <ConfirmDialog open={Boolean(c.workflow.deleteTarget)} title="حذف جریان" message={c.workflow.deleteTarget ? `جریان «${c.workflow.deleteTarget.name}» حذف شود؟ تاریخچه اجراهای قبلی پروژه حفظ می‌شود.` : ''} confirmLabel="حذف جریان" danger busy={c.workflow.actionId === c.workflow.deleteTarget?.id} onClose={() => c.workflow.setDeleteTarget(null)} onConfirm={c.workflow.remove} />
  </div>;
}
