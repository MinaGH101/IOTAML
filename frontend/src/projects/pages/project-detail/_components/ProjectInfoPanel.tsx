import { FolderOpen } from 'lucide-react';
import type { AssignableUser, Project, ProjectPayload } from '../../../../shared/types';
import { ProjectForm } from '../../../components/project-form/ProjectForm';

export function ProjectInfoPanel({ project, draft, users, onDraftChange }: {
  project: Project; draft: ProjectPayload; users: AssignableUser[];
  onDraftChange: (value: ProjectPayload) => void;
}) {
  return <aside className="manager-panel project-info-panel project-info-reference">
    <div className="reference-card-head"><div className="reference-step-title"><span className="project-card-icon-reference"><FolderOpen size={18} /></span><div><b>اطلاعات پروژه</b></div></div></div>
    <ProjectForm value={draft} onChange={onDraftChange} readOnly={!project.can_edit} canManageAssignments={project.can_manage_assignments} assignableUsers={users} />
    {!project.can_edit && <div className="readonly-project-note">این پروژه با دسترسی مشاهده باز شده است و قابل ویرایش یا اجرا نیست.</div>}
  </aside>;
}
