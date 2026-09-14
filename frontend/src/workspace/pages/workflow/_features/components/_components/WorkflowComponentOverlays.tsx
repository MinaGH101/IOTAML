import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../../../../../shared/types';
import type { WorkflowComponentsController } from '../_hooks/useWorkflowComponents';
import { ComponentConfirmations } from './overlays/ComponentConfirmations';
import { ComponentEditorDialogs } from './overlays/ComponentEditorDialogs';
export function WorkflowComponentOverlays({ controller, nodes, registry, selectedCount }: {
    controller: WorkflowComponentsController;
    nodes: Node[];
    registry: RegistryNode[];
    selectedCount: number;
}) { return <><ComponentEditorDialogs c={controller} nodes={nodes} registry={registry} selectedCount={selectedCount}/><ComponentConfirmations c={controller}/></>; }
