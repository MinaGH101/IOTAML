export type ProjectState = 'open' | 'closed';
export type ProjectPriority = 'low' | 'medium' | 'high';

export type Project = {
  id: number;
  name: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  project_manager: string;
  state: ProjectState;
  priority: ProjectPriority;
  color: string;
  owner_username: string;
  workflow_count: number;
  dataset_count: number;
  created_at: string;
  updated_at: string;
};

export type ProjectPayload = {
  name: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  project_manager: string;
  state: ProjectState;
  priority: ProjectPriority;
  color: string;
};
