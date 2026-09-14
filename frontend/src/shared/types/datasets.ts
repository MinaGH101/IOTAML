export type Dataset = {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  project_id: number | null;
  artifact_id: number | null;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  columns: Array<{ name: string; dtype: string; missing: number; unique: number }>;
  created_at: string;
};
