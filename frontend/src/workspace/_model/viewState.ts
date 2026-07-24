export type WorkflowViewState = {
  paletteCollapsed: boolean;
  resultsCollapsed: boolean;
  analysisBoardOpen: boolean;
};

export type BooleanStateUpdate = boolean | ((current: boolean) => boolean);

export type WorkflowViewAction =
  | { type: 'palette'; value: BooleanStateUpdate }
  | { type: 'results'; value: BooleanStateUpdate }
  | { type: 'analysis-board'; value: BooleanStateUpdate };

export const initialWorkflowViewState: WorkflowViewState = {
  paletteCollapsed: false,
  resultsCollapsed: false,
  analysisBoardOpen: false,
};

function applyBooleanUpdate(current: boolean, update: BooleanStateUpdate) {
  return typeof update === 'function' ? update(current) : update;
}

export function workflowViewReducer(
  state: WorkflowViewState,
  action: WorkflowViewAction,
): WorkflowViewState {
  switch (action.type) {
    case 'palette':
      return { ...state, paletteCollapsed: applyBooleanUpdate(state.paletteCollapsed, action.value) };
    case 'results':
      return { ...state, resultsCollapsed: applyBooleanUpdate(state.resultsCollapsed, action.value) };
    case 'analysis-board':
      return { ...state, analysisBoardOpen: applyBooleanUpdate(state.analysisBoardOpen, action.value) };
  }
}
