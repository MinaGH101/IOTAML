import { ArrowRight } from 'lucide-react';
import { AppTopNav } from '../../../shared/components';
import { Button } from '../../../shared/ui';
import { ProjectMessage } from '../../components/ProjectMessage';
import { ProjectDataCard } from './_components/ProjectDataCard';
import { ProjectInfoCard } from './_components/ProjectInfoCard';
import { ProjectWorkflowCard } from './_components/ProjectWorkflowCard';
import { useCreateProjectController } from './_hooks/useCreateProjectController';
import type { Project, UserProfile } from '../../../shared/types';

export type CreateProjectPageProps = { user: UserProfile; onBack: () => void; onCreated: (project: Project) => void; onOpenProject: (project: Project) => void; onOpenEditor: (project: Project, workflowId: number | null) => void; onProfile: () => void; onAdmin: () => void; onLogout: () => void };

export function CreateProjectPage(props: CreateProjectPageProps) {
  const c = useCreateProjectController(props);
  return <div className="app-shell manager-shell">
    <AppTopNav user={props.user} title={c.project?.name || 'ایجاد پروژه جدید'} subtitle="اطلاعات پایه، داده و جریان کاری پروژه را ثبت کنید" onBack={props.onBack} onProfile={props.onProfile} onAdmin={props.onAdmin} onLogout={props.onLogout} />
    <main className="manager-page create-project-page create-reference-page iota-minimal-page">
      <ProjectMessage message={c.message} />
      <div className="reference-back-row"><Button leadingIcon={<ArrowRight size={15} />} onClick={props.onBack}>بازگشت به پروژه‌ها</Button></div>
      <section className="project-create-reference-layout">
        <ProjectInfoCard project={c.project} draft={c.draft} users={c.assignableUsers} saving={c.saving} canManageAssignments={props.user.role === 'manager' || props.user.role === 'admin'} onDraftChange={c.setDraft} onSave={c.save} onOpen={props.onOpenProject} />
        <section className="project-create-main-reference">
          <ProjectDataCard projectCreated={Boolean(c.project)} datasets={c.datasets} uploading={c.uploading} onUpload={c.upload} onDelete={c.removeDataset} />
          <ProjectWorkflowCard project={c.project} workflows={c.workflows} name={c.workflowName} creating={c.workflow.creating} importing={c.workflow.importing} onNameChange={c.setWorkflowName} onCreate={c.workflow.create} onImport={c.workflow.importFile} onOpen={(workflow) => c.project && props.onOpenEditor(c.project, workflow.id)} />
        </section>
      </section>
    </main>
  </div>;
}
