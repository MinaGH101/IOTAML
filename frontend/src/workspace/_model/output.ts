export type Output = Record<string, unknown> & {
  kind?: string;
  title?: string;
  node_id?: string;
  source_label?: string;
  branch?: string;
  source_handle?: string;
  source_port_name?: string;
};
