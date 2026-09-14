import { GitBranch } from 'lucide-react';
import type { Workflow } from '../../../shared/types';
import { formatDate } from '../../../shared/lib/date';

export function WorkflowIcon() { return <span className="workflow-icon"><GitBranch size={15} /></span>; }
export function WorkflowCard({ workflow, onOpen }: { workflow: Workflow; onOpen: () => void }) {
  return <button className="workflow-card workflow-card-ai" type="button" onClick={onOpen}><WorkflowIcon /><div><b>{workflow.name}</b><span>آخرین تغییر: {formatDate(workflow.updated_at)}</span></div></button>;
}
