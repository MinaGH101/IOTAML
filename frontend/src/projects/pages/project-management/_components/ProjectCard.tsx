import { Database, Eye, FolderOpen, GitBranch, Pencil, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Project } from '../../../../shared/types';
import { formatDate } from '../../../../shared/lib/date';
import { ProjectPriorityBadge, ProjectStatus } from '../../../components/project-form/ProjectBadges';
import { accessLabel } from '../projectFilters';

export function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const assigned = project.assignments.map((item) => item.display_name).join('، ');
  return <button className={`project-reference-card access-${project.effective_access} ${project.is_new_assignment ? 'is-new-assignment' : ''}`} type="button" style={{ '--project-color': project.color } as CSSProperties} onClick={onOpen}>
    <span className="project-color-strip" style={{ background: project.color }} />
    <div className="project-reference-card-head"><span className="project-card-icon-reference"><FolderOpen size={18} /></span><div><b>{project.name}</b><small>{project.description || 'بدون توضیحات'}</small></div>{project.is_new_assignment && <span className="new-assignment-badge"><Sparkles size={12} /> تخصیص جدید</span>}</div>
    <div className="project-access-line"><span className={`access-badge access-${project.effective_access}`}>{project.effective_access === 'view' ? <Eye size={12} /> : <Pencil size={12} />}{accessLabel(project)}</span><ProjectStatus state={project.state} /><ProjectPriorityBadge priority={project.priority} /></div>
    <div className="project-people-line"><span><b>مالک:</b> {project.owner_display_name || project.owner_username}</span>{assigned && <span><b>تخصیص:</b> {assigned}</span>}</div>
    <div className="project-reference-card-meta"><span><GitBranch size={13} /> {project.workflow_count.toLocaleString('fa-IR')} جریان</span><span><Database size={13} /> {project.dataset_count.toLocaleString('fa-IR')} دیتاست</span><span>بروزرسانی {formatDate(project.updated_at)}</span></div>
  </button>;
}
