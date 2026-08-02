import { useCallback, useReducer, useRef, type SetStateAction } from 'react';
import { initialWorkflowViewState, workflowViewReducer } from '../../../_model/viewState';

export function useWorkflowShellState() {
  const [viewState, dispatchViewState] = useReducer(workflowViewReducer, initialWorkflowViewState);
  const { paletteCollapsed, resultsCollapsed, analysisBoardOpen } = viewState;
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;
  const workflowPanelStateRef = useRef({ paletteCollapsed, resultsCollapsed });

  const setPaletteCollapsed = useCallback((value: SetStateAction<boolean>) => {
    const current = viewStateRef.current;
    const next = typeof value === 'function' ? value(current.paletteCollapsed) : value;
    viewStateRef.current = { ...current, paletteCollapsed: next };
    if (!current.analysisBoardOpen) workflowPanelStateRef.current.paletteCollapsed = next;
    dispatchViewState({ type: 'palette', value: next });
  }, []);

  const setResultsCollapsed = useCallback((value: SetStateAction<boolean>) => {
    const current = viewStateRef.current;
    const next = typeof value === 'function' ? value(current.resultsCollapsed) : value;
    viewStateRef.current = { ...current, resultsCollapsed: next };
    if (!current.analysisBoardOpen) workflowPanelStateRef.current.resultsCollapsed = next;
    dispatchViewState({ type: 'results', value: next });
  }, []);

  const setAnalysisBoardOpen = useCallback((value: SetStateAction<boolean>) => {
    const current = viewStateRef.current;
    const next = typeof value === 'function' ? value(current.analysisBoardOpen) : value;
    if (next === current.analysisBoardOpen) return;
    if (next) {
      workflowPanelStateRef.current = { paletteCollapsed: current.paletteCollapsed, resultsCollapsed: current.resultsCollapsed };
      viewStateRef.current = { paletteCollapsed: true, resultsCollapsed: true, analysisBoardOpen: true };
      dispatchViewState({ type: 'palette', value: true });
      dispatchViewState({ type: 'results', value: true });
    } else {
      viewStateRef.current = { ...workflowPanelStateRef.current, analysisBoardOpen: false };
      dispatchViewState({ type: 'palette', value: workflowPanelStateRef.current.paletteCollapsed });
      dispatchViewState({ type: 'results', value: workflowPanelStateRef.current.resultsCollapsed });
    }
    dispatchViewState({ type: 'analysis-board', value: next });
  }, []);

  return { paletteCollapsed, resultsCollapsed, analysisBoardOpen, setPaletteCollapsed, setResultsCollapsed, setAnalysisBoardOpen };
}
