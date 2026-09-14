import type { PortDefinition, RegistryNode } from './catalog';

export type CustomNodePayload = {
  name: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  code: string;
  template: Record<string, unknown> | null;
};

export type CustomNodeDefinition = RegistryNode & CustomNodePayload & {
  id: string;
  isCustom: true;
  created_at?: string;
  updated_at?: string;
};
