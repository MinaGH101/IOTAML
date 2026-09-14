import { memo } from 'react';
import { rightTabMeta } from './right-panel/config';
import { PrimaryTabs } from './right-panel/PrimaryTabs';
import { RightPanelToolbar } from './right-panel/RightPanelToolbar';
import { SecondaryTabs } from './right-panel/SecondaryTabs';
import type { RightPanelProps } from './right-panel/types';
import { useRightPanelState } from './right-panel/useRightPanelState';
function RightPanelComponent(p: RightPanelProps) {
    const state = useRightPanelState(p);
    return <div className={`right-stack-wrap workflow-right-tabs-wrap ${p.resultsCollapsed ? 'workflow-right-tabs-collapsed' : ''}`} style={p.floatingRightStyle}>
    {!p.resultsCollapsed && <div className="resize-handle" onPointerDown={p.startResize} title="تغییر عرض پنل راست"/>}
    <div className="right-stack workflow-right-stack workflow-right-tabs-panel">
      <RightPanelToolbar activeTab={state.activeTab} openTab={state.openTab} p={p}/>
      {!p.resultsCollapsed && <div className="workflow-right-tabs-content">
        <div className="workflow-right-context-line"><b>{rightTabMeta[state.activeTab].label}</b><span>{p.selectedFlow.mode === 'selected' ? 'جریان انتخاب‌شده' : 'کل برد'} · {p.selectedFlow.nodes.length} نود، {p.selectedFlow.edges.length} اتصال</span></div>
        <PrimaryTabs tab={state.activeTab} p={p} inputDataframes={state.inputDataframes} updateInteractiveTable={state.updateInteractiveTable}/>
        <SecondaryTabs tab={state.activeTab} p={p}/>
      </div>}
    </div>
  </div>;
}
export const RightPanel = memo(RightPanelComponent);
