import type { AssignableUser, ProjectPayload } from '../../../shared/types';
import { AssignmentEditor } from './AssignmentEditor';
import { ProjectFields } from './ProjectFields';

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
    <ProjectFields value={value} readOnly={readOnly} setField={setField} />
    {canManageAssignments && !readOnly && <AssignmentEditor value={value} users={assignableUsers} setAssignments={(assignments) => setField('assignments', assignments)} />}
  </div>;
}
