import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Edge, Node } from '@xyflow/react';
import type {
  RegistryNode,
  UserProfile,
  WorkflowComponent,
} from '../../../../../../shared/_types';
import { workspaceApi } from '../../../../../_service/workspaceApi';
import { useComponentEditor } from './useComponentEditor';
import { useComponentLibrary } from './useComponentLibrary';

type FitView = (options: {
  padding?: number;
  duration?: number;
  nodes?: Node[];
}) => unknown;

type UseWorkflowComponentsOptions = {
  projectId: number;
  user: UserProfile;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  selectedIds: string[];
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  setModalNodeId: Dispatch<SetStateAction<string | null>>;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  readOnly: boolean;
  fitView: FitView;
  setBoardOpen: (open: boolean) => void;
  setMessage: (message: string) => void;
  refreshRegistry: () => Promise<void>;
};

export function useWorkflowComponents(options: UseWorkflowComponentsOptions) {
  const {
    projectId,
    user,
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    setModalNodeId,
    registry,
    aliases,
    readOnly,
    fitView,
    setBoardOpen,
    setMessage,
    refreshRegistry,
  } = options;
  const [items, setItems] = useState<WorkflowComponent[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const components = await workspaceApi.components(projectId);
    setItems(components);
    return components;
  }, [projectId]);

  const editor = useComponentEditor({
    projectId,
    user,
    items,
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    setModalNodeId,
    registry,
    aliases,
    readOnly,
    busy,
    setBusy,
    fitView,
    setBoardOpen,
    setMessage,
    refreshComponents: refresh,
    refreshRegistry,
  });
  const library = useComponentLibrary({
    projectId,
    busy,
    setBusy,
    refreshComponents: refresh,
    refreshRegistry,
    enterEditor: editor.enterEditor,
    setMessage,
  });

  return {
    items,
    setItems,
    busy,
    refresh,
    ...editor,
    ...library,
  };
}

export type WorkflowComponentsController = ReturnType<typeof useWorkflowComponents>;
