import { useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { ComponentBoundaryPort } from '../../../../../../shared/types';
import { componentDraftSignature } from '../../../../../_model/runtimeContext';
import type { ComponentEditorState, PendingComponentUpgrade } from '../_model/componentEditorTypes';
export function useComponentEditorState(nodes: Node[], edges: Edge[]) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [boundary, setBoundary] = useState<{
        inputs: ComponentBoundaryPort[];
        outputs: ComponentBoundaryPort[];
    }>({ inputs: [], outputs: [] });
    const [versionDialogOpen, setVersionDialogOpen] = useState(false);
    const [editor, setEditor] = useState<ComponentEditorState | null>(null);
    const [confirmUngroup, setConfirmUngroup] = useState<Node | null>(null);
    const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
    const [pendingUpgrade, setPendingUpgrade] = useState<PendingComponentUpgrade | null>(null);
    const [confirmLeaveEditor, setConfirmLeaveEditor] = useState(false);
    const editorDirty = useMemo(() => Boolean(editor && componentDraftSignature(nodes, edges, editor.version) !== editor.baselineSignature), [editor, edges, nodes]);
    return {
        createDialogOpen, setCreateDialogOpen,
        boundary, setBoundary,
        versionDialogOpen, setVersionDialogOpen,
        editor, setEditor,
        editorDirty,
        confirmUngroup, setConfirmUngroup,
        definitionDialogOpen, setDefinitionDialogOpen,
        pendingUpgrade, setPendingUpgrade,
        confirmLeaveEditor, setConfirmLeaveEditor,
    };
}
export type ComponentEditorLocalState = ReturnType<typeof useComponentEditorState>;
