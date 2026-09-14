import { Check, CheckCircle2, FolderOpen, Save } from 'lucide-react';
import type { AssignableUser, Project, ProjectPayload } from '../../../../shared/types';
import { Button } from '../../../../shared/ui';
import { ProjectForm } from '../../../components/project-form/ProjectForm';

export function ProjectInfoCard({ project, draft, users, saving, canManageAssignments, onDraftChange, onSave, onOpen }: {
  project: Project | null; draft: ProjectPayload; users: AssignableUser[]; saving: boolean; canManageAssignments: boolean;
  onDraftChange: (value: ProjectPayload) => void; onSave: () => void; onOpen: (project: Project) => void;
}) {
  return <aside className="manager-panel project-create-info-reference">
    <div className="reference-card-head"><div className="reference-step-title"><span className={`step-number-ai ${project ? 'done' : ''}`}>{project ? <Check size={13} /> : '۱'}</span><div><b>اطلاعات پروژه</b><span>ابتدا پروژه را بسازید، سپس داده و جریان اضافه کنید</span></div></div></div>
    {project && <div className="success-note-reference"><CheckCircle2 size={16} /> پروژه ساخته شد. می‌توانید مشخصات را ویرایش کنید.</div>}
    <ProjectForm value={draft} onChange={onDraftChange} canManageAssignments={canManageAssignments} assignableUsers={users} />
    <Button className="full-width" variant="primary" loading={saving} leadingIcon={<Save size={15} />} onClick={onSave}>{project ? 'ذخیره اطلاعات' : 'ساخت پروژه'}</Button>
    {project && <Button className="full-width" leadingIcon={<FolderOpen size={15} />} onClick={() => onOpen(project)}>رفتن به صفحه پروژه</Button>}
  </aside>;
}
