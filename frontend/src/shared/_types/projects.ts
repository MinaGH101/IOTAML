export type ProjectState = 'open' | 'closed';
export type ProjectPriority = 'low' | 'medium' | 'high';
export type ProjectAssignmentAccess = 'edit' | 'view';
export type EffectiveProjectAccess = 'owner' | 'edit' | 'view' | 'admin';

export type ProjectAssignment = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  role: string;
  access_type: ProjectAssignmentAccess;
  is_new: boolean;
  assigned_at: string;
};

export type ProjectAssignmentPayload = {
  user_id: number;
  access_type: ProjectAssignmentAccess;
};

export type AssignableUser = {
  id: number;
  username: string;
  display_name: string;
  role: string;
};

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
  owner_display_name: string;
  assignments: ProjectAssignment[];
  effective_access: EffectiveProjectAccess;
  access_source: 'owned' | 'assigned' | 'manager_visibility' | 'admin';
  is_new_assignment: boolean;
  can_edit: boolean;
  can_run: boolean;
  can_delete: boolean;
  can_manage_assignments: boolean;
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
  assignments: ProjectAssignmentPayload[];
};
