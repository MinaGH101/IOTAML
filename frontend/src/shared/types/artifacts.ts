export type Artifact = {
  id: number;
  project_id: number | null;
  workflow_id: number | null;
  run_id: number | null;
  node_id: string | null;
  owner_username: string;
  artifact_type: string;
  storage_backend: 'local' | 'minio' | string;
  original_filename: string;
  logical_name: string;
  version: number;
  parent_artifact_id: number | null;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  cache_key: string | null;
  schema_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  pinned: boolean;
  last_accessed_at: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type ArtifactUsage = {
  project_id: number | null;
  total_bytes: number;
  quota_bytes: number;
  artifact_count: number;
  by_type: Record<string, number>;
};
