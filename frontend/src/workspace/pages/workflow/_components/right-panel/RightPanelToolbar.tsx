import { ChevronLeft, ChevronRight } from 'lucide-react';
import { rightTabMeta, rightTabs } from './config';
import type { RightPanelProps, RightTab } from './types';
export function RightPanelToolbar({ activeTab, openTab, p }: {
    activeTab: RightTab;
    openTab: (tab: RightTab) => void;
    p: RightPanelProps;
}) {
    return <div className="workflow-right-tabs-toolbar">
    <button className="workflow-right-collapse-button" type="button" onClick={() => p.setResultsCollapsed((value) => !value)} title={p.resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'} aria-label={p.resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'}>
      {p.resultsCollapsed ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
    </button>
    <div className="workflow-right-tab-buttons" aria-label="بخش‌های پنل راست">{rightTabs.map((tab) => {
            const Icon = rightTabMeta[tab].icon;
            return <button key={tab} type="button" className={`workflow-right-tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => openTab(tab)} title={rightTabMeta[tab].label} aria-label={rightTabMeta[tab].label}><Icon size={17}/></button>;
        })}</div>
  </div>;
}
