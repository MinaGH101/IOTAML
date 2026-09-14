import type { UseComponentEditorOptions } from '../_model/componentEditorTypes';
import { useComponentEditorActions } from './useComponentEditorActions';
import { useComponentEditorNavigation } from './useComponentEditorNavigation';
import { useComponentEditorState } from './useComponentEditorState';
export type { ComponentEditorState } from '../_model/componentEditorTypes';
export function useComponentEditor(options: UseComponentEditorOptions) {
    const state = useComponentEditorState(options.nodes, options.edges);
    const navigation = useComponentEditorNavigation(options, state);
    const actions = useComponentEditorActions(options, state, navigation.restoreSelection);
    return {
        createDialogOpen: state.createDialogOpen,
        setCreateDialogOpen: state.setCreateDialogOpen,
        boundary: state.boundary,
        versionDialogOpen: state.versionDialogOpen,
        setVersionDialogOpen: state.setVersionDialogOpen,
        editor: state.editor,
        editorDirty: state.editorDirty,
        confirmUngroup: state.confirmUngroup,
        setConfirmUngroup: state.setConfirmUngroup,
        definitionDialogOpen: state.definitionDialogOpen,
        setDefinitionDialogOpen: state.setDefinitionDialogOpen,
        pendingUpgrade: state.pendingUpgrade,
        setPendingUpgrade: state.setPendingUpgrade,
        confirmLeaveEditor: state.confirmLeaveEditor,
        setConfirmLeaveEditor: state.setConfirmLeaveEditor,
        enterEditor: navigation.enterEditor,
        enterNode: navigation.enterNode,
        leaveEditor: navigation.leaveEditor,
        requestLeaveEditor: navigation.requestLeaveEditor,
        ...actions,
    };
}
export type ComponentEditorController = ReturnType<typeof useComponentEditor>;
