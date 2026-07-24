export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

export type RunNodeStatus = {
  status: 'queued' | 'running' | 'cached' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  name?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
  cache_hit?: boolean;
  cache_key?: string | null;
  cache_entry_id?: number | null;
  artifact_id?: number | null;
  source_run_id?: number | null;
  output_digest?: string | null;
  output_size_bytes?: number | null;
};

export type RunProgressSnapshot = {
  run_id: number;
  status: RunStatus;
  attempts: number;
  max_attempts: number;
  cancel_requested: boolean;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  node_statuses: Record<string, RunNodeStatus>;
};

export type RunSummary = {
  id: number;
  status: RunStatus;
  workflow_name: string;
  project_id: number | null;
  attempts: number;
  max_attempts: number;
  cancel_requested: boolean;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  error: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type Run = {
  id: number;
  status: RunStatus;
  workflow_name: string;
  workflow_graph: Record<string, unknown>;
  workflow_id: number | null;
  workflow_revision: number | null;
  dataset_id: number | null;
  project_id: number | null;
  owner_username: string;
  target_column: string | null;
  task_type: string;
  bypass_cache: boolean;
  priority: number;
  attempts: number;
  max_attempts: number;
  timeout_seconds: number;
  cancel_requested: boolean;
  locked_by: string | null;
  heartbeat_at: string | null;
  process_pid: number | null;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  node_statuses: Record<string, RunNodeStatus> | null;
  logs: Array<{ timestamp: string; level: string; message: string; context?: Record<string, unknown> }> | null;
  metrics: Record<string, unknown> | null;
  artifacts: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};
