import type { UseComponentEditorOptions } from '../_model/componentEditorTypes';
import { useComponentGraphActions } from './component-editor-actions/useComponentGraphActions';
import { useComponentVersionActions } from './component-editor-actions/useComponentVersionActions';
import { useCreateComponent } from './component-editor-actions/useCreateComponent';
import type { ComponentEditorLocalState } from './useComponentEditorState';
export function useComponentEditorActions(o: UseComponentEditorOptions, s: ComponentEditorLocalState, restore: (id: string | null) => void) { return { ...useCreateComponent(o, s, restore), ...useComponentGraphActions(o, s, restore), ...useComponentVersionActions(o, s) }; }
