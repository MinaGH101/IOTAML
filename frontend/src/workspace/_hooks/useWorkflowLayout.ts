import { useCallback, useMemo, type CSSProperties, type Dispatch, type PointerEvent, type SetStateAction } from 'react';

export function useWorkflowLayout(
  paletteCollapsed: boolean,
  resultsCollapsed: boolean,
  resultsWidth: number,
  setResultsWidth: Dispatch<SetStateAction<number>>,
) {
  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (resultsCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = resultsWidth;
    const move = (moveEvent: globalThis.PointerEvent) => {
      setResultsWidth(Math.min(760, Math.max(300, startWidth + (startX - moveEvent.clientX))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [resultsCollapsed, resultsWidth, setResultsWidth]);

  const styles = useMemo(() => {
    const topbarHeight = 54;
    const panelGap = 16;
    const panelTopOffset = topbarHeight + 22;
    const appStyle = {
      '--theme-results-panel-width': resultsCollapsed ? '46px' : `${resultsWidth}px`,
      '--workflow-results-width': `${resultsWidth}px`,
      '--workflow-left-panel-offset': paletteCollapsed ? '76px' : '304px',
    } as CSSProperties;
    return {
      appStyle,
      floatingTopbarStyle: {
        position: 'fixed', top: '14px', left: '16px', right: '16px', zIndex: 40,
        minHeight: `${topbarHeight}px`, padding: '6px 12px', borderRadius: '16px',
        background: 'var(--theme-panel-bg)', border: '1px solid var(--theme-divider)',
        boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '12px', overflow: 'hidden',
      } as CSSProperties,
      topbarLeftStyle: {
        position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px',
        minWidth: 0, maxWidth: 'calc(50% - 220px)', zIndex: 2,
      } as CSSProperties,
      topbarCenterStyle: {
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        minWidth: 0, zIndex: 1,
      } as CSSProperties,
      topbarRightStyle: {
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
        minWidth: 0, maxWidth: 'calc(50% - 220px)', overflow: 'hidden',
        flexWrap: 'nowrap', zIndex: 2,
      } as CSSProperties,
      floatingWorkspaceStyle: {
        position: 'relative', height: '100vh', minHeight: '100vh', padding: 0, overflow: 'hidden',
      } as CSSProperties,
      floatingLeftStyle: {
        position: 'fixed', top: `${panelTopOffset}px`, left: `${panelGap}px`,
        bottom: `${panelGap}px`, zIndex: 30, width: paletteCollapsed ? '52px' : '272px',
        borderRadius: '16px', overflow: paletteCollapsed ? 'visible' : 'hidden',
        background: 'var(--theme-panel-bg)', border: '1px solid var(--theme-divider)', boxShadow: 'none',
      } as CSSProperties,
      floatingRightStyle: {
        position: 'fixed', top: `${panelTopOffset}px`, right: `${panelGap}px`,
        bottom: resultsCollapsed ? 'auto' : `${panelGap}px`,
        height: resultsCollapsed ? 'auto' : undefined, zIndex: 30,
        width: resultsCollapsed ? '52px' : `${resultsWidth}px`, borderRadius: '16px',
        overflow: 'hidden', background: 'var(--theme-panel-bg)',
        border: '1px solid var(--theme-divider)', boxShadow: 'none',
      } as CSSProperties,
      floatingBoardStyle: {
        position: 'absolute', inset: 0, margin: 0, borderRadius: 0, overflow: 'hidden', zIndex: 1,
      } as CSSProperties,
    };
  }, [paletteCollapsed, resultsCollapsed, resultsWidth]);

  return { startResize, ...styles };
}
