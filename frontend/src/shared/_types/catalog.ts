export type NodeCategory =
  | 'Data Input'
  | 'Data Inspection'
  | 'Data Cleaning'
  | 'Anomaly Detection'
  | 'Transformation'
  | 'Visualizations'
  | 'ML Data Processing'
  | 'ML Regression Models'
  | 'ML Classification Models'
  | 'ML Model Analysis'
  | 'Export or Report'
  | 'Utilities / Advanced'
  | 'User Nodes'
  | 'Components';

export type PortType =
  | 'dataframe'
  | 'json'
  | 'json_items'
  | 'series'
  | 'columns'
  | 'model'
  | 'metrics'
  | 'plot'
  | 'file'
  | 'report'
  | 'artifact'
  | 'artifact_ref'
  | 'text'
  | 'schema'
  | 'trigger'
  | 'stream'
  | 'any';

export type PortDefinition = {
  id: string;
  name: string;
  type: PortType | string;
  required: boolean;
  multiple: boolean;
};

export type NodeParam = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'code' | 'file' | 'data_file' | 'number' | 'integer' | 'float' | 'color' | 'boolean' | 'select' | 'multiselect' | 'column' | 'columns' | 'dataset' | 'replacement_blocks' | 'imputation_blocks' | 'normalization_blocks' | 'scatter_blocks' | 'row_values' | 'series_colors';
  default: unknown;
  required?: boolean;
  options: unknown[];
  supportsDynamic?: boolean;
  help?: string;
};

export type DynamicSettingValue = {
  mode: 'static' | 'dynamic';
  value?: unknown;
  expression?: string;
};

export type RegistryNode = {
  id: string;
  type?: string;
  name?: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  settingsSchema: NodeParam[];
  params: NodeParam[];
  executionMode: 'instant' | 'queued' | 'sandboxed';
  supportsDynamicParameters: boolean;
  implemented: boolean;
  comingSoon?: boolean;
  priority?: string;
  validationRules?: string;
  cacheable?: boolean;
  cacheVersion?: string;
  isCustom?: boolean;
  owner_username?: string;
  code?: string;
  template?: Record<string, unknown> | null;
  isComponent?: boolean;
  componentId?: number;
  componentVersionId?: number;
  componentVersion?: string;
};

export type NodeCatalogResponse = {
  version: number;
  nodes: RegistryNode[];
  aliases: Record<string, string>;
  categories: NodeCategory[];
  compatiblePorts: Record<string, string[]>;
};
