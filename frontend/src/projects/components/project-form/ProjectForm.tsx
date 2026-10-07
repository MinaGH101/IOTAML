import type { AssignableUser, ProjectPayload } from '../../../shared/types';
import { AssignmentEditor } from './AssignmentEditor';
import { ProjectFields } from './ProjectFields';
import { Users, UserRound } from 'lucide-react';

export type ProjectFormProps = {
  value: ProjectPayload;
  onChange: (next: ProjectPayload) => void;
  compact?: boolean;
  readOnly?: boolean;
  canManageAssignments?: boolean;
  assignableUsers?: AssignableUser[];
};

export function ProjectForm({ value, onChange, compact = false, readOnly = false, canManageAssignments = false, assignableUsers = [] }: ProjectFormProps) {
  const setField = <K extends keyof ProjectPayload>(key: K, fieldValue: ProjectPayload[K]) => onChange({ ...value, [key]: fieldValue });
  return <div className={`project-form ${compact ? 'compact' : ''} ${readOnly ? 'is-readonly' : ''}`}>
    <section className="project-type-selector" aria-label="نوع پروژه">
      <button type="button" disabled={readOnly || !canManageAssignments} className={value.project_type === 'personal' ? 'active' : ''}
        onClick={() => onChange({ ...value, project_type: 'personal', assignments: [] })}>
        <UserRound size={17} /><span><b>پروژه شخصی</b><small>فقط مالک پروژه</small></span>
      </button>
      <button type="button" disabled={readOnly || !canManageAssignments} className={value.project_type === 'team' ? 'active' : ''}
        onClick={() => setField('project_type', 'team')}>
        <Users size={17} /><span><b>پروژه تیمی</b><small>مشاهده یا ویرایش توسط اعضای تیم</small></span>
      </button>
    </section>
    <ProjectFields value={value} readOnly={readOnly} setField={setField} />
    {canManageAssignments && !readOnly && value.project_type === 'team' && <AssignmentEditor value={value} users={assignableUsers} setAssignments={(assignments) => setField('assignments', assignments)} />}
  </div>;
}
